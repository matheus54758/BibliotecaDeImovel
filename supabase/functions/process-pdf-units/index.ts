import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*', // Aceita qualquer cabeçalho para evitar erros de CORS
}

serve(async (req) => {
  // Resposta para a verificação de segurança (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada no Supabase.");

    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error("Arquivo PDF vazio.");

    const base64Data = encode(new Uint8Array(arrayBuffer))

    // URL oficial para modelos Gemini com chave de API
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `Extraia unidades imobiliárias deste PDF em um array JSON: [{"title": "Apto 101", "sq_ft": 85.5, "price_starting_at": 950000, "status": "available", "parking_spaces": 1}]. Use 'available' ou 'unavailable'.`;

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "application/pdf", data: base64Data } }] }],
        generationConfig: { 
          response_mime_type: "application/json" 
        }
      })
    })

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error("Erro retornado pelo Google:", responseText);
      // Retornamos 200 com o erro para que o frontend exiba o Alerta real
      return new Response(JSON.stringify({ error: "Google Gemini Error", details: responseText }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = JSON.parse(responseText);
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

    return new Response(content, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Erro Crítico na Função:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Sucesso falso para garantir que a mensagem chegue no alert do front
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
