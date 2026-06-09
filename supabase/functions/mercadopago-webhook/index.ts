import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const topic = url.searchParams.get('topic') || url.searchParams.get('type')
    const id = url.searchParams.get('id') || url.searchParams.get('data.id')

    console.log(`Recebendo notificação MP: Topic=${topic}, ID=${id}`);

    const body = await req.json().catch(() => ({}))
    console.log('Corpo da notificação:', JSON.stringify(body));

    const paymentId = id || body.data?.id || (topic === 'payment' ? body.id : null);
    console.log(`ID extraído para consulta: ${paymentId}`);

    if (!paymentId || paymentId === 'null') {
      console.log('FALHA: Nenhum ID de pagamento encontrado no corpo ou na URL.');
      return new Response('No payment ID', { status: 200 })
    }

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) {
      console.error('ERRO CRÍTICO: MERCADOPAGO_ACCESS_TOKEN não encontrada.');
      return new Response('Config Error', { status: 500 });
    }

    // 1. Buscar detalhes do pagamento no Mercado Pago
    console.log(`Consultando API do Mercado Pago para o pagamento ${paymentId}...`);
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error(`ERRO API MP (Status ${mpResponse.status}): ${errorText}`);
      return new Response('ok', { status: 200 });
    }

    const payment = await mpResponse.json()
    console.log(`PAGAMENTO ENCONTRADO! Status: ${payment.status}, External Ref: ${payment.external_reference}`);

    if (payment.status === 'approved') {
      const userId = payment.external_reference || payment.metadata?.user_id
      console.log(`Usuário identificado para ativação: ${userId}`);
      
      if (userId) {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        console.log(`Buscando dados atuais do usuário ${userId} no Supabase...`);
        const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (getUserError || !user) {
          console.error(`ERRO ao buscar usuário no Supabase: ${getUserError?.message}`);
          return new Response('ok', { status: 200 });
        }

        console.log(`Usuário encontrado. Tier atual: ${user.user_metadata?.tier || 'free'}. Atualizando para paid...`);
        const isAnnual = payment.metadata?.plan_type === 'annual'
        const durationDays = isAnnual ? 365 : 30

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { 
          user_metadata: { 
            ...user.user_metadata,
            tier: 'paid',
            subscription_start: new Date().toISOString(),
            subscription_end: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
          } 
        })

        if (updateError) {
          console.error(`ERRO ao atualizar metadados: ${updateError.message}`);
        } else {
          console.log(`SUCESSO! Usuário ${userId} agora é PREMIUM.`);
        }
      } else {
        console.warn('AVISO: Pagamento aprovado mas nenhum userId (external_reference) encontrado.');
      }
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error(`MP Webhook Error: ${err.message}`)
    return new Response(`Error: ${err.message}`, { status: 400 })
  }
})
