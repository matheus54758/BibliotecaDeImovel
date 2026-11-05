import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_VERIFY_TOKEN = "ledger_verify_token"
const FALLBACK_PHONE_NUMBER_ID = "1386713737859615"
const FALLBACK_ACCESS_TOKEN = "EAAQgldnNdvMBS2XKK5gEibhp67xZBqGXowabAFiVPzqhKyTKdBCVTN6CPAFsSF6l7bAuOkN0LpEUvgwLAqi4gjADdpc8rYVg2EnjkDtirbCvH6S3iG2dALSNrPBGIFfg7KCAPAzOzIk6crgxee37T6JCwZAcj0nhuSUhZBhZAWv4sBN4H5G7TQug7TUV51AzGzaBFJAbgmenUNb6m5eCvra1hRQcZAL2rztlGoCj2ZBaHKHT7nVQh1r5WogkHtoRw1X0rCwOV8hqmMMoR2ZBkQquuO0"

function formatBRL(val: any): string {
  const num = Number(val) || 0;
  if (num <= 0) return "Sob consulta";
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getEffectiveBedrooms(u: any): number {
  const combined = `${u?.title || ''} ${u?.description || ''}`;
  const t = String(u?.unit_type || '').toLowerCase();
  if (t === 'commercial' || /\b(sala\s+comercial|loja)\b/i.test(combined)) return 0;
  const matchD = combined.match(/\b(\d+)\s*(?:[dD]\b|dorm|quarto|su[íi]te)/i);
  if (matchD) return parseInt(matchD[1], 10);
  if (t === 'studio' || /\bstudio\b/i.test(combined)) return 1;
  return Number(u?.bedrooms) || 1;
}

function getUnitTypeLabel(u: any): string {
  const t = String(u.unit_type || '').toLowerCase();
  const title = String(u.title || '').toLowerCase();
  const beds = getEffectiveBedrooms(u);
  if (u.is_penthouse || title.includes('cob')) return beds > 1 ? `Cobertura (${beds}D)` : 'Cobertura';
  if (t === 'studio' || title.includes('studio')) return 'Studio';
  if (t === 'commercial' || title.includes('sala') || title.includes('loja')) return 'Sala Comercial';
  if (t === 'house') return 'Casa';
  if (t === 'land') return 'Terreno';
  return `Apartamento (${beds}D)`;
}

function filterUnitsByQuery(units: any[], query: string): { filtered: any[]; filterDescription: string } {
  const msg = query.toLowerCase();
  let list = units.filter(u => u.status === 'available');
  const filtersApplied: string[] = [];

  // Exclusões explícitas ("não seja studio", "sem studio", "fora studio")
  if (/(n[ãa]o\s+(?:seja|ser|quero)\s+studio|sem\s+studio|exceto\s+studio|fora\s+studio)/i.test(msg)) {
    list = list.filter(u => u.unit_type !== 'studio' && !String(u.title || '').toLowerCase().includes('studio'));
    filtersApplied.push("exceto Studios");
  }
  if (/(n[ãa]o\s+(?:seja|ser|quero)\s+sala|sem\s+sala\s+comercial)/i.test(msg)) {
    list = list.filter(u => u.unit_type !== 'commercial' && !String(u.title || '').toLowerCase().includes('sala'));
    filtersApplied.push("exceto Salas Comerciais");
  }

  // Inclusões por tipologia
  if (!filtersApplied.length) {
    if (/\b(studio|studios|kitnet|loft)\b/i.test(msg)) {
      list = list.filter(u => u.unit_type === 'studio' || String(u.title || '').toLowerCase().includes('studio'));
      filtersApplied.push("Studios");
    } else if (/\b(sala|salas|comercial|comerciais|loja)\b/i.test(msg)) {
      list = list.filter(u => u.unit_type === 'commercial' || String(u.title || '').toLowerCase().includes('sala'));
      filtersApplied.push("Salas Comerciais");
    } else if (/\b(cobertura|coberturas|cob\.?|duplex|triplex)\b/i.test(msg)) {
      list = list.filter(u => u.is_penthouse || /\b(cob\.?|cobertura)\b/i.test(String(u.title || '') + ' ' + String(u.description || '')));
      filtersApplied.push("Coberturas");
    } else if (/\b(apartamento|apartamentos|apto|aptos)\b/i.test(msg)) {
      list = list.filter(u => u.unit_type === 'dormitory' && !String(u.title || '').toLowerCase().includes('studio'));
      filtersApplied.push("Apartamentos");
    }
  } else if (/\b(apartamento|apartamentos|apto|aptos)\b/i.test(msg)) {
    list = list.filter(u => u.unit_type !== 'commercial');
  }

  // Filtro "mais de 1 quarto" / "mais de um quarto" / "2 ou mais quartos"
  if (/(mais\s+de\s+(?:1|um)\s*(?:quarto|quartos|dormit[óo]rio|dormit[óo]rios)|(?:2|dois)\s+ou\s+mais\s*(?:quarto|quartos|dormit[óo]rio)|pelo\s+menos\s+(?:2|dois)\s*(?:quarto|quartos|dormit[óo]rio))/i.test(msg)) {
    list = list.filter(u => getEffectiveBedrooms(u) >= 2);
    filtersApplied.push("2+ dormitórios");
  } else {
    // Filtro por quantidade específica de dormitórios (ex: "2 quartos", "2 dormitórios", "2D", "1D")
    const bedMatch = msg.match(/\b(\d+)\s*(?:quarto|quartos|dormit[óo]rio|dormit[óo]rios|dorm|d|su[íi]te|su[íi]tes)\b/i);
    if (bedMatch) {
      const targetBeds = parseInt(bedMatch[1], 10);
      list = list.filter(u => getEffectiveBedrooms(u) === targetBeds);
      filtersApplied.push(`${targetBeds} dormitório(s)`);
    }
  }

  return {
    filtered: list,
    filterDescription: filtersApplied.join(" • ")
  };
}

function getSimilarUnitsList(subUnits: any[], currentProperty: any): any[] {
  const avail = subUnits.filter(u => u.status === 'available' && u.id !== currentProperty?.id);
  const currentBeds = getEffectiveBedrooms(currentProperty);
  const currentType = String(currentProperty?.unit_type || '').toLowerCase();
  const currentPrice = Number(currentProperty?.price_starting_at) || 0;

  return [...avail].sort((a, b) => {
    const aTypeMatch = String(a.unit_type || '').toLowerCase() === currentType ? 0 : 1;
    const bTypeMatch = String(b.unit_type || '').toLowerCase() === currentType ? 0 : 1;
    if (aTypeMatch !== bTypeMatch) return aTypeMatch - bTypeMatch;

    const aBedDiff = Math.abs(getEffectiveBedrooms(a) - currentBeds);
    const bBedDiff = Math.abs(getEffectiveBedrooms(b) - currentBeds);
    if (aBedDiff !== bBedDiff) return aBedDiff - bBedDiff;

    return Math.abs((Number(a.price_starting_at) || 0) - currentPrice) -
      Math.abs((Number(b.price_starting_at) || 0) - currentPrice);
  });
}

function getEffectiveMetrics(property: any, parentDevelopment: any | null, subUnits: any[]) {
  const pricedUnits = (subUnits || [])
    .filter(u => u.status === 'available' && Number(u.price_starting_at) > 1)
    .sort((a, b) => Number(a.price_starting_at) - Number(b.price_starting_at));
  const refUnit = pricedUnits[0] || (subUnits || []).find(u => Number(u.price_starting_at) > 1);

  const rawPrice = Number(property?.price_starting_at) || 0;
  const effectivePrice = rawPrice > 1 ? rawPrice : (Number(refUnit?.price_starting_at) || 0);
  const isFromStartingUnit = rawPrice <= 1 && effectivePrice > 1;

  const roi1y = Number(property?.roi_appreciation_1y) || Number(refUnit?.roi_appreciation_1y) || Number(parentDevelopment?.roi_appreciation_1y) || (effectivePrice > 1 ? 15 : 0);
  const roi2y = Number(property?.roi_appreciation_2y) || Number(refUnit?.roi_appreciation_2y) || Number(parentDevelopment?.roi_appreciation_2y) || (effectivePrice > 1 ? 12 : 0);
  const roi3y = Number(property?.roi_appreciation_3y) || Number(refUnit?.roi_appreciation_3y) || Number(parentDevelopment?.roi_appreciation_3y) || (effectivePrice > 1 ? 10 : 0);

  const rentSeasonal = Number(property?.rent_seasonal) || Number(refUnit?.rent_seasonal) || (effectivePrice > 1 ? effectivePrice * 0.01 : 0);
  const rentAnnual = Number(property?.rent_annual) || Number(refUnit?.rent_annual) || (effectivePrice > 1 ? effectivePrice * 0.005 : 0);
  const saleAfterKeys = Number(property?.sale_value_after_keys) || Number(refUnit?.sale_value_after_keys) || (effectivePrice > 1 ? effectivePrice * 1.30 : 0);
  const grossProfit = saleAfterKeys > effectivePrice && effectivePrice > 1 ? saleAfterKeys - effectivePrice : 0;
  const cubRate = Number(property?.cub_monthly_rate) || Number(parentDevelopment?.cub_monthly_rate) || 0;
  const monthsUntilKeys = Number(property?.months_until_keys) || Number(parentDevelopment?.months_until_keys) || 0;

  return {
    effectivePrice,
    isFromStartingUnit,
    roi1y,
    roi2y,
    roi3y,
    rentSeasonal,
    rentAnnual,
    saleAfterKeys,
    grossProfit,
    cubRate,
    monthsUntilKeys
  };
}

// Motor Inteligente Local (Fallback 100% Gratuito caso a cota do Gemini acabe)
function buildSmartLocalReply(
  userMessage: string,
  property: any,
  parentDevelopment: any | null,
  subUnits: any[],
  similarProperties: any[],
  amenities: any[],
  history: { role: string; text: string }[] = []
): { reply: string; showLeadForm?: boolean; showSimilar?: boolean; matchedUnits?: any[] } {
  const msg = (userMessage || "").trim().toLowerCase();
  const buildingName = parentDevelopment?.title || property.title;
  const isSubUnit = Boolean(property.parent_id);

  const lastBotText = [...(history || [])].reverse().find(h => h.role === 'model')?.text || '';
  const botAskedSimilar = /(posso\s+lhe\s+mostrar\s+unidades\s+parecidas|mostrar\s+unidades\s+parecidas)/i.test(lastBotText);
  const isAffirmative =
    /^(?:sim|s|pode|pode\s+sim|pode\s+mostrar|quero|quero\s+sim|quero\s+ver|claro|com\s+certeza|por\s+favor|pfv|mostra|mostre|me\s+mostra|me\s+mostre|manda|ok|beleza|vamos|aceito|topo|yes)\b/i.test(msg) ||
    /\b(pode\s+mostrar|quero\s+ver\s+as\s+unidades|me\s+mostr[ae]\s+unidades\s+parecidas|mostr[ae]\s+unidades\s+parecidas)\b/i.test(msg);
  const isNegative =
    /^(?:n[ãa]o|nao|n|agora\s+n[ãa]o|n[ãa]o\s+precisa|n[ãa]o\s+quero|depois|obrigad[oa])\b/i.test(msg);

  if (botAskedSimilar && isNegative) {
    return {
      reply: `Perfeito! Se tiver mais alguma dúvida sobre *${property.title}* ou quiser falar com o corretor responsável, é só me avisar.`
    };
  }

  if (
    (botAskedSimilar && isAffirmative) ||
    /\b(me\s+mostr[ae]|mostr[ae]|quero\s+ver)\s+(?:as\s+)?(?:unidades?\s+parecidas?|im[óo]veis?\s+parecidos?|similares?)\b/i.test(msg)
  ) {
    const similarUnits = getSimilarUnitsList(subUnits, property);
    if (similarUnits.length > 0) {
      let text = `🏢 Separei *${similarUnits.length} unidade(s) parecida(s)* disponível(is) no empreendimento *${buildingName}* para você comparar:\n\n`;
      similarUnits.slice(0, 6).forEach(u => {
        text += `• *${u.title}* (${getUnitTypeLabel(u)}): ${u.sq_ft}m² | *${formatBRL(u.price_starting_at)}*\n`;
      });
      text += `\nClique em qualquer unidade abaixo para abrir a página dela:`;
      return { reply: text, matchedUnits: similarUnits.slice(0, 6) };
    }
    if (similarProperties.length > 0) {
      return {
        reply: `🔍 Separei *${similarProperties.length} imóvel(is) parecido(s)* do nosso portfólio para você comparar! Confira abaixo:`,
        showSimilar: true
      };
    }
    return {
      reply: `Posso pedir para o corretor separar opções parecidas no perfil que você busca! Deixe seu Nome e WhatsApp abaixo:`,
      showLeadForm: true
    };
  }

  // 0. Pergunta direta sobre quantos quartos/dormitórios tem a unidade atual (ex: "Quantos quartos tem?", "Quantos banheiros?")
  if (/(quantos?\s+(?:quarto|quartos|dormit[óo]rio|dormit[óo]rios|su[íi]te|banheiro|vaga))/i.test(msg)) {
    const unitTypesSet = Array.from(new Set(subUnits.filter(u => u.status === 'available').map(u => getUnitTypeLabel(u))));
    const text = isSubUnit
      ? `A unidade *${property.title}* (${getUnitTypeLabel(property)}) possui *${property.bedrooms || 0} dormitório(s)*, *${Math.max(1, property.bathrooms || 1)} banheiro(s)*, *${property.parking_spaces || 0} vaga(s)* e *${property.sq_ft}m²* de área privativa.\n\nPosso lhe mostrar unidades parecidas?`
      : `O empreendimento *${buildingName}* possui unidades disponíveis nas seguintes configurações: *${unitTypesSet.join(", ") || `${property.bedrooms || 0} dormitórios`}*.\n\nPosso lhe mostrar unidades parecidas?`;
    return { reply: text };
  }

  // 1. Perguntas sobre Rentabilidade / Investimento / ROI / Valorização / Locação (checado ANTES de preço genérico para capturar "valores de investimento")
  if (/(investimento|investir|rentabilidade|retorno|roi|valoriza[çc][ãa]o|valoriza|aluguel|loca[çc][ãa]o|temporada|renda\s+passiva|lucro|chaves|cub)/i.test(msg)) {
    const m = getEffectiveMetrics(property, parentDevelopment, subUnits);
    let text = `📈 *Análise de Investimento e Rentabilidade — ${property.title}*${isSubUnit && parentDevelopment ? ` (*${parentDevelopment.title}*)` : ''}\n\n`;
    if (m.effectivePrice > 1) {
      text += `• *Valor do Ativo:* ${m.isFromStartingUnit ? 'A partir de ' : ''}${formatBRL(m.effectivePrice)}\n`;
    }
    if (m.roi1y > 0 || m.roi2y > 0 || m.roi3y > 0) {
      const parts: string[] = [];
      if (m.roi1y > 0) parts.push(`1 Ano: *+${m.roi1y}%*`);
      if (m.roi2y > 0) parts.push(`2 Anos: *+${m.roi2y}%*`);
      if (m.roi3y > 0) parts.push(`3 Anos: *+${m.roi3y}%*`);
      text += `• *Valorização Estimada:* ${parts.join(' | ')}\n`;
    }
    if (m.rentSeasonal > 0) text += `• *Renda Passiva (Locação Temporada):* ${formatBRL(m.rentSeasonal)}/mês est.\n`;
    if (m.rentAnnual > 0) text += `• *Renda Passiva (Locação Anual):* ${formatBRL(m.rentAnnual)}/mês est.\n`;
    if (m.saleAfterKeys > 0) text += `• *Projeção de Venda nas Chaves:* ${formatBRL(m.saleAfterKeys)}\n`;
    if (m.grossProfit > 0) text += `• *Lucro Bruto Projetado na Revenda:* ${formatBRL(m.grossProfit)}\n`;
    if (m.cubRate > 0) text += `• *Reajuste CUB Estimado:* +${m.cubRate}% a.m.\n`;
    if (m.monthsUntilKeys > 0) text += `• *Prazo até as Chaves:* ${m.monthsUntilKeys} meses\n`;
    text += `\nPosso lhe mostrar unidades parecidas?`;
    return { reply: text };
  }

  // 2. Perguntas sobre Preço / Entrada / Parcelamento / Financiamento
  if (/(pre[çc]o|valor|custa|quanto|entrada|parcela|refor[çc]o|bal[ãa]o|financia|pagamento|condi[çc][ãa]o)/i.test(msg)) {
    const m = getEffectiveMetrics(property, parentDevelopment, subUnits);
    let text = `💰 *Valores e Condições — ${property.title}*${isSubUnit && parentDevelopment ? ` (Empreendimento *${parentDevelopment.title}*)` : ''}\n\n`;
    text += `• *Valor:* ${m.effectivePrice > 1 ? `${m.isFromStartingUnit ? 'A partir de ' : ''}${formatBRL(m.effectivePrice)}` : 'Sob consulta'}\n`;
    if (property.payment_entry > 0) {
      text += `• *Entrada:* ${formatBRL(property.payment_entry)}\n`;
    }
    if (property.payment_installment_count > 0 && property.payment_installment_value > 0) {
      text += `• *Mensais:* ${property.payment_installment_count}x de ${formatBRL(property.payment_installment_value)}\n`;
    }
    if (property.payment_reinforcement_count > 0 && property.payment_reinforcement_value > 0) {
      text += `• *Reforços/Balões:* ${property.payment_reinforcement_count}x de ${formatBRL(property.payment_reinforcement_value)}\n`;
    }
    if (property.payment_post_construction > 0) {
      text += `• *Saldo Pós-Obra / Financiamento:* ${formatBRL(property.payment_post_construction)}\n`;
    }
    text += `\nPosso lhe mostrar unidades parecidas?`;
    return { reply: text };
  }

  // 3. Perguntas sobre Área / Vagas / Lazer / Diferenciais da unidade atual
  if (/(vaga|garagem|metragem|m2|m²|[áa]rea|lazer|piscina|churrasqueira|pet|mobiliado|mar|praia)/i.test(msg)) {
    const diffs: string[] = [];
    if (property.is_penthouse) diffs.push("Cobertura");
    if (property.near_beach) diffs.push("Próximo à Praia");
    if (property.has_sea_view) diffs.push("Vista para o Mar");
    if (property.has_garage || property.parking_spaces > 0) diffs.push("Vaga de Garagem");
    if (property.has_balcony_grill) diffs.push("Sacada com Churrasqueira");
    if (property.is_furnished) diffs.push("Mobiliado");
    if (property.is_pet_friendly) diffs.push("Pet Friendly");
    if (property.has_complete_leisure) diffs.push("Lazer Completo");
    amenities.forEach(a => {
      if (a?.name && !diffs.includes(a.name)) diffs.push(a.name);
    });

    let text = `📐 *Ficha Técnica — ${property.title}*${isSubUnit && parentDevelopment ? ` (${parentDevelopment.title})` : ''}\n\n`;
    if (property.sq_ft > 0) text += `• *Área Privativa:* ${property.sq_ft}m²\n`;
    if (property.unit_type !== 'land') {
      text += `• *Dormitórios:* ${property.bedrooms || 0}\n`;
      text += `• *Banheiros:* ${Math.max(1, property.bathrooms || 1)}\n`;
      if (property.parking_spaces > 0) text += `• *Vagas:* ${property.parking_spaces}\n`;
    }
    if (diffs.length > 0) {
      text += `• *Diferenciais:* ${diffs.join(", ")}\n`;
    }
    text += `\nPosso lhe mostrar unidades parecidas?`;
    return { reply: text };
  }

  // 4. Perguntas sobre Localização / Endereço / Bairro / Cidade
  if (/(onde|localiza|endere[çc]o|bairro|cidade|rua|fica|regi[ãa]o)/i.test(msg)) {
    const loc = property.location || parentDevelopment?.location || `${property.street || ''} ${property.city || ''} - ${property.state || ''}`.trim();
    return {
      reply: `📍 *Localização de ${buildingName}:*\n${loc || 'Localização privilegiada (consulte o endereço exato com o corretor).'}\n\nPosso lhe mostrar unidades parecidas?`
    };
  }

  // 5. Perguntas sobre Visita / Contato / Corretor / Proposta
  if (/(visita|corretor|atendente|humano|whatsapp|contato|proposta|comprar|agendar)/i.test(msg)) {
    return {
      reply: `Perfeito! Preencha seu *Nome e WhatsApp* no cartão abaixo para registrarmos seu atendimento prioritário ou clique para abrir o WhatsApp direto com o corretor:`,
      showLeadForm: true
    };
  }

  // 6. Perguntas sobre Imóveis Similares / Outros Empreendimentos (pergunta antes de jogar na tela)
  if (/(outro|similar|parecido|mais barato|menor|maior)/i.test(msg)) {
    return {
      reply: `Temos outras opções no nosso portfólio que podem se encaixar muito bem no que você procura!\n\nPosso lhe mostrar unidades parecidas?`
    };
  }

  // 7. Perguntas buscando tipologias/unidades dentro do empreendimento (ex: "Quero apartamentos que não sejam studio", "Quais unidades disponíveis?", "Tem de 2 quartos?")
  if (
    subUnits.length > 0 &&
    /(unidade|dispon[íi]ve|apartamento|apto|studio|sala|cobertura|andar|planta|op[çc][õo]es|tabela|\b\d+\s*(?:quarto|dormit[óo]rio|1d|2d|3d))/i.test(msg)
  ) {
    const { filtered, filterDescription } = filterUnitsByQuery(subUnits, msg);

    if (filtered.length === 0) {
      return {
        reply: `No empreendimento *${buildingName}*, não encontrei unidades disponíveis com o filtro exato (${filterDescription || 'solicitado'}).\n\nPosso lhe mostrar unidades parecidas?`
      };
    }

    const countIntro = filterDescription
      ? `🏢 No empreendimento *${buildingName}*, encontrei *${filtered.length} unidade(s) disponível(is)* (${filterDescription}):\n\n`
      : `🏢 O empreendimento *${buildingName}* possui *${subUnits.length} unidades no total* (sendo *${filtered.length} disponíveis* no momento):\n\n`;
    let text = countIntro;
    filtered.slice(0, 6).forEach(u => {
      text += `• *${u.title}* (${getUnitTypeLabel(u)}): ${u.sq_ft}m² | *${formatBRL(u.price_starting_at)}*\n`;
    });
    if (filtered.length > 6) {
      text += `\n_(+ ${filtered.length - 6} outras unidades disponíveis)_`;
    }
    text += `\nClique em qualquer unidade abaixo para abrir a página dela:`;
    return { reply: text, matchedUnits: filtered.slice(0, 6) };
  }

  // Resposta geral completa
  let fallback = `Olá! Você está vendo *${property.title}*${isSubUnit && parentDevelopment ? `, que faz parte do empreendimento *${parentDevelopment.title}*` : ''}:\n\n`;
  fallback += `📍 *Localização:* ${property.location || parentDevelopment?.location || property.city || 'Consulte'}\n`;
  if (property.price_starting_at > 0) fallback += `💰 *Valor:* ${formatBRL(property.price_starting_at)}\n`;
  if (property.sq_ft > 0) fallback += `📐 *Área:* ${property.sq_ft}m²\n`;
  if (subUnits.length > 0) {
    const availCount = subUnits.filter(u => u.status === 'available').length;
    fallback += `🏢 *Unidades no empreendimento ${buildingName}:* ${subUnits.length} no total (${availCount} disponíveis)\n`;
  }
  fallback += `\nPosso lhe mostrar unidades parecidas?`;
  return { reply: fallback };
}

async function callGeminiChat(apiKey: string, systemPrompt: string, history: { role: string; text: string }[], userMessage: string) {
  if (!apiKey) return null;

  const models = [
    "https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent",
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
  ];

  const historyLines = (history || [])
    .slice(-6)
    .map(h => `${h.role === 'user' ? 'Cliente' : 'Assistente'}: ${String(h.text || '').replace(/\n+/g, ' ')}`)
    .join('\n');

  const combinedPrompt = `${systemPrompt}\n\nHISTÓRICO RECENTE DA CONVERSA:\n${historyLines || '(Início da conversa)'}\n\nNOVA MENSAGEM DO CLIENTE:\n${userMessage}\n\nRESPOSTA DO ASSISTENTE:`;

  for (const baseUrl of models) {
    try {
      const response = await fetch(`${baseUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: combinedPrompt }] }],
          generationConfig: {
            temperature: 0.25,
            max_output_tokens: 4096
          }
        })
      });

      const result = await response.json();
      if (!result.error && result.candidates?.[0]?.content?.parts?.[0]?.text) {
        return result.candidates[0].content.parts[0].text;
      }
      console.warn(`Gemini Chat (${baseUrl}) retornou erro/limite:`, result.error?.message);
    } catch (err) {
      console.warn(`Falha de rede no Gemini Chat (${baseUrl}):`, err);
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || DEFAULT_VERIFY_TOKEN

    if (mode === 'subscribe' && token === verifyToken) {
      return new Response(challenge, { status: 200 })
    } else {
      return new Response('Forbidden', { status: 403 })
    }
  }

  try {
    const body = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // =========================================================================
    // MODO A: SALVAR LEAD DO CHAT DIRETO NO CRM DO CORRETOR (client_interactions)
    // =========================================================================
    if (body.mode === 'save_lead') {
      const { propertyId, clientName, clientPhone, clientEmail, notes, leadId } = body;
      if (!propertyId || !clientName) {
        return new Response(JSON.stringify({ error: "O nome é obrigatório." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      const { data: prop } = await supabase
        .from('developments')
        .select('id, title, user_id')
        .eq('id', propertyId)
        .maybeSingle();

      if (!prop || !prop.user_id) {
        return new Response(JSON.stringify({ error: "Imóvel não encontrado." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        });
      }

      const today = new Date().toISOString().split('T')[0];

      if (leadId) {
        const updatePayload: any = {
          property_id: prop.id,
          client_name: String(clientName).trim(),
          notes: notes || `Lead capturado pelo Assistente Virtual 24h no imóvel "${prop.title}".`,
        };
        if (clientPhone !== undefined) {
          updatePayload.client_phone = String(clientPhone || '').trim();
        }
        const { error: updateError } = await supabase
          .from('client_interactions')
          .update(updatePayload)
          .eq('id', leadId);

        if (updateError) throw updateError;
        return new Response(JSON.stringify({ success: true, leadId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      const { data: insertedLead, error: insertError } = await supabase
        .from('client_interactions')
        .insert([{
          user_id: prop.user_id,
          property_id: prop.id,
          client_name: String(clientName).trim(),
          client_phone: clientPhone ? String(clientPhone).trim() : '',
          client_email: clientEmail ? String(clientEmail).trim() : '',
          interest_level: 'high',
          notes: notes || `Lead capturado pelo Assistente Virtual 24h no imóvel "${prop.title}".`,
          contact_date: today
        }])
        .select('id')
        .maybeSingle();

      if (insertError) throw insertError;

      return new Response(JSON.stringify({ success: true, leadId: insertedLead?.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // =========================================================================
    // MODO B: CHAT AUTOMATIZADO DO SITE (GEMINI + FALLBACK LOCAL AUTOMÁTICO)
    // =========================================================================
    if (body.mode === 'web_chat') {
      const { propertyId, userMessage, history } = body;
      if (!propertyId || !userMessage) {
        return new Response(JSON.stringify({ error: "propertyId e userMessage são obrigatórios." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      const { data: property } = await supabase
        .from('developments')
        .select('*, builders(*)')
        .eq('id', propertyId)
        .maybeSingle();

      if (!property) {
        return new Response(JSON.stringify({ error: "Imóvel não encontrado." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        });
      }

      const parentProjectId = property.parent_id || property.id;

      const [parentRes, subUnitsRes, amenitiesRes, similarRes] = await Promise.all([
        property.parent_id
          ? supabase.from('developments').select('*, builders(*)').eq('id', property.parent_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('developments')
          .select('id, title, unit_type, description, sq_ft, bedrooms, bathrooms, parking_spaces, price_starting_at, status, is_penthouse, payment_entry, payment_installment_count, payment_installment_value, payment_reinforcement_count, payment_reinforcement_value, payment_post_construction, roi_appreciation_1y, roi_appreciation_2y, roi_appreciation_3y, rent_seasonal, rent_annual, sale_value_after_keys, cub_monthly_rate, months_until_keys')
          .eq('parent_id', parentProjectId)
          .order('price_starting_at', { ascending: true }),
        supabase
          .from('amenities')
          .select('name')
          .eq('development_id', parentProjectId),
        supabase
          .from('developments')
          .select('id, title, location, city, sq_ft, bedrooms, price_starting_at, hero_image_url, unit_type')
          .eq('user_id', property.user_id)
          .is('parent_id', null)
          .neq('id', parentProjectId)
          .eq('status', 'available')
          .limit(4)
      ]);

      const parentDevelopment = parentRes.data || null;
      const subUnits = subUnitsRes.data || [];
      const amenities = amenitiesRes.data || [];
      const similarProperties = similarRes.data || [];

      const buildingTitle = parentDevelopment ? parentDevelopment.title : property.title;
      const isViewingSubUnit = Boolean(property.parent_id);

      const totalUnitsCount = subUnits.length;
      const availableSubUnits = subUnits.filter((u: any) => u.status === 'available');
      const unavailableUnitsCount = totalUnitsCount - availableSubUnits.length;

      const availableUnitsSummary = availableSubUnits
        .map((u: any) => `- [${getUnitTypeLabel(u)}] ${u.title}: ${u.sq_ft}m², ${getEffectiveBedrooms(u)} dorm, Valor: ${formatBRL(u.price_starting_at)}${u.description ? ` (${u.description})` : ''}`)
        .join('\n');

      const similarSummary = similarProperties
        .map((s: any) => `- ${s.title} (${s.city || s.location || ''}): ${s.sq_ft}m², ${s.bedrooms || 0} dorm, Valor: ${formatBRL(s.price_starting_at)}`)
        .join('\n');

      const msgTrimmed = userMessage.trim();
      const lastBotText = [...(history || [])].reverse().find((h: any) => h.role === 'model')?.text || '';
      const botAskedSimilar = /(posso\s+lhe\s+mostrar\s+unidades\s+parecidas|mostrar\s+unidades\s+parecidas)/i.test(lastBotText);
      const isAffirmative =
        /^(?:sim|s|pode|pode\s+sim|pode\s+mostrar|quero|quero\s+sim|quero\s+ver|claro|com\s+certeza|por\s+favor|pfv|mostra|mostre|me\s+mostra|me\s+mostre|manda|ok|beleza|vamos|aceito|topo|yes)\b/i.test(msgTrimmed) ||
        /\b(pode\s+mostrar|quero\s+ver\s+as\s+unidades|me\s+mostr[ae]\s+unidades\s+parecidas|mostr[ae]\s+unidades\s+parecidas)\b/i.test(msgTrimmed);
      const isNegative =
        /^(?:n[ãa]o|nao|n|agora\s+n[ãa]o|n[ãa]o\s+precisa|n[ãa]o\s+quero|depois|obrigad[oa])\b/i.test(msgTrimmed);

      // Se o cliente respondeu "Sim" para "Posso lhe mostrar unidades parecidas?" ou pediu explicitamente para ver similares
      if (
        (botAskedSimilar && (isAffirmative || isNegative)) ||
        /\b(me\s+mostr[ae]|mostr[ae]|quero\s+ver)\s+(?:as\s+)?(?:unidades?\s+parecidas?|im[óo]veis?\s+parecidos?|similares?)\b/i.test(msgTrimmed)
      ) {
        const localResult = buildSmartLocalReply(userMessage, property, parentDevelopment, subUnits, similarProperties, amenities, history || []);
        return new Response(
          JSON.stringify({
            reply: localResult.reply,
            modeUsed: 'gemini',
            showLeadForm: localResult.showLeadForm,
            showSimilar: localResult.showSimilar,
            matchedUnits: localResult.matchedUnits,
            similarProperties
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Verifica se a pergunta do cliente é uma busca explícita por filtro de unidades (e não pergunta sobre valor/quartos da peça atual)
      const isQuestionAboutCurrent = /(quantos?\s+(?:quarto|quartos|dormit[óo]rio|banheiro|vaga)|pre[çc]o|valor|custa|quanto|entrada|parcela|refor[çc]o|financia|pagamento|onde\s+fica|localiza)/i.test(msgTrimmed);
      const asksForUnits = !isQuestionAboutCurrent && /(quais\s+unidades|unidades\s+dispon[íi]veis|quero\s+(?:ver\s+)?(?:apartamento|apto|studio|sala|cobertura|op[çc][õo]es)|tem\s+(?:op[çc][ãa]o|apartamento|apto|studio|sala|cobertura|unidade)\s+de|mais\s+de\s+(?:1|um)\s*(?:quarto|dormit[óo]rio)|\b\d+\s*(?:quarto|quartos|dormit[óo]rio|dormit[óo]rios|1d|2d|3d))/i.test(msgTrimmed);
      const filteredQueryResult = asksForUnits ? filterUnitsByQuery(subUnits, msgTrimmed) : null;
      const matchedUnitsForCards = filteredQueryResult && filteredQueryResult.filtered.length > 0
        ? filteredQueryResult.filtered.slice(0, 6)
        : undefined;

      const m = getEffectiveMetrics(property, parentDevelopment, subUnits);
      const priceLabel = m.effectivePrice > 1
        ? `${m.isFromStartingUnit ? 'A partir de ' : ''}${formatBRL(m.effectivePrice)}`
        : 'Sob consulta';

      const systemPrompt = `
Você é o Assistente Virtual Imobiliário 24h.
ATENÇÃO À HIERARQUIA DO SISTEMA:
- Um EMPREENDIMENTO (Prédio/Condomínio) contém várias UNIDADES/PEÇAS individuais (como Studios, Salas Comerciais, Apartamentos de 1, 2, 3 dormitórios e Coberturas).
- Neste momento, o cliente está na página ${isViewingSubUnit ? `da UNIDADE "${property.title}" (${getUnitTypeLabel(property)}), que pertence ao EMPREENDIMENTO "${buildingTitle}"` : `do EMPREENDIMENTO "${buildingTitle}"`}.
- NUNCA diga que "${property.title}" é o nome do prédio se ele for apenas uma Sala Comercial, Studio ou Apartamento! O nome do empreendimento (prédio) é "${buildingTitle}".
- CONTAGEM DE UNIDADES DO EMPREENDIMENTO "${buildingTitle}": O empreendimento possui *${totalUnitsCount} unidades no total*, sendo *${availableSubUnits.length} unidades disponíveis* para venda no momento e *${unavailableUnitsCount} unidades já vendidas/indisponíveis*. Se o cliente perguntar quantas unidades o empreendimento tem, informe sempre os dois números (${totalUnitsCount} no total e ${availableSubUnits.length} disponíveis).
- REGRA DE OURO SOBRE UNIDADES PARECIDAS / IMÓVEIS SIMILARES: NUNCA jogue na cara do cliente ou liste outros imóveis/unidades parecidas sem o cliente pedir! Se o cliente perguntar sobre o imóvel atual, ou se pedir uma característica que este imóvel não tem, responda de forma direta e SEMPRE termine perguntando exatamente: "Posso lhe mostrar unidades parecidas?"

DADOS DA PÁGINA ATUAL (${property.title}):
- Tipo desta peça: ${isViewingSubUnit ? getUnitTypeLabel(property) : 'Empreendimento / Condomínio'}
- Empreendimento (Prédio): ${buildingTitle}
- Total de Unidades no Empreendimento: ${totalUnitsCount} unidades (${availableSubUnits.length} disponíveis e ${unavailableUnitsCount} vendidas/indisponíveis)
- Localização: ${property.location || parentDevelopment?.location || `${property.street || ''}, ${property.city || ''}`}
- Valor desta peça (Ativo): ${priceLabel}
- Área: ${property.sq_ft > 1 ? `${property.sq_ft}m²` : 'Consulte'} | Dormitórios: ${property.bedrooms || 0} | Banheiros: ${Math.max(1, property.bathrooms || 1)} | Vagas: ${property.parking_spaces || 0}
- Condições de Pagamento desta peça: Entrada de ${formatBRL(property.payment_entry)}, ${property.payment_installment_count || 0}x mensais de ${formatBRL(property.payment_installment_value)}, ${property.payment_reinforcement_count || 0}x reforços de ${formatBRL(property.payment_reinforcement_value)}, Saldo Pós-Obra de ${formatBRL(property.payment_post_construction)}

DADOS DE INVESTIMENTO, RENTABILIDADE E ROI DESTA PEÇA (${property.title}):
- Valor do Investimento (Ativo): ${priceLabel}
- Valorização Estimada: Em 1 Ano: +${m.roi1y}% | Em 2 Anos: +${m.roi2y}% | Em 3 Anos: +${m.roi3y}%
- Renda Passiva com Locação Temporada (Airbnb/Diárias): ${formatBRL(m.rentSeasonal)}/mês estimado
- Renda Passiva com Locação Anual (Tradicional): ${formatBRL(m.rentAnnual)}/mês estimado
- Projeção de Venda na Entrega das Chaves: ${formatBRL(m.saleAfterKeys)}
- Lucro Bruto Projetado na Revenda (Chaves): ${formatBRL(m.grossProfit)}
${m.cubRate > 0 ? `- Taxa de Reajuste CUB Estimada: +${m.cubRate}% ao mês\n` : ''}${m.monthsUntilKeys > 0 ? `- Prazo Estimado até as Chaves: ${m.monthsUntilKeys} meses\n` : ''}
IMPORTANTE SOBRE INVESTIMENTO: Sempre que o cliente perguntar sobre investimento, valores de investimento, rentabilidade, retorno, ROI, valorização, aluguel ou chaves, apresente TODOS os números exatos acima em formato de tópicos claros (Valor do Ativo, Valorização em 1/2/3 anos, Locação Temporada e Anual, Venda Estimada nas Chaves e Lucro Bruto Projetado).

${matchedUnitsForCards ? `UNIDADES DISPONÍVEIS NO EMPREENDIMENTO "${buildingTitle}" QUE ATENDEM AO FILTRO DO CLIENTE:\n${availableUnitsSummary}` : ''}

Responda em Português do Brasil, de forma consultiva, clara e concisa, usando asteriscos (*) para negrito. Sempre finalize perguntando "Posso lhe mostrar unidades parecidas?" caso não esteja listando unidades filtradas.
`;

      const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || '';
      let geminiReply = await callGeminiChat(geminiApiKey, systemPrompt, history || [], userMessage);

      if (geminiReply) {
        if (!matchedUnitsForCards && !/posso\s+lhe\s+mostrar\s+unidades\s+parecidas/i.test(geminiReply)) {
          geminiReply = `${geminiReply.trim()}\n\nPosso lhe mostrar unidades parecidas?`;
        }
        return new Response(
          JSON.stringify({
            reply: geminiReply,
            modeUsed: 'gemini',
            matchedUnits: matchedUnitsForCards,
            similarProperties
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // FALLBACK AUTOMÁTICO SEM GEMINI (Cota esgotada ou indisponibilidade)
      const localResult = buildSmartLocalReply(userMessage, property, parentDevelopment, subUnits, similarProperties, amenities, history || []);
      return new Response(
        JSON.stringify({
          reply: localResult.reply,
          modeUsed: 'local_fallback',
          showLeadForm: localResult.showLeadForm,
          showSimilar: localResult.showSimilar,
          matchedUnits: localResult.matchedUnits,
          similarProperties
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // =========================================================================
    // MODO C: WEBHOOK LEGADO DA META WHATSAPP CLOUD API
    // =========================================================================
    let messageText = body.messageText || ""
    let senderPhone = body.senderPhone || ""
    let phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || body.phoneNumberId || FALLBACK_PHONE_NUMBER_ID
    const { bedrooms, maxPrice, city, property_id } = body

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const messageObj = value?.messages?.[0]

    if (value?.metadata?.phone_number_id) {
      phoneNumberId = value.metadata.phone_number_id
    }

    if (body.object === 'whatsapp_business_account' && !messageObj) {
      return new Response(JSON.stringify({ status: 'ignored_status_update' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (messageObj) {
      senderPhone = messageObj.from
      messageText = messageObj.text?.body || ""
    }

    let targetPropertyId = property_id
    if (!targetPropertyId && messageText) {
      const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
      const match = messageText.match(uuidRegex)
      if (match) {
        targetPropertyId = match[0]
      }
    }

    let data: any[] = []
    let similarData: any[] = []
    let isSpecificMatch = false

    if (targetPropertyId) {
      const { data: specificProperty, error: specificError } = await supabase
        .from('developments')
        .select('*')
        .eq('id', targetPropertyId)
        .single()

      if (!specificError && specificProperty) {
        data = [specificProperty]
        isSpecificMatch = true

        const { data: similar, error: similarError } = await supabase
          .from('developments')
          .select('*')
          .neq('id', specificProperty.id)
          .eq('city', specificProperty.city)
          .limit(3)

        if (!similarError && similar) {
          similarData = similar
        }
      }
    }

    if (!isSpecificMatch) {
      const { data: matchedData, error } = await supabase.rpc('match_developments_for_bot', {
        p_bedrooms: bedrooms || null,
        p_max_price: maxPrice || null,
        p_city: city || null
      })

      if (!error && matchedData) {
        data = matchedData
      }
    }

    let botMessage = ""

    const formatProperty = (imovel: any) => {
      const siteUrl = `https://thearchitecturalledger.com/view/${imovel.id}?chat=open`
      let text = `*${imovel.title}*\n📍 ${imovel.city || imovel.location || 'Localização Premium'}\n`
      if (imovel.price_starting_at) {
        text += `💰 A partir de R$ ${Number(imovel.price_starting_at).toLocaleString('pt-BR')}\n`
      }
      text += `🔗 Atendimento Virtual e Fotos: ${siteUrl}\n\n`
      return text
    }

    if (data && data.length > 0) {
      if (isSpecificMatch) {
        botMessage = "Olá! Que ótimo que você tem interesse neste imóvel! Aqui estão os detalhes rápidos dele: 👇\n\n"
        botMessage += formatProperty(data[0])
        botMessage += "Posso lhe mostrar unidades parecidas?"
      } else {
        botMessage = "Olá! Sou o assistente virtual do *The Architectural Ledger*. Encontrei estas opções em destaque para você: 👇\n\n"
        data.forEach((imovel: any) => {
          botMessage += formatProperty(imovel)
        })
      }
    } else {
      botMessage = "Olá! Sou o assistente virtual do *The Architectural Ledger*. Recebemos sua mensagem! Em instantes um de nossos consultores especialistas entrará em contato com as melhores opções de imóveis para o seu perfil."
    }

    let metaResponseData = null
    if (senderPhone && phoneNumberId) {
      const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || FALLBACK_ACCESS_TOKEN
      const metaUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`

      const sendToMeta = async (toPhone: string) => {
        const res = await fetch(metaUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: toPhone,
            type: 'text',
            text: { body: botMessage }
          })
        })
        return await res.json()
      }

      metaResponseData = await sendToMeta(senderPhone)

      if (metaResponseData?.error && senderPhone.startsWith('55')) {
        let altPhone = senderPhone
        if (senderPhone.length === 12) {
          altPhone = senderPhone.slice(0, 4) + '9' + senderPhone.slice(4)
        } else if (senderPhone.length === 13 && senderPhone[4] === '9') {
          altPhone = senderPhone.slice(0, 4) + senderPhone.slice(5)
        }
        if (altPhone !== senderPhone) {
          metaResponseData = await sendToMeta(altPhone)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        matches: data,
        formatted_message: botMessage,
        meta_response: metaResponseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error: any) {
    console.error("Erro no bot-webhook:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
