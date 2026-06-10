import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-filename',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log("--- NOVA REQUISIÇÃO RECEBIDA ---");

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada.");

    // Lendo o corpo bruto do arquivo
    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error("Arquivo vazio recebido.");

    console.log(`Arquivo recebido: ${req.headers.get('x-filename') || 'documento.pdf'} (${arrayBuffer.byteLength} bytes)`);
    const base64Data = encode(new Uint8Array(arrayBuffer))

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `Extraia unidades imobiliárias deste PDF em um array JSON: [{"title": "Apto 101", "sq_ft": 85.5, "price_starting_at": 950000, "status": "available", "parking_spaces": 1}]. Use 'available' ou 'unavailable'.`;

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "application/pdf", data: base64Data } }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    })

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error("Erro do Google:", responseText);
      // Retornamos 200 com o erro no corpo para que o frontend consiga ler a mensagem!
      return new Response(JSON.stringify({ error: "Erro na IA do Google", details: responseText }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = JSON.parse(responseText);
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

    return new Response(content, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Erro Crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Forçamos 200 para garantir que o erro chegue no seu alert
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
