import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      throw new Error('Nenhum arquivo PDF enviado.')
    }

    // Converter arquivo para Base64
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    const prompt = `
      Você é um extrator de dados imobiliários especializado em tabelas de vendas de construtoras.
      Sua tarefa é extrair os dados de TODAS as unidades disponíveis no PDF anexo.
      Procure por: Número da Unidade/Andar, Tipo, Vaga, m² privativo, Valor e Status.

      Retorne APENAS um array JSON de objetos, seguindo EXATAMENTE este formato:
      [
        {
          "title": "Apto 101",
          "sq_ft": 85.5,
          "price_starting_at": 950000,
          "status": "available", 
          "bedrooms": 2,
          "bathrooms": 2,
          "parking_spaces": 1,
          "description": "Unidade com mezanino, valor inclui entrada de 20% e saldo pós obra."
        }
      ]

      Regras de mapeamento:
      1. status deve ser 'available' para disponível/vago ou 'unavailable' para reservado/vendido.
      2. Se não achar quartos/banheiros, use 0.
      3. Coloque detalhes de pagamento (Entrada, Parcelas, Mezanino) no campo description.
      4. Certifique-se de capturar o valor monetário corretamente como um número.
    `

    console.log(`Processando arquivo: ${file.name}, tipo: ${file.type}, tamanho: ${file.size} bytes`);

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: "application/pdf",
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          response_mime_type: "application/json",
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na API do Gemini:", errorText);
      throw new Error(`Google API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json()
    console.log("Resposta do Gemini recebida com sucesso.");

    const content = result.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!content) {
      console.error("Gemini retornou um resultado vazio:", JSON.stringify(result));
      throw new Error("A IA não conseguiu extrair dados deste PDF. Verifique se o arquivo contém texto legível.");
    }

    return new Response(content, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
