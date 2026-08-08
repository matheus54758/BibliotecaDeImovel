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

    // 1. Busca do token dinâmico para evitar 401 Unauthorized
    let dynamicToken = "971d7d5497881c0088d1ad6fdbf6bcd7"; // Token atualizado como fallback
    try {
      const siteRes = await fetch("https://geo.pmf.sc.gov.br/");
      const htmlText = await siteRes.text();
      const jsMatch = htmlText.match(/\/static\/js\/main\.[a-z0-9]+\.chunk\.js/);
      if (jsMatch) {
        const jsRes = await fetch(`https://geo.pmf.sc.gov.br${jsMatch[0]}`);
        const jsText = await jsRes.text();
        // Pode estar como "X-User-Token":"..." ou ["X-User-Token"]="..."
        const tokenMatch = jsText.match(/\[?["']X-User-Token["']\]?\s*[:=]\s*["']([a-f0-9]{32})["']/i);
        if (tokenMatch && tokenMatch[1]) {
          dynamicToken = tokenMatch[1];
          console.log("Token extraído dinamicamente com sucesso!");
        }
      }
    } catch (e) {
      console.log('Falha na busca dinâmica do token. Usando fallback.', e.message);
    }

    // Faz a requisição oficial para a API oculta do GeoFloripa
    const url = "https://geofloripa.pmf.sc.gov.br/urbano/relatorios/consulta_viabilidade_para_construcao";
    
    // Tratamento robusto para garantir o formato correto do IPTU (Ex: 32.30.051.0676.001-400)
    // Remove tudo que não for número (pontos, traços, barras, espaços, etc)
    const cleanIptu = String(iptu).replace(/\D/g, '');
    
    if (cleanIptu.length !== 17) {
      throw new Error('Formato de IPTU inválido. Verifique se o número contém exatamente 17 dígitos.');
    }

    // Aplica a máscara padrão oficial: XX.XX.XXX.XXXX.XXX-XXX
    const formattedIptu = `${cleanIptu.substring(0,2)}.${cleanIptu.substring(2,4)}.${cleanIptu.substring(4,7)}.${cleanIptu.substring(7,11)}.${cleanIptu.substring(11,14)}-${cleanIptu.substring(14)}`;

    let pmfRes;
    try {
      pmfRes = await fetch(url, {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "x-user-login": "geoportal",
          "x-user-token": dynamicToken,
          "Referer": "https://geo.pmf.sc.gov.br/"
        },
        body: JSON.stringify({
          "inscricao": formattedIptu,
          "usos_construcao": [4]
        })
      });
    } catch (e) {
      throw new Error('Erro de conexão com o sistema da Prefeitura. Tente novamente mais tarde.');
    }

    let data;
    try {
      data = await pmfRes.json();
    } catch (e) {
      // Se a resposta não for JSON, o servidor da PMF pode estar retornando uma página HTML de erro (ex: 502 Bad Gateway)
      throw new Error('O sistema do GeoFloripa está temporariamente indisponível ou em manutenção.');
    }
    
    if (!data.success) {
      const msg = data.message ? data.message.toLowerCase() : '';
      if (msg.includes('não encontrada')) {
        throw new Error('Este número de IPTU não foi encontrado na base de dados da Prefeitura.');
      } else if (msg.includes('unauthorized') || msg.includes('não autorizado') || msg.includes('token')) {
        throw new Error('Acesso negado no sistema da Prefeitura (Problema de Token).');
      }
      throw new Error(data.message || 'A Prefeitura não retornou os dados de viabilidade para este IPTU.');
    }

    if (!data.report_response?.html) {
      throw new Error('O relatório foi gerado pela Prefeitura, mas o formato está vazio ou irreconhecível.');
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

    // Extraindo restrições ambientais
    const restricoesAmbientais = [];
    const lowerHtml = html.toLowerCase();
    
    if (lowerHtml.includes('preservação permanente') || lowerHtml.includes('app')) {
      restricoesAmbientais.push('Área de Preservação Permanente (APP) identificada.');
    }
    if (lowerHtml.includes('curso d\'água') || lowerHtml.includes('hidrografia') || lowerHtml.includes('rio')) {
      restricoesAmbientais.push('Proximidade com curso d\'água (Hidrografia).');
    }
    if (lowerHtml.includes('risco geológico') || lowerHtml.includes('deslizamento') || lowerHtml.includes('declividade')) {
      restricoesAmbientais.push('Atenção: Área com possível risco geológico ou alta declividade.');
    }
    if (lowerHtml.includes('marinha') || lowerHtml.includes('terreno de marinha')) {
      restricoesAmbientais.push('Possível sobreposição com Terreno de Marinha.');
    }

    // Tentar extrair o gabarito real (número de pavimentos)
    const gabaritoMatch = html.match(/Gabarito.*?(\d+)\s*pavimento/is);
    let gabaritoPavimentos = 6;
    if (gabaritoMatch) {
       gabaritoPavimentos = parseInt(gabaritoMatch[1], 10);
    } else {
       // Fallback baseado no zoneamento se o gabarito não for encontrado explicitamente
       if (zoneamento.includes('AMC')) gabaritoPavimentos = 12;
       else if (zoneamento.includes('ARP')) gabaritoPavimentos = 4;
    }

    // Calculando CA (Mapeamento básico)
    let coeficienteAproveitamento = 2.5; 
    let taxaOcupacao = 50;

    if (zoneamento.includes('AMC')) {
       coeficienteAproveitamento = 4.0;
       taxaOcupacao = 70;
    } else if (zoneamento.includes('ARP')) {
       coeficienteAproveitamento = 2.5;
       taxaOcupacao = 50;
    }

    const result = {
      iptu: formattedIptu,
      zoneamento,
      areaLote,
      taxaOcupacao,
      coeficienteAproveitamento,
      gabaritoPavimentos,
      areaMaximaConstruivel: areaLote * coeficienteAproveitamento,
      restricoesAmbientais,
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
