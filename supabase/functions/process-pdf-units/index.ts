import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada.");

    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error("Arquivo PDF vazio.");

    const base64Data = encode(new Uint8Array(arrayBuffer))

    // Usando o modelo MAIS RECENTE disponível na sua conta (Junho 2026)
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `
      Você é um extrator de dados imobiliários de elite. 
      Extraia TODAS as unidades deste PDF e retorne APENAS o array JSON.
      Campos: title, sq_ft (número), price_starting_at (número), status ('available' ou 'unavailable'), parking_spaces (número), description.
      
      Não inclua markdown (como \`\`\`json). Apenas o array [].
    `;

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "application/pdf", data: base64Data } }] }],
        generationConfig: { 
          temperature: 0.1
        }
      })
    })

    const responseText = await response.text();
    
    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Erro no Gemini 3.5", details: responseText }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = JSON.parse(responseText);
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

    // Limpeza caso a IA ainda mande markdown
    const cleanContent = content.replace(/```json/g, "").replace(/```/g, "").trim();

    return new Response(cleanContent, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
