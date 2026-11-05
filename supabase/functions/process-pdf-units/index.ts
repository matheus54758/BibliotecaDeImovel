import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
}

async function callGeminiWithFallback(apiKey: string, payload: any) {
  const models = [
    "https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent",
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
  ];

  let lastResult: any = null;
  for (const baseUrl of models) {
    const response = await fetch(`${baseUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!result.error) {
      return result;
    }
    lastResult = result;
    console.warn(`Modelo ${baseUrl} falhou (${result.error?.message}), tentando fallback...`);
  }
  return lastResult;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || "";
    const { pdfText, images } = await req.json();

    if (!pdfText && (!images || !Array.isArray(images) || images.length === 0)) {
      throw new Error("É necessário fornecer pdfText ou images no corpo da requisição.");
    }

    const prompt = `
      EXTRATOR IMOBILIÁRIO DE ALTA PRECISÃO.
      Extraia TODAS as unidades da tabela de vendas contida neste PDF. Não pule nenhuma linha válida de unidade.
      Ignore linhas que sejam apenas cabeçalhos repetidos sem dados de unidades.
      
      RETORNE ESTRITAMENTE NESTE FORMATO DE TABELA TEXTUAL, SEPARADO POR PIPES (|), 1 UNIDADE POR LINHA (21 COLUNAS):
      title|unit_type|description|sq_ft|price_starting_at|bedrooms|bathrooms|parking_spaces|status|payment_entry|payment_installment_value|payment_installment_count|payment_reinforcement_value|payment_reinforcement_count|payment_post_construction|is_penthouse|has_sea_view|has_garage|is_furnished|is_pet_friendly|has_complete_leisure
      
      EXEMPLO DE RESPOSTA (NÃO USE MARKDOWN):
      Unidade 105 (Studio Norte)|studio|Studio Norte • 22,48m² priv. + 4,00m² terraço • Vaga Rotativa|26.48|384304.63|1|1|1|reserved|19215.23|1525.02|63|11529.14|5|192152.32|false|false|true|false|false|false
      
      REGRAS CRÍTICAS DE INTERPRETAÇÃO DE TABELAS DE CONSTRUTORAS:
      1. NÃO use markdown (\`\`\`), não adicione explicações nem cabeçalho, retorne APENAS as linhas de dados separadas por |.
      2. title: Padronize com o identificador da unidade/cota + tipologia/posição entre parênteses (Ex: "Unidade 105 (Studio Norte)", "Sala 01 (Comercial)", "Unidade 703 (1D Cob. Norte)"). NÃO adicione "(VENDIDO)" ou "(RESERVADO)" no title.
      3. status deve ser ESTRITAMENTE: "available", "sold", ou "reserved".
         - "Disponível" -> "available"
         - "Reservado" / "Reservada" -> "reserved"
         - "Vendido" / "Vendida" / "Indisponível" -> "sold"
         - IMPORTANTE: Se a linha tiver valor monetário mesmo estando Reservada ou Vendida, MANTENHA o price_starting_at original da tabela (só use 0 se não houver preço na linha).
      4. unit_type deve ser ESTRITAMENTE: "dormitory", "studio", "commercial", "house", ou "land".
         - Se contiver "Sala", "Loja", "Comercial" -> "commercial"
         - Se contiver "Studio", "Loft", "Kitnet" -> "studio"
         - Se contiver "1D", "2D", "3D", "4D", "Suíte", "Apto", "Cob" -> "dormitory"
      5. sq_ft (Área): Se a tabela tiver colunas separadas como "m² Privativo", "m² Mezanino", "m² Terraço" e "m² Privativo Total", use SEMPRE o "m² Privativo Total" no campo sq_ft, e anote o detalhamento das áreas no campo description (Ex: "47,17m² priv. + 3,59m² terraço").
      6. Valores monetários e área (sq_ft, price_starting_at, payment_*): APENAS números com ponto decimal, sem R$ e sem separador de milhar (Ex: 837214.75).
      7. Quantidade de parcelas e reforços (payment_installment_count e payment_reinforcement_count): Extraia os números do cabeçalho da coluna caso não estejam na linha (Ex: se o cabeçalho diz "Parcelas (63x)" e "Reforços Anuais (5x)", use 63 para payment_installment_count e 5 para payment_reinforcement_count).
      8. Vagas de garagem (parking_spaces e has_garage):
         - Se a coluna Vaga informar "Rotativa", considere parking_spaces = 1, has_garage = true, e inclua "Vaga Rotativa" no campo description.
         - Se informar área como "12m2", converta para 1 vaga.
         - Se informar número (1, 2, 3), use esse número e has_garage = true.
      9. Cobertura (is_penthouse): Se o tipo ou descrição contiver "Cob", "Cob.", "Cobertura", "Duplex" ou "Triplex", defina is_penthouse = true.
      10. Dormitórios (bedrooms): Se o tipo indicar "1D", "2D", "3D", extraia 1, 2, 3 respectivamente. Para Studio, use 1. Para Sala Comercial, use 0.
      `;

    const parts: any[] = [{ text: prompt }];

    if (pdfText && String(pdfText).trim().length > 0) {
      parts.push({
        text: "\n\nCONTEÚDO DO PDF EXTRAÍDO (LINHAS RECONSTRUÍDAS E ORDENADAS DA ESQUERDA PARA A DIREITA):\n\n" + pdfText
      });
    }

    if (images && Array.isArray(images) && images.length > 0) {
      parts.push({
        text: "\n\nIMAGENS DAS PÁGINAS DA TABELA (USE OCR VISUAL PARA EXTRAIR TODAS AS LINHAS DA TABELA):"
      });
      for (const img of images) {
        parts.push({
          inline_data: {
            mime_type: img.mimeType || "image/jpeg",
            data: img.base64
          }
        });
      }
    }

    console.log("Enviando requisição para a API do Gemini.");

    const result = await callGeminiWithFallback(GEMINI_API_KEY, {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        max_output_tokens: 65536
      }
    });

    if (result?.error) {
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
        bedrooms: parseInt(p[5]) || 0,
        bathrooms: parseInt(p[6]) || 1,
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

  } catch (error: any) {
    console.error("ERRO FATAL NA EDGE FUNCTION:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
