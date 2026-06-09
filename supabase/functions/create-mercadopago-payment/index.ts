import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { priceId, description, amount } = await req.json()

    // 1. Validar usuário
    const authHeader = req.headers.get('Authorization')!
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Não autorizado')

    // 2. Criar pagamento no Mercado Pago
    // Documentação: https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')!;
    const isTest = accessToken.startsWith('TEST-');

    // No sandbox do MP, o e-mail do pagador deve ser um e-mail de teste válido
    // O erro "Invalid users involved" ocorre quando o e-mail não é reconhecido como um test user do MP
    const payerEmail = isTest ? 'test_user_123@testuser.com' : user.email;
    const fullName = user.user_metadata?.full_name || 'Cliente Lumis';
    const firstName = fullName.split(' ')[0] || 'Cliente';
    const lastName = fullName.split(' ').slice(1).join(' ') || 'Lumis';

    const notificationUrl = `https://soqrntbuvmanmnufdlrc.supabase.co/functions/v1/mercadopago-webhook`;
    console.log(`Iniciando pagamento para: ${payerEmail} - Valor: ${amount} - Notificando em: ${notificationUrl}`);

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: description,
        payment_method_id: 'pix',
        payer: {
          email: payerEmail,
          first_name: firstName,
          last_name: lastName,
        },
        notification_url: notificationUrl,
        external_reference: user.id,
        metadata: {
          user_id: user.id,
          plan_type: priceId.includes('annual') ? 'annual' : 'monthly'
        }
      }),
    })

    const paymentData = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error('Erro detalhado MP:', JSON.stringify(paymentData, null, 2))
      throw new Error(paymentData.message || paymentData.cause?.[0]?.description || 'Erro ao criar pagamento no Mercado Pago')
    }

    // Retornamos os dados do PIX (QR Code e Copia e Cola)
    return new Response(
      JSON.stringify({ 
        id: paymentData.id,
        qr_code: paymentData.point_of_interaction.transaction_data.qr_code,
        qr_code_base64: paymentData.point_of_interaction.transaction_data.qr_code_base64,
        copy_paste: paymentData.point_of_interaction.transaction_data.qr_code,
        status: paymentData.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
