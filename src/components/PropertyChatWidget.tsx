import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatCurrency, formatNumber } from "../lib/utils";

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  timestamp: string;
  modeUsed?: "gemini" | "local";
  showSimilarCards?: boolean;
  showUnitsCards?: boolean;
  matchedUnits?: any[];
  showLeadForm?: boolean;
}

interface PropertyChatWidgetProps {
  property: any;
  parentDevelopment?: any | null;
  profile: any;
  amenities: any[];
  subUnits: any[];
  similarProperties: any[];
}

export const PropertyChatWidget: React.FC<PropertyChatWidgetProps> = ({
  property,
  parentDevelopment,
  profile,
  amenities,
  subUnits,
  similarProperties,
}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const shouldAutoOpen =
    searchParams.get("chat") === "open" || searchParams.get("chat") === "1";

  const [isOpen, setIsOpen] = useState(shouldAutoOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Lead Capture / Pre-Chat Identification State
  const savedVisitorRaw =
    typeof window !== "undefined"
      ? sessionStorage.getItem("ledger_chat_visitor")
      : null;
  const savedVisitor = savedVisitorRaw ? JSON.parse(savedVisitorRaw) : null;

  const [hasEnteredChat, setHasEnteredChat] = useState<boolean>(
    Boolean(savedVisitor?.name)
  );
  const [leadName, setLeadName] = useState<string>(savedVisitor?.name || "");
  const [leadPhone, setLeadPhone] = useState<string>(savedVisitor?.phone || "");
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(
    savedVisitor?.leadId || null
  );
  const [savingLead, setSavingLead] = useState(false);
  const [leadSaved, setLeadSaved] = useState(Boolean(savedVisitor?.phone));

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const companyName =
    profile?.theme_config?.company_name || "Assistente Virtual 24h";
  const buildingTitle = parentDevelopment?.title || property?.title || "Empreendimento";
  const isSubUnit = Boolean(property?.parent_id);

  const currentUnitLabel =
    isSubUnit && parentDevelopment
      ? `${buildingTitle} - ${property?.title}`
      : `${property?.title || buildingTitle}`;

  const getVisitorSession = () => {
    try {
      const raw =
        typeof window !== "undefined"
          ? sessionStorage.getItem("ledger_chat_visitor")
          : null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const buildAttendanceNotes = (
    units: string[],
    questions: string[],
    phoneStr: string
  ) => {
    const uniqueUnits = Array.from(new Set(units.filter(Boolean)));
    const unitsLine = `📍 Unidades visualizadas/clicadas: ${uniqueUnits.join(
      " ➔ "
    )}`;
    const questionsLine =
      questions.length > 0
        ? `\n💬 Dúvidas no chat: ${questions.join(" | ")}`
        : "";
    const phoneLine = phoneStr ? "" : "\n(Telefone não informado na entrada)";
    return `${unitsLine}${questionsLine}${phoneLine}`;
  };

  const getNowTime = () =>
    new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const getEffectiveBedrooms = (u: any): number => {
    const combined = `${u?.title || ""} ${u?.description || ""}`;
    const t = String(u?.unit_type || "").toLowerCase();
    if (t === "commercial" || /\b(sala\s+comercial|loja)\b/i.test(combined)) return 0;
    const matchD = combined.match(/\b(\d+)\s*(?:[dD]\b|dorm|quarto|su[íi]te)/i);
    if (matchD) return parseInt(matchD[1], 10);
    if (t === "studio" || /\bstudio\b/i.test(combined)) return 1;
    return Number(u?.bedrooms) || 1;
  };

  const getUnitTypeLabel = (u: any): string => {
    const t = String(u?.unit_type || "").toLowerCase();
    const title = String(u?.title || "").toLowerCase();
    const beds = getEffectiveBedrooms(u);
    if (u?.is_penthouse || title.includes("cob")) return beds > 1 ? `Cobertura (${beds}D)` : "Cobertura";
    if (t === "studio" || title.includes("studio")) return "Studio";
    if (t === "commercial" || title.includes("sala") || title.includes("loja"))
      return "Sala Comercial";
    if (t === "house") return "Casa";
    if (t === "land") return "Terreno";
    return `Apartamento (${beds}D)`;
  };

  const filterUnitsByQuery = (units: any[], query: string) => {
    const msg = query.toLowerCase();
    let list = units.filter((u) => u.status === "available");
    const filtersApplied: string[] = [];

    if (
      /(n[ãa]o\s+(?:seja|ser|quero)\s+studio|sem\s+studio|exceto\s+studio|fora\s+studio)/i.test(
        msg
      )
    ) {
      list = list.filter(
        (u) =>
          u.unit_type !== "studio" &&
          !String(u.title || "").toLowerCase().includes("studio")
      );
      filtersApplied.push("exceto Studios");
    }
    if (/(n[ãa]o\s+(?:seja|ser|quero)\s+sala|sem\s+sala)/i.test(msg)) {
      list = list.filter(
        (u) =>
          u.unit_type !== "commercial" &&
          !String(u.title || "").toLowerCase().includes("sala")
      );
      filtersApplied.push("exceto Salas Comerciais");
    }

    if (!filtersApplied.length) {
      if (/\b(studio|studios|kitnet|loft)\b/i.test(msg)) {
        list = list.filter(
          (u) =>
            u.unit_type === "studio" ||
            String(u.title || "").toLowerCase().includes("studio")
        );
        filtersApplied.push("Studios");
      } else if (/\b(sala|salas|comercial|comerciais|loja)\b/i.test(msg)) {
        list = list.filter(
          (u) =>
            u.unit_type === "commercial" ||
            String(u.title || "").toLowerCase().includes("sala")
        );
        filtersApplied.push("Salas Comerciais");
      } else if (/\b(cobertura|coberturas|cob\.?|duplex|triplex)\b/i.test(msg)) {
        list = list.filter(
          (u) =>
            u.is_penthouse ||
            /\b(cob\.?|cobertura)\b/i.test(
              String(u.title || "") + " " + String(u.description || "")
            )
        );
        filtersApplied.push("Coberturas");
      } else if (/\b(apartamento|apartamentos|apto|aptos)\b/i.test(msg)) {
        list = list.filter(
          (u) =>
            u.unit_type === "dormitory" &&
            !String(u.title || "").toLowerCase().includes("studio")
        );
        filtersApplied.push("Apartamentos");
      }
    } else if (/\b(apartamento|apartamentos|apto|aptos)\b/i.test(msg)) {
      list = list.filter((u) => u.unit_type !== "commercial");
    }

    if (
      /(mais\s+de\s+(?:1|um)\s*(?:quarto|quartos|dormit[óo]rio|dormit[óo]rios)|(?:2|dois)\s+ou\s+mais\s*(?:quarto|quartos|dormit[óo]rio)|pelo\s+menos\s+(?:2|dois)\s*(?:quarto|quartos|dormit[óo]rio))/i.test(
        msg
      )
    ) {
      list = list.filter((u) => getEffectiveBedrooms(u) >= 2);
      filtersApplied.push("2+ dormitórios");
    } else {
      const bedMatch = msg.match(
        /\b(\d+)\s*(?:quarto|quartos|dormit[óo]rio|dormit[óo]rios|dorm|d|su[íi]te|su[íi]tes)\b/i
      );
      if (bedMatch) {
        const targetBeds = parseInt(bedMatch[1], 10);
        list = list.filter((u) => getEffectiveBedrooms(u) === targetBeds);
        filtersApplied.push(`${targetBeds} dormitório(s)`);
      }
    }

    return { filtered: list, filterDescription: filtersApplied.join(" • ") };
  };

  useEffect(() => {
    if (shouldAutoOpen) {
      setIsOpen(true);
    }
  }, [shouldAutoOpen]);

  const getEffectiveMetrics = () => {
    const pricedUnits = subUnits
      .filter((u) => u.status === "available" && Number(u.price_starting_at) > 1)
      .sort((a, b) => Number(a.price_starting_at) - Number(b.price_starting_at));
    const refUnit = pricedUnits[0] || subUnits.find((u) => Number(u.price_starting_at) > 1);

    const rawPrice = Number(property?.price_starting_at) || 0;
    const effectivePrice =
      rawPrice > 1 ? rawPrice : Number(refUnit?.price_starting_at) || 0;
    const isFromStartingUnit = rawPrice <= 1 && effectivePrice > 1;

    const roi1y =
      Number(property?.roi_appreciation_1y) ||
      Number(refUnit?.roi_appreciation_1y) ||
      Number(parentDevelopment?.roi_appreciation_1y) ||
      (effectivePrice > 1 ? 15 : 0);
    const roi2y =
      Number(property?.roi_appreciation_2y) ||
      Number(refUnit?.roi_appreciation_2y) ||
      Number(parentDevelopment?.roi_appreciation_2y) ||
      (effectivePrice > 1 ? 12 : 0);
    const roi3y =
      Number(property?.roi_appreciation_3y) ||
      Number(refUnit?.roi_appreciation_3y) ||
      Number(parentDevelopment?.roi_appreciation_3y) ||
      (effectivePrice > 1 ? 10 : 0);

    const rentSeasonal =
      Number(property?.rent_seasonal) ||
      Number(refUnit?.rent_seasonal) ||
      (effectivePrice > 1 ? effectivePrice * 0.01 : 0);
    const rentAnnual =
      Number(property?.rent_annual) ||
      Number(refUnit?.rent_annual) ||
      (effectivePrice > 1 ? effectivePrice * 0.005 : 0);
    const saleAfterKeys =
      Number(property?.sale_value_after_keys) ||
      Number(refUnit?.sale_value_after_keys) ||
      (effectivePrice > 1 ? effectivePrice * 1.3 : 0);
    const grossProfit =
      saleAfterKeys > effectivePrice && effectivePrice > 1
        ? saleAfterKeys - effectivePrice
        : 0;
    const cubRate =
      Number(property?.cub_monthly_rate) ||
      Number(parentDevelopment?.cub_monthly_rate) ||
      0;
    const monthsUntilKeys =
      Number(property?.months_until_keys) ||
      Number(parentDevelopment?.months_until_keys) ||
      0;

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
      monthsUntilKeys,
    };
  };

  useEffect(() => {
    if (!property) return;

    const totalUnitsCount = subUnits.length;
    const availCount = subUnits.filter((u) => u.status === "available").length;
    const { effectivePrice, isFromStartingUnit } = getEffectiveMetrics();
    const greetingName = leadName.trim() ? `, *${leadName.trim()}*` : "";
    const headerIntro =
      isSubUnit && parentDevelopment
        ? `Olá${greetingName}! Seja muito bem-vindo(a)! 👋\nVocê está vendo a unidade *${property.title}* (${getUnitTypeLabel(
            property
          )}), que faz parte do empreendimento *${buildingTitle}*.`
        : `Olá${greetingName}! Seja muito bem-vindo(a) ao atendimento virtual do empreendimento *${buildingTitle}*! 👋`;

    const welcomeText =
      `${headerIntro}\n\n` +
      `📍 *Localização:* ${
        property.location || parentDevelopment?.location || property.city || "Consulte"
      }\n` +
      (effectivePrice > 1
        ? `💰 *Valor:* ${isFromStartingUnit ? "A partir de " : ""}${formatCurrency(
            effectivePrice
          )}\n`
        : "") +
      (property.sq_ft > 1 ? `📐 *Área:* ${formatNumber(property.sq_ft)}m²\n` : "") +
      (totalUnitsCount > 0
        ? `🏢 *Unidades no empreendimento ${buildingTitle}:* ${totalUnitsCount} unidades no total (${availCount} disponíveis)\n`
        : "") +
      `\nDigite abaixo o que você procura ou tire sua dúvida (ex: *"Quero apartamentos que não sejam studio"*, *"Tem opção de 2 quartos?"*)!`;

    setMessages([
      {
        id: "welcome",
        sender: "bot",
        text: welcomeText,
        timestamp: getNowTime(),
      },
    ]);

    // Se o cliente já estava no chat e abriu uma nova unidade/imóvel, garante que ela conste no atendimento
    if (hasEnteredChat && leadName.trim()) {
      const session = getVisitorSession() || {};
      const prevUnits: string[] = Array.isArray(session.visitedUnits)
        ? session.visitedUnits
        : [];
      const prevQuestions: string[] = Array.isArray(session.questionsLog)
        ? session.questionsLog
        : [];
      const hasUnitAlready = prevUnits.some((u) =>
        u.includes(property.title)
      );

      if (!hasUnitAlready && session.leadId) {
        const updatedUnits = [...prevUnits, currentUnitLabel];
        const updatedNotes = buildAttendanceNotes(
          updatedUnits,
          prevQuestions,
          leadPhone.trim()
        );
        sessionStorage.setItem(
          "ledger_chat_visitor",
          JSON.stringify({
            ...session,
            name: leadName.trim(),
            phone: leadPhone.trim(),
            leadId: session.leadId,
            visitedUnits: updatedUnits,
            questionsLog: prevQuestions,
          })
        );
        supabase.functions
          .invoke("bot-webhook", {
            body: {
              mode: "save_lead",
              propertyId: property.id,
              clientName: leadName.trim(),
              clientPhone: leadPhone.trim(),
              leadId: session.leadId,
              notes: updatedNotes,
            },
          })
          .catch(() => {});
      }
    }
  }, [property?.id, parentDevelopment?.id, subUnits.length, hasEnteredChat]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isTyping]);

  // Formata texto simples com *negrito* e quebras de linha
  const renderFormattedText = (text: string) => {
    return text.split("\n").map((line, lineIdx) => {
      const parts = line.split(/(\*[^*]+\*)/g);
      return (
        <React.Fragment key={lineIdx}>
          {parts.map((part, partIdx) => {
            if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
              return (
                <strong key={partIdx} className="font-bold">
                  {part.slice(1, -1)}
                </strong>
              );
            }
            return <span key={partIdx}>{part}</span>;
          })}
          {lineIdx < text.split("\n").length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  const getSimilarUnitsList = () => {
    const avail = subUnits.filter(
      (u) => u.status === "available" && u.id !== property?.id
    );
    const currentBeds = getEffectiveBedrooms(property);
    const currentType = String(property?.unit_type || "").toLowerCase();
    const currentPrice = Number(property?.price_starting_at) || 0;

    return [...avail].sort((a, b) => {
      const aTypeMatch =
        String(a.unit_type || "").toLowerCase() === currentType ? 0 : 1;
      const bTypeMatch =
        String(b.unit_type || "").toLowerCase() === currentType ? 0 : 1;
      if (aTypeMatch !== bTypeMatch) return aTypeMatch - bTypeMatch;

      const aBedDiff = Math.abs(getEffectiveBedrooms(a) - currentBeds);
      const bBedDiff = Math.abs(getEffectiveBedrooms(b) - currentBeds);
      if (aBedDiff !== bBedDiff) return aBedDiff - bBedDiff;

      return (
        Math.abs((Number(a.price_starting_at) || 0) - currentPrice) -
        Math.abs((Number(b.price_starting_at) || 0) - currentPrice)
      );
    });
  };

  // Resposta local imediata e fallback caso offline
  const generateLocalResponse = (actionOrText: string): Partial<ChatMessage> => {
    const q = actionOrText.trim().toLowerCase();
    const lastBotText =
      [...messages].reverse().find((m) => m.sender === "bot")?.text || "";
    const botAskedSimilar =
      /(posso\s+lhe\s+mostrar\s+unidades\s+parecidas|mostrar\s+unidades\s+parecidas)/i.test(
        lastBotText
      );
    const isAffirmative =
      /^(?:sim|s|pode|pode\s+sim|pode\s+mostrar|quero|quero\s+sim|quero\s+ver|claro|com\s+certeza|por\s+favor|pfv|mostra|mostre|me\s+mostra|me\s+mostre|manda|ok|beleza|vamos|aceito|topo|yes)\b/i.test(
        q
      ) ||
      /\b(pode\s+mostrar|quero\s+ver\s+as\s+unidades|me\s+mostr[ae]\s+unidades\s+parecidas|mostr[ae]\s+unidades\s+parecidas)\b/i.test(
        q
      );
    const isNegative =
      /^(?:n[ãa]o|nao|n|agora\s+n[ãa]o|n[ãa]o\s+precisa|n[ãa]o\s+quero|depois|obrigad[oa])\b/i.test(
        q
      );

    // Se o cliente respondeu "Não" para a pergunta "Posso lhe mostrar unidades parecidas?"
    if (botAskedSimilar && isNegative) {
      return {
        text: `Perfeito! Se tiver mais alguma dúvida sobre *${property.title}* ou quiser falar com o corretor responsável, é só me avisar.`,
      };
    }

    // Se o cliente confirmou ("Sim", "Pode", "Quero") após o bot perguntar "Posso lhe mostrar unidades parecidas?"
    if (
      (botAskedSimilar && isAffirmative) ||
      /\b(me\s+mostr[ae]|mostr[ae]|quero\s+ver)\s+(?:as\s+)?(?:unidades?\s+parecidas?|im[óo]veis?\s+parecidos?|similares?)\b/i.test(
        q
      )
    ) {
      const similarUnits = getSimilarUnitsList();
      if (similarUnits.length > 0) {
        return {
          text: `🏢 Separei *${similarUnits.length} unidade(s) parecida(s)* disponível(is) no empreendimento *${buildingTitle}* para você comparar. Clique em qualquer uma abaixo para abrir:`,
          showUnitsCards: true,
          matchedUnits: similarUnits.slice(0, 6),
        };
      }
      if (similarProperties.length > 0) {
        return {
          text: `🔍 Separei *${similarProperties.length} imóvel(is) parecido(s)* do nosso portfólio para você comparar. Clique em qualquer cartão abaixo:`,
          showSimilarCards: true,
        };
      }
      return {
        text: `Posso pedir para o corretor selecionar opções parecidas no seu perfil! Deixe seu Nome e WhatsApp abaixo:`,
        showLeadForm: true,
      };
    }

    // Pergunta direta sobre quantos quartos/banheiros/vagas tem a peça atual
    if (
      /(quantos?\s+(?:quarto|quartos|dormit[óo]rio|dormit[óo]rios|su[íi]te|banheiro|vaga))/i.test(
        q
      )
    ) {
      const text = isSubUnit
        ? `A unidade *${property.title}* (${getUnitTypeLabel(
            property
          )}) possui *${property.bedrooms || 0} dormitório(s)*, *${Math.max(
            1,
            property.bathrooms || 1
          )} banheiro(s)*, *${property.parking_spaces || 0} vaga(s)* e *${formatNumber(
            property.sq_ft
          )}m²* de área privativa.\n\nPosso lhe mostrar unidades parecidas?`
        : `O empreendimento *${buildingTitle}* possui opções de *${
            property.bedrooms || 0
          } dormitório(s)* e área a partir de *${formatNumber(
            property.sq_ft
          )}m²*.\n\nPosso lhe mostrar unidades parecidas?`;
      return { text };
    }

    // Perguntas sobre Investimento / Rentabilidade / ROI / Valorização / Locação / Retorno (checado ANTES de preço genérico para capturar "valores de investimento")
    if (
      /(investimento|investir|rentabilidade|retorno|roi|valoriza[çc][ãa]o|valoriza|aluguel|loca[çc][ãa]o|temporada|renda\s+passiva|lucro|chaves|cub)/i.test(
        q
      )
    ) {
      const m = getEffectiveMetrics();
      let text = `📈 *Análise de Investimento e Rentabilidade — ${property.title}*${
        isSubUnit && parentDevelopment ? ` (*${buildingTitle}*)` : ""
      }\n\n`;
      if (m.effectivePrice > 1) {
        text += `• *Valor do Ativo:* ${
          m.isFromStartingUnit ? "A partir de " : ""
        }${formatCurrency(m.effectivePrice)}\n`;
      }
      if (m.roi1y > 0 || m.roi2y > 0 || m.roi3y > 0) {
        const parts: string[] = [];
        if (m.roi1y > 0) parts.push(`1 Ano: *+${m.roi1y}%*`);
        if (m.roi2y > 0) parts.push(`2 Anos: *+${m.roi2y}%*`);
        if (m.roi3y > 0) parts.push(`3 Anos: *+${m.roi3y}%*`);
        text += `• *Valorização Estimada:* ${parts.join(" | ")}\n`;
      }
      if (m.rentSeasonal > 0) {
        text += `• *Renda Passiva (Locação Temporada):* ${formatCurrency(
          m.rentSeasonal
        )}/mês est.\n`;
      }
      if (m.rentAnnual > 0) {
        text += `• *Renda Passiva (Locação Anual):* ${formatCurrency(
          m.rentAnnual
        )}/mês est.\n`;
      }
      if (m.saleAfterKeys > 0) {
        text += `• *Projeção de Venda nas Chaves:* ${formatCurrency(
          m.saleAfterKeys
        )}\n`;
      }
      if (m.grossProfit > 0) {
        text += `• *Lucro Bruto Projetado na Revenda:* ${formatCurrency(
          m.grossProfit
        )}\n`;
      }
      if (m.cubRate > 0) {
        text += `• *Reajuste CUB Estimado:* +${m.cubRate}% a.m.\n`;
      }
      if (m.monthsUntilKeys > 0) {
        text += `• *Prazo até as Chaves:* ${m.monthsUntilKeys} meses\n`;
      }
      text += `\nPosso lhe mostrar unidades parecidas?`;
      return { text };
    }

    if (
      /(pre[çc]o|valor|custa|quanto|entrada|parcela|refor[çc]o|pagamento|financia|condi[çc][ãa]o)/i.test(
        q
      )
    ) {
      const m = getEffectiveMetrics();
      let text = `💰 *Plano de Pagamento — ${property.title}*${
        isSubUnit && parentDevelopment ? ` (*${buildingTitle}*)` : ""
      }\n\n`;
      text += `• *Valor Total:* ${
        m.effectivePrice > 1
          ? `${m.isFromStartingUnit ? "A partir de " : ""}${formatCurrency(
              m.effectivePrice
            )}`
          : "Sob consulta"
      }\n`;
      if (property.payment_entry > 0) {
        text += `• *Entrada:* ${formatCurrency(property.payment_entry)}\n`;
      }
      if (
        property.payment_installment_count > 0 &&
        property.payment_installment_value > 0
      ) {
        text += `• *Parcelas Mensais:* ${
          property.payment_installment_count
        }x de ${formatCurrency(property.payment_installment_value)}\n`;
      }
      if (
        property.payment_reinforcement_count > 0 &&
        property.payment_reinforcement_value > 0
      ) {
        text += `• *Reforços / Balões:* ${
          property.payment_reinforcement_count
        }x de ${formatCurrency(property.payment_reinforcement_value)}\n`;
      }
      if (property.payment_post_construction > 0) {
        text += `• *Saldo Pós-Obra / Financiamento:* ${formatCurrency(
          property.payment_post_construction
        )}\n`;
      }
      text += `\nPosso lhe mostrar unidades parecidas?`;
      return { text };
    }

    if (/(visita|corretor|whatsapp|contato|proposta|agendar)/i.test(q)) {
      return {
        text: `📅 *Agendar Atendimento / Falar com Especialista*\n\nInforme seu *Nome e WhatsApp* abaixo para registrarmos seu interesse prioritário ou clique direto para abrir o WhatsApp do corretor:`,
        showLeadForm: true,
      };
    }

    // Se o usuário perguntou sobre outros imóveis / similares (sem ainda ter confirmado após a pergunta)
    if (/(similar|parecido|outro|mais barato|menor|maior)/i.test(q)) {
      return {
        text: `Temos outras opções disponíveis que podem se encaixar muito bem no que você procura!\n\nPosso lhe mostrar unidades parecidas?`,
      };
    }

    // Se o usuário digitou pergunta filtrando unidades/tipologias do empreendimento
    if (
      subUnits.length > 0 &&
      /(unidade|dispon[íi]ve|apartamento|apto|studio|sala|cobertura|op[çc][õo]es|quarto|dormit[óo]rio|1d|2d|3d)/i.test(
        q
      )
    ) {
      const { filtered, filterDescription } = filterUnitsByQuery(subUnits, q);
      if (filtered.length === 0) {
        return {
          text: `No empreendimento *${buildingTitle}*, não encontrei unidades disponíveis com o filtro exato (${
            filterDescription || "solicitado"
          }).\n\nPosso lhe mostrar unidades parecidas?`,
        };
      }
      return {
        text: `🏢 No empreendimento *${buildingTitle}*, encontrei *${
          filtered.length
        } unidade(s) disponível(is)*${
          filterDescription ? ` (${filterDescription})` : ""
        }! Confira abaixo:`,
        showUnitsCards: true,
        matchedUnits: filtered.slice(0, 6),
      };
    }

    // Ficha técnica geral
    const diffs: string[] = [];
    if (property.is_penthouse) diffs.push("Cobertura");
    if (property.near_beach) diffs.push("Próximo à Praia");
    if (property.has_sea_view) diffs.push("Vista Mar");
    if (property.has_garage || property.parking_spaces > 0) diffs.push("Garagem");
    if (property.has_balcony_grill) diffs.push("Churrasqueira");
    if (property.is_furnished) diffs.push("Mobiliado");
    if (property.is_pet_friendly) diffs.push("Pet Friendly");
    if (property.has_complete_leisure) diffs.push("Lazer Completo");
    amenities.forEach((a) => {
      if (a?.name && !diffs.includes(a.name)) diffs.push(a.name);
    });

    let text = `Aqui estão os detalhes de *${property.title}*${
      isSubUnit && parentDevelopment ? ` (Empreendimento *${buildingTitle}*)` : ""
    }:\n\n`;
    text += `• *Localização:* ${
      property.location || parentDevelopment?.location || property.city || "Consulte"
    }\n`;
    if (property.price_starting_at > 0)
      text += `• *Valor:* ${formatCurrency(property.price_starting_at)}\n`;
    if (property.sq_ft > 0) text += `• *Área:* ${formatNumber(property.sq_ft)}m²\n`;
    if (property.unit_type !== "land") {
      text += `• *Dormitórios:* ${
        property.bedrooms || 0
      } | *Banheiros:* ${Math.max(1, property.bathrooms || 1)}\n`;
    }
    if (diffs.length > 0) text += `• *Diferenciais:* ${diffs.join(", ")}\n`;
    text += `\nPosso lhe mostrar unidades parecidas?`;
    return { text };
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: trimmed,
      timestamp: getNowTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    if (currentLeadId && leadName.trim()) {
      const session = getVisitorSession() || {};
      const prevUnits: string[] =
        Array.isArray(session.visitedUnits) && session.visitedUnits.length > 0
          ? session.visitedUnits
          : [currentUnitLabel];
      const prevQuestions: string[] = Array.isArray(session.questionsLog)
        ? session.questionsLog
        : [];
      const updatedQuestions = [
        ...prevQuestions,
        `[${property.title}] ${trimmed}`,
      ];
      const updatedNotes = buildAttendanceNotes(
        prevUnits,
        updatedQuestions,
        leadPhone.trim()
      );

      sessionStorage.setItem(
        "ledger_chat_visitor",
        JSON.stringify({
          ...session,
          name: leadName.trim(),
          phone: leadPhone.trim(),
          leadId: currentLeadId,
          visitedUnits: prevUnits,
          questionsLog: updatedQuestions,
        })
      );

      supabase.functions
        .invoke("bot-webhook", {
          body: {
            mode: "save_lead",
            propertyId: property.id,
            clientName: leadName.trim(),
            clientPhone: leadPhone.trim(),
            leadId: currentLeadId,
            notes: updatedNotes,
          },
        })
        .catch(() => {});
    }

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === "user" ? "user" : "model",
        text: m.text,
      }));

      const { data, error } = await supabase.functions.invoke("bot-webhook", {
        body: {
          mode: "web_chat",
          propertyId: property.id,
          userMessage: trimmed,
          history: historyPayload,
        },
      });

      if (error || !data?.reply) {
        throw new Error(error?.message || "Fallback local");
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: data.reply,
        timestamp: getNowTime(),
        modeUsed: data.modeUsed === "gemini" ? "gemini" : "local",
        showSimilarCards: !!data.showSimilar,
        showUnitsCards: Array.isArray(data.matchedUnits) && data.matchedUnits.length > 0,
        matchedUnits: data.matchedUnits,
        showLeadForm: !!data.showLeadForm,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const local = generateLocalResponse(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: local.text || "",
          timestamp: getNowTime(),
          showSimilarCards: local.showSimilarCards,
          showUnitsCards: local.showUnitsCards,
          matchedUnits: local.matchedUnits,
          showLeadForm: local.showLeadForm,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClickSimilarUnit = (targetItem: any, isExternalDev = false) => {
    const clickedLabel = isExternalDev
      ? `${targetItem.title} (clicado em similares)`
      : `${buildingTitle} - ${targetItem.title} (clicada em similares)`;

    const session = getVisitorSession() || {};
    const prevUnits: string[] =
      Array.isArray(session.visitedUnits) && session.visitedUnits.length > 0
        ? session.visitedUnits
        : [currentUnitLabel];
    const prevQuestions: string[] = Array.isArray(session.questionsLog)
      ? session.questionsLog
      : [];
    const updatedUnits = [...prevUnits, clickedLabel];
    const activeLeadId = session.leadId || currentLeadId;
    const cleanName = (leadName || session.name || "").trim();
    const cleanPhone = (leadPhone || session.phone || "").trim();

    if (cleanName) {
      const updatedNotes = buildAttendanceNotes(
        updatedUnits,
        prevQuestions,
        cleanPhone
      );

      sessionStorage.setItem(
        "ledger_chat_visitor",
        JSON.stringify({
          ...session,
          name: cleanName,
          phone: cleanPhone,
          leadId: activeLeadId,
          visitedUnits: updatedUnits,
          questionsLog: prevQuestions,
        })
      );

      supabase.functions
        .invoke("bot-webhook", {
          body: {
            mode: "save_lead",
            propertyId: targetItem.id,
            clientName: cleanName,
            clientPhone: cleanPhone,
            leadId: activeLeadId || undefined,
            notes: updatedNotes,
          },
        })
        .catch(() => {});
    }

    navigate(`/view/${targetItem.id}?chat=open`);
  };

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = leadName.trim();
    const cleanPhone = leadPhone.trim();
    if (!cleanName) {
      alert("Por favor, digite seu nome para iniciar o atendimento.");
      return;
    }

    setHasEnteredChat(true);
    if (cleanPhone) setLeadSaved(true);

    const initialUnits = [currentUnitLabel];
    const initialNotes = buildAttendanceNotes(initialUnits, [], cleanPhone);

    try {
      // @ts-ignore
      if (window.fbq) window.fbq("track", "Lead", { content_name: property?.title });
      // @ts-ignore
      if (window.gtag) window.gtag("event", "generate_lead", { item_name: property?.title });

      const { data } = await supabase.functions.invoke("bot-webhook", {
        body: {
          mode: "save_lead",
          propertyId: property.id,
          clientName: cleanName,
          clientPhone: cleanPhone,
          leadId: currentLeadId || undefined,
          notes: initialNotes,
        },
      });

      const savedId = data?.leadId || currentLeadId || null;
      if (savedId) setCurrentLeadId(savedId);

      sessionStorage.setItem(
        "ledger_chat_visitor",
        JSON.stringify({
          name: cleanName,
          phone: cleanPhone,
          leadId: savedId,
          visitedUnits: initialUnits,
          questionsLog: [],
        })
      );
    } catch (err) {
      console.error("Erro ao registrar entrada no chat:", err);
      sessionStorage.setItem(
        "ledger_chat_visitor",
        JSON.stringify({
          name: cleanName,
          phone: cleanPhone,
          leadId: currentLeadId,
          visitedUnits: initialUnits,
          questionsLog: [],
        })
      );
    }
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName.trim()) {
      alert("Por favor, preencha seu Nome.");
      return;
    }

    setSavingLead(true);
    try {
      // @ts-ignore
      if (window.fbq) window.fbq("track", "Lead", { content_name: property?.title });
      // @ts-ignore
      if (window.gtag) window.gtag("event", "generate_lead", { item_name: property?.title });

      const session = getVisitorSession() || {};
      const prevUnits: string[] =
        Array.isArray(session.visitedUnits) && session.visitedUnits.length > 0
          ? session.visitedUnits
          : [currentUnitLabel];
      const prevQuestions: string[] = Array.isArray(session.questionsLog)
        ? session.questionsLog
        : messages.filter((m) => m.sender === "user").map((m) => m.text);
      const updatedNotes = buildAttendanceNotes(
        prevUnits,
        prevQuestions,
        leadPhone.trim()
      );

      const { data } = await supabase.functions.invoke("bot-webhook", {
        body: {
          mode: "save_lead",
          propertyId: property.id,
          clientName: leadName.trim(),
          clientPhone: leadPhone.trim(),
          leadId: currentLeadId || undefined,
          notes: updatedNotes,
        },
      });

      const savedId = data?.leadId || currentLeadId || null;
      if (savedId) setCurrentLeadId(savedId);
      sessionStorage.setItem(
        "ledger_chat_visitor",
        JSON.stringify({
          name: leadName.trim(),
          phone: leadPhone.trim(),
          leadId: savedId,
          visitedUnits: prevUnits,
          questionsLog: prevQuestions,
        })
      );

      setLeadSaved(true);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-lead-ok-${Date.now()}`,
          sender: "bot",
          text: `✅ Perfeito, *${leadName.trim()}*! Seus dados já foram enviados com prioridade para o corretor responsável. Se quiser, clique no botão verde abaixo para continuar agora mesmo no WhatsApp!`,
          timestamp: getNowTime(),
        },
      ]);
    } catch (err) {
      console.error("Erro ao salvar lead:", err);
      setLeadSaved(true);
    } finally {
      setSavingLead(false);
    }
  };

  const openBrokerWhatsApp = () => {
    // @ts-ignore
    if (window.fbq) window.fbq("track", "Lead", { content_name: property?.title });
    // @ts-ignore
    if (window.gtag) window.gtag("event", "generate_lead", { item_name: property?.title });

    if (profile?.whatsapp) {
      const publicUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(
        /\/$/,
        ""
      )}/view/${property.id}`;
      const intro = leadName
        ? `Olá! Sou *${leadName}* e estava no Atendimento Virtual do imóvel *${property.title}* (${buildingTitle}). Gostaria de mais informações!`
        : `Olá! Estava no Atendimento Virtual do imóvel *${property.title}* (${publicUrl}) e gostaria de mais informações!`;
      window.open(
        `https://wa.me/${profile.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
          intro
        )}`,
        "_blank"
      );
    } else {
      alert("Seu contato foi registrado! O corretor entrará em contato em breve.");
    }
  };

  const availableSubUnits = subUnits.filter((u) => u.status === "available");

  return (
    <>
      {/* Botão Flutuante (quando fechado) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-[150] flex items-center gap-3 px-6 py-4 rounded-full bg-primary text-on-primary shadow-2xl hover:scale-105 transition-all duration-300 group border-2 border-white/20"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
          </span>
          <span className="material-symbols-outlined text-2xl">smart_toy</span>
          <div className="text-left">
            <div className="text-xs font-black uppercase tracking-widest leading-none">
              Atendimento Virtual 24h
            </div>
            <div className="text-[10px] opacity-80 font-medium mt-0.5">
              Tire dúvidas e veja unidades na hora
            </div>
          </div>
        </button>
      )}

      {/* Janela do Chat Automatizado */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-[200] w-[calc(100vw-2rem)] sm:w-[430px] h-[640px] max-h-[85vh] bg-surface-container-lowest rounded-3xl shadow-2xl border border-outline-variant/20 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-primary text-on-primary p-4 px-5 flex items-center justify-between gap-2 shadow-md">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center relative shrink-0">
                <span className="material-symbols-outlined text-xl">smart_toy</span>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-primary rounded-full"></span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-headline font-bold text-sm leading-tight break-words">
                  {companyName}
                </h3>
                <p className="text-[11px] opacity-90 leading-snug break-words mt-0.5">
                  {isSubUnit && parentDevelopment
                    ? `${buildingTitle} — ${property.title} • Online`
                    : `${buildingTitle} • Online agora`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors shrink-0"
              title="Minimizar chat"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {!hasEnteredChat ? (
            /* Caixa de Identificação Pré-Chat (Nome obrigatório + Telefone opcional) */
            <div className="flex-1 overflow-y-auto p-6 bg-surface-container-low/60 flex flex-col justify-center">
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 shadow-lg space-y-5">
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">
                      person_pin_circle
                    </span>
                  </div>
                  <h4 className="font-headline font-black text-lg text-on-surface tracking-tight">
                    Bem-vindo ao Atendimento 24h
                  </h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Antes de iniciar o chat sobre{" "}
                    <strong className="text-on-surface">{buildingTitle}</strong>,
                    informe seu nome. Caso queira que o corretor entre em contato
                    depois, deixe também seu número.
                  </p>
                </div>

                <form onSubmit={handleStartChat} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-on-surface uppercase tracking-wider mb-1.5">
                      Seu Nome <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Como podemos te chamar?"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-high text-xs text-on-surface border border-outline-variant/25 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-on-surface uppercase tracking-wider mb-1.5">
                      Seu Número / WhatsApp{" "}
                      <span className="text-on-surface-variant/60 font-normal lowercase">
                        (opcional)
                      </span>
                    </label>
                    <input
                      type="tel"
                      placeholder="(00) 00000-0000 (opcional)"
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-high text-xs text-on-surface border border-outline-variant/25 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!leadName.trim()}
                    className="w-full py-3 rounded-xl bg-primary text-on-primary text-xs font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-40 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <span>Acessar Chat</span>
                    <span className="material-symbols-outlined text-base">
                      arrow_forward
                    </span>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <>
              {/* Lista de Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-container-low/60">
                {messages.map((msg) => {
                  const unitsToRender =
                    msg.matchedUnits || availableSubUnits.slice(0, 5);
                  return (
                    <div key={msg.id} className="space-y-3">
                      <div
                        className={`flex ${
                          msg.sender === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                            msg.sender === "user"
                              ? "bg-primary text-on-primary rounded-br-xs"
                              : "bg-surface-container-lowest text-on-surface border border-outline-variant/15 rounded-bl-xs"
                          }`}
                        >
                          <div>{renderFormattedText(msg.text)}</div>
                          <div
                            className={`text-[9px] mt-1.5 flex items-center justify-end gap-1.5 ${
                              msg.sender === "user"
                                ? "text-on-primary/70"
                                : "text-on-surface-variant/50"
                            }`}
                          >
                            {msg.sender === "bot" && msg.modeUsed === "gemini" && (
                              <span className="text-primary font-bold">✨ IA</span>
                            )}
                            <span>{msg.timestamp}</span>
                          </div>
                        </div>
                      </div>

                      {/* Cards de Unidades Disponíveis do Empreendimento */}
                      {msg.showUnitsCards && unitsToRender.length > 0 && (
                        <div className="space-y-2 pl-2">
                          {unitsToRender.slice(0, 6).map((u: any) => (
                            <div
                              key={u.id}
                              onClick={() => handleClickSimilarUnit(u, false)}
                              className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 hover:border-primary cursor-pointer transition-all flex items-center justify-between gap-2 shadow-xs"
                            >
                              <div>
                                <div className="font-bold text-xs text-on-surface">
                                  {u.title}
                                </div>
                                <div className="text-[10px] text-primary font-bold uppercase">
                                  {getUnitTypeLabel(u)} • {formatNumber(u.sq_ft)}m²
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-black text-xs text-primary">
                                  {u.price_starting_at > 0
                                    ? formatCurrency(u.price_starting_at)
                                    : "Consulte"}
                                </div>
                                <span className="text-[10px] text-primary underline font-bold">
                                  Abrir peça →
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Cards de Imóveis Similares do Corretor */}
                      {msg.showSimilarCards && similarProperties.length > 0 && (
                        <div className="space-y-2.5 pl-2">
                          {similarProperties.map((sim) => (
                            <div
                              key={sim.id}
                              onClick={() => handleClickSimilarUnit(sim, true)}
                              className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 hover:border-primary cursor-pointer transition-all shadow-xs space-y-2"
                            >
                              <div className="font-bold text-xs text-on-surface leading-snug break-words">
                                {sim.title}
                              </div>
                              <div className="flex items-center gap-3">
                                <img
                                  src={
                                    sim.hero_image_url ||
                                    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=400&auto=format&fit=crop"
                                  }
                                  alt={sim.title}
                                  className="w-16 h-14 rounded-lg object-cover shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-[10px] text-on-surface-variant break-words">
                                    {sim.city || sim.location} •{" "}
                                    {formatNumber(sim.sq_ft)}m²
                                  </div>
                                  <div className="font-black text-xs text-primary mt-0.5">
                                    {sim.price_starting_at > 0
                                      ? formatCurrency(sim.price_starting_at)
                                      : "Consulte"}
                                  </div>
                                </div>
                                <span className="material-symbols-outlined text-primary text-lg shrink-0">
                                  chevron_right
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Card de Captura de Lead + Botão Direto pro WhatsApp do Corretor */}
                      {msg.showLeadForm && (
                        <div className="p-4 rounded-2xl bg-surface-container-lowest border-2 border-primary/20 shadow-md space-y-3">
                          {!leadSaved ? (
                            <form onSubmit={handleSaveLead} className="space-y-2.5">
                              <div className="text-xs font-bold text-primary uppercase tracking-wider">
                                Receber Atendimento Personalizado
                              </div>
                              <input
                                type="text"
                                placeholder="Seu nome"
                                value={leadName}
                                onChange={(e) => setLeadName(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-surface-container-high text-xs text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary"
                                required
                              />
                              <input
                                type="tel"
                                placeholder="Seu WhatsApp com DDD (opcional)"
                                value={leadPhone}
                                onChange={(e) => setLeadPhone(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-surface-container-high text-xs text-on-surface border border-outline-variant/20 focus:outline-none focus:border-primary"
                              />
                              <button
                                type="submit"
                                disabled={savingLead}
                                className="w-full py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
                              >
                                {savingLead
                                  ? "Registrando..."
                                  : "Salvar e Solicitar Contato"}
                              </button>
                            </form>
                          ) : null}

                          {profile?.whatsapp && (
                            <button
                              type="button"
                              onClick={openBrokerWhatsApp}
                              className="w-full py-2.5 rounded-lg bg-[#25D366] hover:bg-[#1DA851] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                            >
                              <span className="material-symbols-outlined text-base">
                                chat
                              </span>
                              Chamar Corretor no WhatsApp
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl px-4 py-3 text-xs text-on-surface-variant flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce"></span>
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]"></span>
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]"></span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input de Pergunta Livre */}
              <form
                onSubmit={handleSendText}
                className="p-3 bg-surface-container-lowest border-t border-outline-variant/15 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Pergunte sobre ${buildingTitle}...`}
                  className="flex-1 bg-surface-container-high rounded-xl px-4 py-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isTyping}
                  className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
                >
                  <span className="material-symbols-outlined text-lg">send</span>
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
};
