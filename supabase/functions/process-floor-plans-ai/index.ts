import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const { images } = await req.json();
    if (!images || !Array.isArray(images)) {
      throw new Error("O campo images é obrigatório e deve ser um array.");
    }

    const prompt = `
      VOCÊ É UM ASSISTENTE DE ARQUITETURA.
      Eu vou fornecer um lote de imagens retiradas de um caderno em PDF de uma construtora.
      Muitas páginas contêm apenas fotos de marketing, capa, introdução do bairro, etc.
      Algumas páginas contêm PLANTAS BAIXAS (desenho técnico arquitetônico do apartamento/unidade).
      
      SUA TAREFA:
      Analise CADA imagem. 
      Se a imagem NÃO for uma planta baixa (for apenas marketing, fotos de pessoas, texto puro, etc), ignore-a.
      Se a imagem FOR UMA PLANTA BAIXA CLARA (apresentar o layout do apartamento com paredes, medidas ou divisões de cômodos), você deve extrair o NOME da planta ou descrição da unidade que estiver escrito na página (ex: "Planta Tipo 1", "Cobertura 01", "75m2", "Final 01 e 02").

      RETORNE ESTRITAMENTE UM JSON ARRAY VÁLIDO contendo APENAS as imagens que são plantas baixas.
      Se nenhuma for planta baixa, retorne um array vazio [].
      
      Formato exato de resposta (sem markdown):
      [
        { "index": 0, "is_floor_plan": true, "name": "Planta Tipo 1 - 75m2" }
      ]
    `;

    const parts: any[] = [{ text: prompt }];

    for (const img of images) {
      parts.push({ text: `\nAnalisando Imagem Index: ${img.index}` });
      parts.push({ inline_data: { mime_type: img.mimeType || "image/jpeg", data: img.base64 } });
    }

    console.log(`Enviando lote de ${images.length} imagens para o Gemini analisar.`);

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { 
          temperature: 0.1
        }
      })
    });

    const result = await response.json();
    
    if (result.error) {
       return new Response(JSON.stringify({ error: "GOOGLE_ERROR", details: result.error.message }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
    }

    const candidate = result.candidates?.[0];
    const rawText = candidate?.content?.parts?.[0]?.text || "[]";
    
    let parsedPlans = [];
    try {
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedPlans = JSON.parse(cleaned);
    } catch (e) {
      console.error("Falha ao fazer parse do JSON do Gemini", rawText);
      parsedPlans = [];
    }

    console.log("Mágica concluída. Plantas arquitetônicas isoladas:", parsedPlans);

    return new Response(JSON.stringify({ plans: parsedPlans }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Erro no processamento da Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
