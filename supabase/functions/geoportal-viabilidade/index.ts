import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { iptu } = await req.json()

    if (!iptu || iptu.length < 5) {
      throw new Error('IPTU inválido ou não fornecido.')
    }

    console.log(`Buscando dados de viabilidade no GeoFloripa para o IPTU: ${iptu}`)

    // Faz a requisição oficial para a API oculta do GeoFloripa
    const url = "https://geofloripa.pmf.sc.gov.br/urbano/relatorios/consulta_viabilidade_para_construcao";
    
    // Tratamento básico para garantir formato do IPTU (Ex: 32.30.051.0676.001-400)
    let formattedIptu = iptu;
    const cleanIptu = iptu.replace(/\D/g, '');
    if (cleanIptu.length === 17 && !iptu.includes('.')) {
      // 32 30 051 0676 001 400 -> 32.30.051.0676.001-400
      formattedIptu = `${cleanIptu.substring(0,2)}.${cleanIptu.substring(2,4)}.${cleanIptu.substring(4,7)}.${cleanIptu.substring(7,11)}.${cleanIptu.substring(11,14)}-${cleanIptu.substring(14)}`;
    }

    const pmfRes = await fetch(url, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "x-user-login": "geoportal",
        "x-user-token": "30ac2251814ad72af037e2ec217c7bfc",
        "Referer": "https://geo.pmf.sc.gov.br/"
      },
      body: JSON.stringify({
        "inscricao": formattedIptu,
        "usos_construcao": [4]
      })
    });

    const data = await pmfRes.json();
    
    if (!data.success || !data.report_response?.html) {
      throw new Error('Não foi possível gerar o relatório de viabilidade para este IPTU.');
    }

    const html = data.report_response.html;
    
    // Extraindo a Área usando Expressão Regular
    const areaMatch = html.match(/Área do Lote conforme Cadastro.*?([\d.,]+)\s*m²/is);
    let areaLote = 0;
    if (areaMatch) {
       areaLote = parseFloat(areaMatch[1].replace('.', '').replace(',', '.')); // Lida com formato pt-BR
    }

    // Extraindo o Zoneamento (Ex: ARP-2.3)
    const zoneMatch = html.match(/Áreas do lote que sobrepõe a zona:[\s\S]*?\*\s*([A-Z0-9.-]+)/i);
    let zoneamento = 'Desconhecido';
    if (zoneMatch) {
       zoneamento = zoneMatch[1];
    }

    // Calculando CA (Mapeamento básico)
    let coeficienteAproveitamento = 2.5; 
    let taxaOcupacao = 50;
    let gabaritoPavimentos = 6;

    if (zoneamento.includes('AMC')) {
       coeficienteAproveitamento = 4.0;
       taxaOcupacao = 70;
       gabaritoPavimentos = 12;
    } else if (zoneamento.includes('ARP')) {
       coeficienteAproveitamento = 2.5; // Ajustar conforme lei específica
       taxaOcupacao = 50;
       gabaritoPavimentos = 4;
    }

    const result = {
      iptu: formattedIptu,
      zoneamento,
      areaLote,
      taxaOcupacao,
      coeficienteAproveitamento,
      gabaritoPavimentos,
      areaMaximaConstruivel: areaLote * coeficienteAproveitamento,
      potencialAdicional: 'Dados extraídos em tempo real do GeoFloripa!',
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
