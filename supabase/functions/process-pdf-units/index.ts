import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    // Gemini 3.5 Flash - Modelo principal em 2026
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const { pdfText } = await req.json();
    if (!pdfText) {
      throw new Error("O campo pdfText é obrigatório no corpo da requisição.");
    }

    const prompt = `
      EXTRATOR IMOBILIÁRIO ULTRARÁPIDO.
      Extraia TODAS as unidades da tabela contida neste PDF. Não pule nenhuma linha.
      
      RETORNE ESTRITAMENTE NESTE FORMATO DE TABELA TEXTUAL, SEPARADO POR PIPES (|), 1 UNIDADE POR LINHA:
      title|unit_type|description|sq_ft|price_starting_at|bedrooms|bathrooms|parking_spaces|status|payment_entry|payment_installment_value|payment_installment_count|payment_reinforcement_value|payment_reinforcement_count|payment_post_construction|is_penthouse|has_sea_view|has_garage|is_furnished|is_pet_friendly|has_complete_leisure
      
      EXEMPLO DE RESPOSTA (NÃO USE MARKDOWN):
      Apto 101 (FRENTE RUA)|dormitory|1 Suíte + 1 Studio|72.67|650000.00|2|2|1|available|0|0|0|0|0|0|false|false|true|false|false|false
      
      REGRAS CRÍTICAS:
      1. NÃO use markdown (\`\`\`), não adicione explicações, apenas as linhas de dados.
      2. status deve ser ESTRITAMENTE: "available", "sold", "reserved". (Se na tabela constar "VENDIDO", "INDISPONÍVEL" ou similar, o status é "sold" e o price_starting_at deve ser 0).
      3. unit_type deve ser ESTRITAMENTE: "dormitory", "studio", "commercial", "house", ou "land".
      4. Valores monetários/área (sq_ft, price): APENAS números com ponto decimal (Ex: 1500230.00).
      5. Posição/Face/Torre deve ser concatenada ao título (Ex: "Apto 101 (Frente Rua)").
      6. Vagas de garagem (parking_spaces): ATENÇÃO MÁXIMA, se a tabela informar área como "12m2", converta isso para a quantidade de 1 vaga. NUNCA repasse a área.
      `;
      
    console.log("Enviando requisição para a API do Gemini com o texto extraído do navegador.");
    
    const finalPrompt = prompt + "\n\nCONTEÚDO DO PDF EXTRAÍDO (TENTE LER EM FORMATO DE TABELA PELOS ESPAÇAMENTOS):\n\n" + pdfText;

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }],
        generationConfig: { 
          temperature: 0.1,
          max_output_tokens: 65536
        }
      })
    });
    
    console.log("Resposta do Gemini recebida! Status HTTP:", response.status);

    const result = await response.json();
    
    if (result.error) {
       return new Response(JSON.stringify({ error: "GOOGLE_ERROR", details: result.error.message }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
    }

    const candidate = result.candidates?.[0];
    const rawText = candidate?.content?.parts?.[0]?.text || "";
    
    // Extrator e conversor do formato Pipe (|)
    const lines = rawText.trim().split('\n');
    const parsed = [];
    
    for (const line of lines) {
      if (!line.includes('|')) continue;
      const p = line.split('|');
      if (p.length < 21 || p[0].trim().toLowerCase() === 'title') continue;
      
      parsed.push({
        title: p[0].trim(),
        unit_type: p[1].trim(),
        description: p[2].trim(),
        sq_ft: parseFloat(p[3]) || 0,
        price_starting_at: parseFloat(p[4]) || 0,
        bedrooms: parseInt(p[5]) || 1,
        bathrooms: parseInt(p[6]) || 0,
        parking_spaces: parseInt(p[7]) || 0,
        status: p[8].trim() || 'available',
        payment_entry: parseFloat(p[9]) || 0,
        payment_installment_value: parseFloat(p[10]) || 0,
        payment_installment_count: parseInt(p[11]) || 0,
        payment_reinforcement_value: parseFloat(p[12]) || 0,
        payment_reinforcement_count: parseInt(p[13]) || 0,
        payment_post_construction: parseFloat(p[14]) || 0,
        is_penthouse: p[15].trim().toLowerCase() === 'true',
        has_sea_view: p[16].trim().toLowerCase() === 'true',
        has_garage: p[17].trim().toLowerCase() === 'true',
        is_furnished: p[18].trim().toLowerCase() === 'true',
        is_pet_friendly: p[19].trim().toLowerCase() === 'true',
        has_complete_leisure: p[20].trim().toLowerCase() === 'true'
      });
    }

    if (parsed.length === 0) {
      return new Response(JSON.stringify({ 
        error: "IA_SEM_DADOS", 
        details: "A IA falhou em formatar a tabela ou o PDF não possui dados válidos." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("ERRO FATAL NA EDGE FUNCTION:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
