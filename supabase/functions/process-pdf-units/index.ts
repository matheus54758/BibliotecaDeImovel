import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

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

    const arrayBuffer = await req.arrayBuffer();
    const base64Data = encode(new Uint8Array(arrayBuffer));

    const prompt = `
      EXTRATOR JSON ROBÓTICO. TABELA: ICONE FASE 2.
      Extraia TODAS as unidades (90+). Não pule nenhuma.
      
      CAMPOS OBRIGATÓRIOS:
      - title: "Apto 101"
      - unit_type: Classifique em um destes 4: "dormitory" (para Apartamentos), "studio" (para Studios/Kitnets), "commercial" (para Salas/Lojas), "house" (para Casas/Sobrados).
      - description: Descrição curta (ex: "2 Dormitórios Leste", "Sala 02", etc)
      - sq_ft: área total (ex: 26.48). No PDF pode estar como "26,48" ou "2648", converta SEMPRE para float com PONTO DECIMAL. 
      - price_starting_at: valor total
      - bedrooms: extraia a quantidade numérica (mínimo 1). Se o PDF não disser, ou for Studio, coloque 1 por padrão.
      - status: "Disponível", "Vendido" ou "Reservado"
      - payment_entry: valor entrada
      - payment_installment_value: valor parcela
      - payment_installment_count: qtd parcelas
      - payment_reinforcement_value: valor reforço
      - payment_reinforcement_count: qtd reforços
      - status: "Disponível", "Vendido" ou "Reservado"
      - is_penthouse: true se no título ou descrição contiver "Cob", "Cobertura" ou "Penthouse".
      - has_sea_view: true se contiver "Vista Mar", "Frente Mar" ou similar.
      - has_garage: true se indicar vaga de garagem inclusa (Vaga, Garagem).
      - is_furnished: true se contiver "Mobiliado", "Mobília" ou similar.
      - is_pet_friendly: true se contiver "Pet Friendly", "Aceita Pets" ou similar.
      - has_complete_leisure: true se contiver "Lazer Completo", "Área de Lazer" ou similar.
      - has_automation: true se contiver "Automação", "Automado" ou similar.
      - has_balcony_grill: true se contiver "Churrasqueira", "Sacada com Churrasqueira" ou similar.
      - payment_entry: valor entrada
      ...
      REGRAS IMPORTANTES:
      1. DECIMAL DA ÁREA: Se o número no PDF for algo como "2648" e parecer uma área de apartamento, entenda como "26.48". Áreas raramente passam de 1000.
      2. DORMITÓRIOS: Se não encontrar a informação de dormitórios, assuma que a unidade possui no mínimo 1. Nunca retorne 0.
      3. No campo 'unit_type', SEMPRE substitua a sigla "D" por "Dormitório(s)".
      4. STATUS: Se no PDF indicar que não está disponível, use "Reservado" ou "Vendido". No JSON retorne "reserved" ou "sold".
      5. DIFERENCIAIS: Se encontrar "Cob", "Norte", "Sul" no título, mantenha a informação de orientação no título, mas extraia "is_penthouse: true" se encontrar menção a cobertura.

      RETORNE APENAS O ARRAY JSON [{},...]. SEM MARKDOWN. SEM TEXTO. COMPACTO.
      `;
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "application/pdf", data: base64Data } }] }],
        generationConfig: { 
          temperature: 0.1,
          max_output_tokens: 65536
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
    const rawText = candidate?.content?.parts?.[0]?.text || "";
    const finishReason = candidate?.finishReason || "UNKNOWN";
    
    // Extrator robusto de JSON
    const start = rawText.indexOf('[');
    const end = rawText.lastIndexOf(']');
    
    if (start === -1 || end === -1) {
       console.error("Truncated or invalid response:", rawText);
       return new Response(JSON.stringify({ 
         error: "IA_SEM_DADOS", 
         details: `IA parou por: ${finishReason}. Verifique se o PDF é muito grande. Resposta parcial: ${rawText.substring(0, 100)}...`
       }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
    }

    let jsonString = rawText.substring(start, end + 1);
    
    // Limpeza de vírgulas extras
    jsonString = jsonString.replace(/,\s*([\]}])/g, '$1');

    try {
      const parsed = JSON.parse(jsonString);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error("Parse Error. Raw text:", rawText);
      return new Response(JSON.stringify({ 
        error: "JSON_INVALIDO", 
        details: "Erro ao processar lista gigante. Tente reduzir o PDF ou contate o suporte." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
