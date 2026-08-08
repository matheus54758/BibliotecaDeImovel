import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';

interface ViabilidadeResult {
  iptu: string;
  zoneamento: string;
  areaLote: number;
  taxaOcupacao: number;
  coeficienteAproveitamento: number;
  gabaritoPavimentos: number;
  areaMaximaConstruivel: number;
  potencialAdicional: string;
  restricoesAmbientais?: string[];
}

export const LotAnalyzer = () => {
  const { theme } = useTheme();
  const [iptu, setIptu] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ViabilidadeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  
  // Estados da Simulação Econômica
  const [cub, setCub] = useState<number>(2800);
  const [precoVenda, setPrecoVenda] = useState<number>(9500);
  const [cenario, setCenario] = useState<'alta_densidade' | 'alto_padrao' | 'misto'>('alta_densidade');

  // Lógica de cálculo da viabilidade econômica
  const calcularEconomia = () => {
    if (!result) return { custo: 0, vgv: 0, lucro: 0, roi: 0, resumoUnidades: '', tempoEstimadoMeses: 0, valorizacaoAnual: [] };
    
    let areaVendavel = result.areaMaximaConstruivel * 0.8; // 20% perda área comum
    let multiplicadorCusto = 1;
    let multiplicadorVGV = 1;
    let resumoUnidades = '';

    if (cenario === 'alta_densidade') {
      multiplicadorCusto = 1.05; // Mais banheiros/paredes
      multiplicadorVGV = 1.1; // Maior liquidez e preço por m2 de studios
      const qtdStudios = Math.floor((areaVendavel * 0.8) / 35);
      const qtd1Dorm = Math.floor((areaVendavel * 0.2) / 50);
      resumoUnidades = `~${qtdStudios} Studios (35m²) + ~${qtd1Dorm} Aptos (50m²) em até ${result.gabaritoPavimentos} andares`;
    } else if (cenario === 'alto_padrao') {
      multiplicadorCusto = 1.25; // Acabamentos de luxo
      multiplicadorVGV = 1.3; // Ticket alto
      areaVendavel = result.areaMaximaConstruivel * 0.85; // Menos corredores
      const qtdAltoPadrao = Math.floor(areaVendavel / 150);
      resumoUnidades = `~${qtdAltoPadrao} Apts Exclusivos (150m²) em até ${result.gabaritoPavimentos} andares`;
    } else if (cenario === 'misto') {
      multiplicadorCusto = 1.1;
      multiplicadorVGV = 1.15; 
      const areaComercial = Math.floor(areaVendavel * 0.3);
      const areaResidencial = areaVendavel - areaComercial;
      const qtdLojas = Math.floor(areaComercial / 60);
      const qtdAptos = Math.floor(areaResidencial / 70);
      const andaresRes = Math.max(1, result.gabaritoPavimentos - 1);
      resumoUnidades = `~${qtdLojas} Lojas (Térreo) + ~${qtdAptos} Aptos em ${andaresRes} andares`;
    }

    const custo = result.areaMaximaConstruivel * cub * multiplicadorCusto;
    const vgv = areaVendavel * precoVenda * multiplicadorVGV;
    const lucro = vgv - custo;
    const roi = (lucro / custo) * 100;

    // Cálculo do tempo estimado de obra (Heurística básica)
    let mesesBase = 12; // Fundações e estrutura básica mínima
    const impactoArea = (result.areaMaximaConstruivel / 1000) * 1.5; // 1.5 meses a cada 1000m²
    const impactoAndares = result.gabaritoPavimentos * 0.5; // 0.5 meses por andar
    let tempoObra = mesesBase + impactoArea + impactoAndares;
    
    if (cenario === 'alto_padrao') tempoObra *= 1.25; // Acabamentos refinados levam mais tempo
    if (cenario === 'misto') tempoObra *= 1.1; // Logística mista

    const tempoEstimadoMeses = Math.round(tempoObra);

    // Valorização anual (projeção conservadora de 10% a.a. na planta)
    const anosObra = Math.max(1, Math.ceil(tempoEstimadoMeses / 12));
    const taxaValorizacaoAnual = 0.10;
    const valorizacaoAnual = [];
    let vgvAtual = vgv;
    
    for (let i = 1; i <= anosObra; i++) {
      vgvAtual = vgvAtual * (1 + taxaValorizacaoAnual);
      valorizacaoAnual.push({
        ano: i,
        vgvProjetado: vgvAtual
      });
    }

    return { custo, vgv, lucro, roi, resumoUnidades, tempoEstimadoMeses, valorizacaoAnual };
  };

  const economia = calcularEconomia();
  
  // Histórico de IPTUs
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('iptu_history');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const addToHistory = (searched: string) => {
    const newHistory = [searched, ...history.filter(h => h !== searched)].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem('iptu_history', JSON.stringify(newHistory));
  };

  // Para seleção de terrenos existentes
  const [lands, setLands] = useState<any[]>([]);
  const [selectedLandId, setSelectedLandId] = useState<string>('');
  const [showLandSelect, setShowLandSelect] = useState(false);

  useEffect(() => {
    async function fetchLands() {
      const { data } = await supabase
        .from('developments')
        .select('id, title, street')
        .eq('unit_type', 'land');
      if (data) setLands(data);
    }
    fetchLands();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!iptu) return;

    setLoading(true);
    setError(null);

    let tentativas = 0;
    const maxTentativas = 3;
    let sucesso = false;

    while (tentativas < maxTentativas && !sucesso) {
      try {
        // Fazendo a chamada real para a Edge Function no Supabase
        const { data, error: functionError } = await supabase.functions.invoke('geoportal-viabilidade', {
          body: { iptu }
        });

        if (functionError) {
          throw new Error(functionError.message || "Erro de conexão com o servidor.");
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        setResult(data as ViabilidadeResult);
        setSaveSuccess(false); // reseta o status ao fazer nova busca
        addToHistory(iptu);
        sucesso = true;
      } catch (err: any) {
        tentativas++;
        if (tentativas >= maxTentativas) {
          const msgBase = err.message || 'Erro desconhecido.';
          const isNotFound = msgBase.toLowerCase().includes('não foi encontrado');
          
          if (isNotFound) {
            setError(`O IPTU informado não foi encontrado na base da Prefeitura. Verifique se o número está correto.`);
          } else {
            setError(`Falha após ${maxTentativas} tentativas. O sistema da Prefeitura (GeoFloripa) pode estar instável, em manutenção, ou bloqueando o acesso temporariamente. Aguarde alguns minutos e tente de novo. (Detalhe técnico: ${msgBase})`);
          }
          setResult(null);
        } else {
          // Espera 2 segundos antes da próxima tentativa
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    setLoading(false);
  };

  const handleSaveToLand = async () => {
    if (!selectedLandId || !result) return;
    setSaving(true);
    
    try {
      // Pega o terreno atual para anexar na descrição
      const { data: currentLand } = await supabase
        .from('developments')
        .select('description')
        .eq('id', selectedLandId)
        .single();

      const viabilityText = `\n\n--- ESTUDO DE VIABILIDADE (IPTU: ${result.iptu}) ---\nZoneamento: ${result.zoneamento}\nÁrea Máxima Construível: ${result.areaMaximaConstruivel} m²\nGabarito: ${result.gabaritoPavimentos} Pavimentos\nTaxa de Ocupação: ${result.taxaOcupacao}%\nCoeficiente de Aproveitamento: ${result.coeficienteAproveitamento}\nData da Consulta: ${new Date().toLocaleDateString('pt-BR')}`;
      
      const newDescription = (currentLand?.description || '') + viabilityText;

      const { error } = await supabase
        .from('developments')
        .update({ 
          description: newDescription,
          sq_ft: result.areaLote // Atualiza a área do lote também
        })
        .eq('id', selectedLandId);

      if (error) throw error;
      
      setSaveSuccess(true);
      setShowLandSelect(false);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar no terreno.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    
    // Criação do documento PDF (Portrait, pontos, tamanho A4)
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Cores (Luxury Theme)
    const hexToRgb = (hex: string): [number, number, number] => {
      const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return res ? [parseInt(res[1], 16), parseInt(res[2], 16), parseInt(res[3], 16)] : [212, 175, 55];
    };
    const primary = theme?.primary_color ? hexToRgb(theme.primary_color) : [212, 175, 55]; // Dourado
    const bgDark = [24, 24, 27]; // Zinc 900
    const surface = [39, 39, 42]; // Zinc 800
    
    // Fundo Escuro
    doc.setFillColor(bgDark[0], bgDark[1], bgDark[2]);
    doc.rect(0, 0, pageWidth, 842, 'F');
    
    // Header
    doc.setFillColor(primary[0], primary[1], primary[2]);
    doc.rect(0, 0, pageWidth, 120, 'F');
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("ESTUDO DE VIABILIDADE TÉCNICA", 40, 60);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`${theme?.company_name || 'The Architectural Ledger'} - Inteligência Imobiliária`, 40, 85);
    
    // IPTU / Info
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.setFontSize(14);
    doc.text(`Inscrição Imobiliária (IPTU): ${result.iptu}`, 40, 160);
    doc.text(`Data da Consulta: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 40, 160, { align: 'right' });
    
    // Linha divisória
    doc.setDrawColor(primary[0], primary[1], primary[2]);
    doc.setLineWidth(1);
    doc.line(40, 180, pageWidth - 40, 180);
    
    // Caixas de Dados Urbanísticos
    const startY = 220;
    
    // Box 1: Zoneamento
    doc.setFillColor(surface[0], surface[1], surface[2]);
    doc.roundedRect(40, startY, 240, 80, 5, 5, 'F');
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(10);
    doc.text("ZONEAMENTO DIRETOR", 55, startY + 25);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(result.zoneamento, 55, startY + 55);

    // Box 2: Área do Lote
    doc.setFillColor(surface[0], surface[1], surface[2]);
    doc.roundedRect(315, startY, 240, 80, 5, 5, 'F');
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("ÁREA TOTAL DO LOTE", 330, startY + 25);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`${result.areaLote.toLocaleString()} m²`, 330, startY + 55);

    // Box 3: Área Máx Construível
    doc.setFillColor(surface[0], surface[1], surface[2]);
    doc.roundedRect(40, startY + 100, 240, 80, 5, 5, 'F');
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("POTENCIAL CONSTRUTIVO MÁXIMO", 55, startY + 125);
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(`${result.areaMaximaConstruivel.toLocaleString()} m²`, 55, startY + 155);

    // Box 4: Parâmetros Urbanísticos
    doc.setFillColor(surface[0], surface[1], surface[2]);
    doc.roundedRect(315, startY + 100, 240, 80, 5, 5, 'F');
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("PARÂMETROS BASE", 330, startY + 125);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Gabarito: ${result.gabaritoPavimentos} Pavimentos`, 330, startY + 145);
    doc.text(`Taxa de Ocupação: ${result.taxaOcupacao}%`, 330, startY + 160);
    doc.text(`Coef. Aproveitamento: ${result.coeficienteAproveitamento}`, 330, startY + 175);

    // Box Ambiental
    const envY = startY + 200;
    const hasRestricoes = result.restricoesAmbientais && result.restricoesAmbientais.length > 0;
    
    if (hasRestricoes) {
      doc.setFillColor(50, 25, 25); // Fundo avermelhado escuro
      doc.roundedRect(40, envY, 515, 60, 5, 5, 'F');
      doc.setTextColor(255, 100, 100);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("ATENÇÃO: RESTRIÇÕES AMBIENTAIS DETECTADAS", 55, envY + 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(result.restricoesAmbientais![0], 55, envY + 40);
    } else {
      doc.setFillColor(25, 50, 35); // Fundo esverdeado escuro
      doc.roundedRect(40, envY, 515, 60, 5, 5, 'F');
      doc.setTextColor(100, 255, 150);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("CONSULTA AMBIENTAL: TERRENO LIMPO", 55, envY + 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Sem sobreposição com Áreas de Preservação Permanente (APP) mapeadas.", 55, envY + 40);
    }

    // Viabilidade Econômica
    const ecoY = envY + 90;
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    
    const cenarioNome = cenario === 'alta_densidade' ? 'ALTA DENSIDADE' : cenario === 'alto_padrao' ? 'ALTO PADRÃO' : 'MISTO';
    doc.text(`SIMULAÇÃO ECONÔMICA (CENÁRIO: ${cenarioNome})`, 40, ecoY);
    
    doc.setDrawColor(primary[0], primary[1], primary[2]);
    doc.setLineWidth(0.5);
    doc.line(40, ecoY + 10, pageWidth - 40, ecoY + 10);
    
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(11);
    doc.setFont("helvetica", "italic");
    doc.text(`Produto Simulado: ${economia.resumoUnidades}`, 40, ecoY + 30);
    doc.text(`Prazo Est. de Obra: ${economia.tempoEstimadoMeses} meses`, pageWidth - 40, ecoY + 30, { align: 'right' });
    
    // Cards Econômicos
    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    
    doc.setFillColor(surface[0], surface[1], surface[2]);
    doc.roundedRect(40, ecoY + 45, 160, 60, 5, 5, 'F');
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("CUSTO ESTIMADO", 50, ecoY + 65);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(economia.custo), 50, ecoY + 90);
    
    doc.setFillColor(surface[0], surface[1], surface[2]);
    doc.roundedRect(215, ecoY + 45, 160, 60, 5, 5, 'F');
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("VGV PROJETADO", 225, ecoY + 65);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(economia.vgv), 225, ecoY + 90);
    
    doc.setFillColor(primary[0], primary[1], primary[2]);
    doc.roundedRect(390, ecoY + 45, 165, 60, 5, 5, 'F');
    doc.setTextColor(bgDark[0], bgDark[1], bgDark[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`LUCRO (${economia.roi.toFixed(1)}% ROI)`, 400, ecoY + 65);
    doc.setFontSize(13);
    doc.text(formatCurrency(economia.lucro), 400, ecoY + 90);

    // Projeção de Valorização (PDF)
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    const vgvFinal = economia.valorizacaoAnual[economia.valorizacaoAnual.length - 1].vgvProjetado;
    doc.text(`* Projeção VGV na entrega das chaves (+10% a.a.): ${formatCurrency(vgvFinal)}`, 40, ecoY + 120);
    
    // Recomendação Estratégica (Encurtada)
    const recY = ecoY + 140;
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("ESTRATÉGIA URBANA", 40, recY);
    doc.line(40, recY + 10, pageWidth - 40, recY + 10);
    
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    const textRec = `O terreno possui vocação para desenvolvimento, permitindo até ${((result.areaLote * result.taxaOcupacao) / 100).toLocaleString()} m² de ocupação no solo. Com CA de ${result.coeficienteAproveitamento} e gabarito de ${result.gabaritoPavimentos} pavimentos, explorar o potencial máximo gera a melhor rentabilidade.`;
    const splitTextRec = doc.splitTextToSize(textRec, 515);
    doc.text(splitTextRec, 40, recY + 30);

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Documento gerado automaticamente pela inteligência de The Architectural Ledger.", pageWidth / 2, 800, { align: 'center' });

    doc.save(`Viabilidade_${result.iptu.replace(/\D/g, '')}.pdf`);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in pb-24 md:pb-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-headline text-on-surface">Consulta de Viabilidade</h1>
        <p className="text-on-surface/60 font-body mt-2">
          Consulte o potencial construtivo de um lote integrado ao GeoFloripa (Simulação).
        </p>
      </div>

      <div className="bg-surface-container-low p-6 md:p-8 rounded-lg mb-8 relative">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-label text-on-surface mb-2">Inscrição Imobiliária (IPTU)</label>
            <input
              type="text"
              value={iptu}
              onChange={(e) => setIptu(e.target.value)}
              placeholder="Ex: 12.34.056.0789-0"
              className="w-full bg-background border-b-2 border-on-surface/20 px-4 py-3 text-on-surface font-body focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !iptu}
            className="w-full md:w-auto px-8 py-3 bg-gradient-primary text-on-primary rounded-md font-label hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center min-w-[160px]"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin">sync</span>
            ) : (
              <>
                <span className="material-symbols-outlined mr-2">search</span>
                Analisar Lote
              </>
            )}
          </button>
        </form>
        {history.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-on-surface/50 font-label">Consultas Recentes:</span>
            {history.map((h, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setIptu(h)}
                className="px-3 py-1 bg-surface-container-high border border-on-surface/10 rounded-full text-xs text-on-surface/80 hover:border-primary/50 hover:text-primary transition-colors cursor-pointer"
              >
                {h}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-error font-body text-sm mt-4">{error}</p>}
      </div>

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up">
          <div className="bg-surface-container-low p-6 rounded-lg border-t-4 border-primary">
            <div className="flex justify-between items-start mb-4">
              <span className="material-symbols-outlined text-primary text-3xl">map</span>
            </div>
            <p className="text-sm text-on-surface/60 font-label mb-1">Zoneamento (GeoFloripa)</p>
            <p className="text-xl font-headline text-on-surface">{result.zoneamento}</p>
          </div>

          <div className="bg-surface-container-low p-6 rounded-lg border-t-4 border-primary">
            <div className="flex justify-between items-start mb-4">
              <span className="material-symbols-outlined text-primary text-3xl">aspect_ratio</span>
            </div>
            <p className="text-sm text-on-surface/60 font-label mb-1">Área do Lote</p>
            <p className="text-xl font-headline text-on-surface">{result.areaLote.toLocaleString()} m²</p>
          </div>

          <div className="bg-surface-container-low p-6 rounded-lg border-t-4 border-primary">
            <div className="flex justify-between items-start mb-4">
              <span className="material-symbols-outlined text-primary text-3xl">business</span>
            </div>
            <p className="text-sm text-on-surface/60 font-label mb-1">Área Máx. Construível</p>
            <p className="text-xl font-headline text-on-surface">{result.areaMaximaConstruivel.toLocaleString()} m²</p>
            <p className="text-xs text-on-surface/50 mt-2">CA: {result.coeficienteAproveitamento}</p>
          </div>

          <div className="bg-surface-container-low p-6 rounded-lg border-t-4 border-primary">
            <div className="flex justify-between items-start mb-4">
              <span className="material-symbols-outlined text-primary text-3xl">domain</span>
            </div>
            <p className="text-sm text-on-surface/60 font-label mb-1">Parâmetros Urbanísticos</p>
            <p className="text-lg font-headline text-on-surface">Gabarito: {result.gabaritoPavimentos} Pav.</p>
            <p className="text-sm text-on-surface/60 mt-1">Taxa Ocupação: {result.taxaOcupacao}%</p>
          </div>
          
          <div className="md:col-span-2 lg:col-span-4 bg-surface-container-low p-6 rounded-lg flex items-center gap-4">
            <span className="material-symbols-outlined text-primary text-3xl flex-shrink-0">info</span>
            <div>
               <p className="font-label text-on-surface">Informação Adicional</p>
               <p className="font-body text-sm text-on-surface/60">{result.potencialAdicional}</p>
            </div>
          </div>
          
          {/* AI Recommendation Panel */}
          <div className="md:col-span-2 lg:col-span-4 bg-gradient-primary/5 border border-primary/20 p-8 rounded-lg mt-4 flex flex-col md:flex-row gap-6">
            <div className="flex-shrink-0 mt-1">
               <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                 <span className="material-symbols-outlined text-2xl">lightbulb</span>
               </div>
            </div>
            <div>
               <h3 className="text-xl font-headline font-bold text-on-surface mb-2">Recomendação Estratégica</h3>
               <p className="font-body text-on-surface/80 leading-relaxed">
                 Com um potencial construtivo máximo de <strong>{result.areaMaximaConstruivel.toLocaleString()} m²</strong> em um zoneamento <strong>{result.zoneamento}</strong>, este terreno apresenta uma excelente vocação para desenvolvimento imobiliário. 
               </p>
               <ul className="mt-4 space-y-2 font-body text-on-surface/80">
                 <li className="flex items-start">
                   <span className="material-symbols-outlined text-primary text-sm mr-2 mt-1">check_circle</span>
                   <span><strong>Perfil Ideal:</strong> Devido ao gabarito de {result.gabaritoPavimentos} pavimentos, o lote é ideal para {result.zoneamento.includes('AMC') ? 'um empreendimento misto (lojas no térreo e apartamentos compactos nos andares superiores)' : 'um condomínio residencial de médio padrão (apartamentos de 2 a 3 dormitórios com infraestrutura de lazer)'}.</span>
                 </li>
                 <li className="flex items-start">
                   <span className="material-symbols-outlined text-primary text-sm mr-2 mt-1">check_circle</span>
                   <span><strong>Projeção de Construção:</strong> Estima-se que o potencial construtivo comporte a construção de aproximadamente <strong>{Math.floor(result.areaMaximaConstruivel / 45)} Studios</strong> (considerando ~45m² de área global por unidade) OU <strong>{Math.floor(result.areaMaximaConstruivel / 85)} Apartamentos de 2 Dormitórios</strong> (~85m² área global por unidade). Isso serve como uma base rápida para prever seu VGV.</span>
                 </li>
                 <li className="flex items-start">
                   <span className="material-symbols-outlined text-primary text-sm mr-2 mt-1">check_circle</span>
                   <span><strong>Ocupação Térrea:</strong> A taxa de ocupação de {result.taxaOcupacao}% permite utilizar até {((result.areaLote * result.taxaOcupacao) / 100).toLocaleString()} m² de "pegada" no solo. Isso deixa um espaço generoso para paisagismo, áreas permeáveis ou vagas de garagem no térreo.</span>
                 </li>
                 <li className="flex items-start">
                   <span className="material-symbols-outlined text-primary text-sm mr-2 mt-1">check_circle</span>
                   <span><strong>VGV Estimado:</strong> Levando em consideração as diretrizes do plano diretor local, explorar o Coeficiente de Aproveitamento máximo ({result.coeficienteAproveitamento}) trará a melhor rentabilidade (ROI) para o metro quadrado adquirido.</span>
                 </li>
               </ul>
            </div>
          </div>
          
          {/* Environmental Risks Panel */}
          <div className={`md:col-span-2 lg:col-span-4 p-8 rounded-lg mt-4 flex flex-col md:flex-row gap-6 border ${result.restricoesAmbientais && result.restricoesAmbientais.length > 0 ? 'bg-error/10 border-error/30 text-error' : 'bg-green-500/10 border-green-500/30 text-green-700'}`}>
            <div className="flex-shrink-0 mt-1">
               <div className={`w-12 h-12 rounded-full flex items-center justify-center ${result.restricoesAmbientais && result.restricoesAmbientais.length > 0 ? 'bg-error/20 text-error' : 'bg-green-500/20 text-green-700'}`}>
                 <span className="material-symbols-outlined text-2xl">{result.restricoesAmbientais && result.restricoesAmbientais.length > 0 ? 'warning' : 'verified_user'}</span>
               </div>
            </div>
            <div>
               <h3 className="text-xl font-headline font-bold mb-2">
                 {result.restricoesAmbientais && result.restricoesAmbientais.length > 0 ? 'Restrições e Riscos Ambientais Detectados' : 'Consulta Ambiental: Terreno Limpo'}
               </h3>
               {result.restricoesAmbientais && result.restricoesAmbientais.length > 0 ? (
                 <ul className="mt-2 space-y-2 font-body text-error/80">
                   {result.restricoesAmbientais.map((r, i) => (
                     <li key={i} className="flex items-start">
                       <span className="material-symbols-outlined text-sm mr-2 mt-1">error</span>
                       <span>{r}</span>
                     </li>
                   ))}
                 </ul>
               ) : (
                 <p className="font-body opacity-80">
                   A nossa varredura não identificou sobreposição com Áreas de Preservação Permanente (APP) ou riscos geológicos graves no GeoFloripa para este lote.
                 </p>
               )}
            </div>
          </div>

          {/* Economic Viability Simulator Panel */}
          <div className="md:col-span-2 lg:col-span-4 bg-surface-container-high border border-on-surface/10 p-8 rounded-lg mt-4">
            <h3 className="text-2xl font-headline font-bold text-on-surface mb-6 flex items-center">
              <span className="material-symbols-outlined text-primary mr-3 text-3xl">monitoring</span>
              Simulador de Viabilidade Econômica
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-6">
                <div>
                  <label className="block text-sm font-label text-on-surface/70 mb-2">CUB (Custo Unitário Básico) - R$/m²</label>
                  <input
                    type="number"
                    value={cub}
                    onChange={(e) => setCub(Number(e.target.value))}
                    className="w-full bg-background border-b-2 border-on-surface/20 px-4 py-2 text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-label text-on-surface/70 mb-2">Preço Médio de Venda - R$/m²</label>
                  <input
                    type="number"
                    value={precoVenda}
                    onChange={(e) => setPrecoVenda(Number(e.target.value))}
                    className="w-full bg-background border-b-2 border-on-surface/20 px-4 py-2 text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-label text-on-surface/70 mb-3">Estratégia Arquitetônica (Cenário)</label>
                  <div className="space-y-3">
                    <button 
                      onClick={() => setCenario('alta_densidade')}
                      className={`w-full text-left px-4 py-3 rounded-md text-sm font-label border transition-colors flex items-center ${cenario === 'alta_densidade' ? 'bg-primary/10 border-primary text-primary' : 'bg-transparent border-on-surface/20 text-on-surface/70 hover:border-primary/50'}`}
                    >
                      <span className="material-symbols-outlined mr-3 text-lg">apartment</span>
                      Alta Densidade (Foco: Investidores / Aluguel)
                    </button>
                    <button 
                      onClick={() => setCenario('alto_padrao')}
                      className={`w-full text-left px-4 py-3 rounded-md text-sm font-label border transition-colors flex items-center ${cenario === 'alto_padrao' ? 'bg-primary/10 border-primary text-primary' : 'bg-transparent border-on-surface/20 text-on-surface/70 hover:border-primary/50'}`}
                    >
                      <span className="material-symbols-outlined mr-3 text-lg">diamond</span>
                      Alto Padrão (Foco: Exclusividade / Famílias)
                    </button>
                    <button 
                      onClick={() => setCenario('misto')}
                      className={`w-full text-left px-4 py-3 rounded-md text-sm font-label border transition-colors flex items-center ${cenario === 'misto' ? 'bg-primary/10 border-primary text-primary' : 'bg-transparent border-on-surface/20 text-on-surface/70 hover:border-primary/50'}`}
                    >
                      <span className="material-symbols-outlined mr-3 text-lg">storefront</span>
                      Comercial + Residencial (Foco: Renda Passiva)
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="lg:col-span-2 flex flex-col justify-center">
                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg mb-6 relative">
                  <div className="absolute top-4 right-4 flex items-center bg-background px-3 py-1 rounded-full border border-primary/20 text-primary font-label text-xs">
                    <span className="material-symbols-outlined text-sm mr-1">schedule</span>
                    Prazo Est.: {economia.tempoEstimadoMeses} meses
                  </div>
                  <p className="text-sm font-label text-primary/80 mb-1">O que está sendo simulado?</p>
                  <p className="text-lg font-headline text-on-surface font-semibold pr-40">{economia.resumoUnidades}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-background p-6 rounded-lg border border-on-surface/10">
                    <p className="text-sm font-label text-on-surface/60 mb-1">Custo Estimado da Obra</p>
                    <p className="text-2xl font-headline text-on-surface font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(economia.custo)}
                    </p>
                  </div>
                  <div className="bg-background p-6 rounded-lg border border-on-surface/10">
                    <p className="text-sm font-label text-on-surface/60 mb-1">VGV Projetado (Vendas)</p>
                    <p className="text-2xl font-headline text-on-surface font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(economia.vgv)}
                    </p>
                  </div>
                  <div className="bg-primary/10 p-6 rounded-lg border border-primary/30 md:col-span-2 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-label text-primary/80 mb-1">Lucro Bruto Projetado</p>
                      <p className="text-3xl font-headline text-primary font-bold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(economia.lucro)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-label text-primary/80 mb-1">ROI</p>
                      <p className="text-2xl font-headline text-primary font-bold">{economia.roi.toFixed(1)}%</p>
                    </div>
                  </div>
                  
                  {/* Tabela de Valorização */}
                  <div className="bg-surface-container-low p-5 rounded-lg border border-on-surface/10 md:col-span-2 mt-2">
                    <p className="text-sm font-label text-on-surface/80 mb-3 flex items-center">
                      <span className="material-symbols-outlined text-primary text-sm mr-2">trending_up</span>
                      Projeção de Valorização (VGV na Planta - Est. de +10% a.a.)
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {economia.valorizacaoAnual.map((val: any, idx: number) => (
                        <div key={idx} className="flex-1 min-w-[130px] bg-background/50 border border-on-surface/5 p-3 rounded-md text-center">
                          <p className="text-xs font-label text-on-surface/50 mb-1">Ano {val.ano}</p>
                          <p className="text-sm font-headline text-on-surface font-semibold text-primary truncate" title={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val.vgvProjetado)}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val.vgvProjetado)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs font-body text-on-surface/40 mt-4 text-center">
                  * Valores baseados na Área Máx Construível (- circulação). Projeção de valorização de 10% a.a. Simulação apenas para referência.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="md:col-span-2 lg:col-span-4 mt-6 flex justify-end">
             {saveSuccess ? (
                <div className="bg-green-100 text-green-800 px-6 py-3 rounded-md flex items-center font-label">
                  <span className="material-symbols-outlined mr-2">check_circle</span>
                  Salvo no Terreno com Sucesso!
                </div>
             ) : showLandSelect ? (
                <div className="flex items-center gap-4 bg-surface-container-high p-4 rounded-lg w-full md:w-auto">
                  <div className="flex-1">
                    <label className="block text-xs font-label text-on-surface/60 mb-1">Selecione o Terreno Cadastrado</label>
                    <select 
                      className="w-full md:w-64 bg-background border-b-2 border-on-surface/20 px-4 py-2 text-on-surface font-body focus:outline-none focus:border-primary"
                      value={selectedLandId}
                      onChange={(e) => setSelectedLandId(e.target.value)}
                    >
                      <option value="">Escolha um terreno...</option>
                      {lands.map(l => (
                        <option key={l.id} value={l.id}>{l.title} {l.street ? `- ${l.street}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <button 
                    onClick={handleSaveToLand}
                    disabled={saving || !selectedLandId}
                    className="px-6 py-2 bg-gradient-primary text-on-primary rounded-md font-label hover:opacity-90 disabled:opacity-50 flex items-center"
                  >
                    {saving ? <span className="material-symbols-outlined animate-spin mr-2">sync</span> : <span className="material-symbols-outlined mr-2">check</span>}
                    Confirmar
                  </button>
                  <button onClick={() => setShowLandSelect(false)} className="px-4 py-2 text-on-surface/60 hover:text-on-surface">
                    Cancelar
                  </button>
                </div>
             ) : (
                <button 
                  onClick={() => setShowLandSelect(true)}
                  className="px-8 py-3 bg-surface-container-high border-2 border-primary text-primary rounded-md font-label hover:bg-primary hover:text-on-primary transition-colors flex items-center"
                >
                  <span className="material-symbols-outlined mr-2">save</span>
                  Vincular a um Terreno Cadastrado
                </button>
             )}
             
             {/* PDF Button */}
             {!showLandSelect && !saveSuccess && (
                <button 
                  onClick={handleDownloadPDF}
                  className="px-8 py-3 bg-surface-container-high border-2 border-primary/50 text-primary rounded-md font-label hover:bg-primary/10 transition-colors flex items-center ml-4"
                >
                  <span className="material-symbols-outlined mr-2">picture_as_pdf</span>
                  Gerar Relatório (PDF)
                </button>
             )}
          </div>

        </div>
      )}
    </div>
  );
};
