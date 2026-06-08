import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
})

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!
  const body = await req.text()

  try {
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Helper para extrair o userId do cliente Stripe
    const getUserIdFromCustomer = async (customerId: string) => {
      const customer = await stripe.customers.retrieve(customerId)
      // @ts-ignore
      return customer.metadata?.supabase_user_id
    }

    // Helper para formatar data do Stripe (Timestamp em segundos) para ISO
    const formatDate = (timestamp: number | null | undefined) => {
      if (!timestamp) return null;
      try {
        return new Date(timestamp * 1000).toISOString();
      } catch (e) {
        console.error(`Error formatting date: ${timestamp}`, e);
        return null;
      }
    };

    // 1. Compra Inicial
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const userId = session.client_reference_id
      const subscriptionId = session.subscription

      if (!userId) throw new Error("Missing client_reference_id")

      let subscription_end = null
      let subscription_start = formatDate(session.created)

      if (typeof subscriptionId === 'string') {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        subscription_end = formatDate(subscription.current_period_end)
        subscription_start = formatDate(subscription.current_period_start)
        
        await stripe.customers.update(session.customer as string, {
          metadata: { supabase_user_id: userId }
        })
      }

      await supabaseAdmin.auth.admin.updateUserById(userId, { 
        user_metadata: { 
          tier: 'paid',
          subscription_start,
          subscription_end: subscription_end || new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString()
        } 
      })
      console.log(`Usuário ${userId} ativado com sucesso.`)
    }

    // 2. Renovação ou Alteração
    if (event.type === 'customer.subscription.updated' || event.type === 'invoice.paid') {
      const obj = event.data.object as any;
      const customerId = obj.customer;
      const userId = await getUserIdFromCustomer(customerId);

      if (userId) {
        // Se for invoice.paid, pegamos a assinatura vinculada
        const subscriptionId = obj.subscription || (event.type.startsWith('customer.subscription') ? obj.id : null);
        
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const isInactive = ['canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid'].includes(subscription.status)
          
          await supabaseAdmin.auth.admin.updateUserById(userId, { 
            user_metadata: { 
              tier: isInactive ? 'free' : 'paid',
              subscription_start: isInactive ? null : formatDate(subscription.current_period_start),
              subscription_end: isInactive ? null : formatDate(subscription.current_period_end)
            } 
          })
          console.log(`Status do usuário ${userId} atualizado via ${event.type}.`)
        }
      }
    }

    // 3. Cancelamento Total
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object
      const userId = await getUserIdFromCustomer(subscription.customer as string)

      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, { 
          user_metadata: { 
            tier: 'free',
            subscription_start: null,
            subscription_end: null
          } 
        })
        console.log(`Usuário ${userId} removido do premium.`)
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})
