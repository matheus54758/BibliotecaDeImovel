import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
}

export const LotAnalyzer = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [iptu, setIptu] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ViabilidadeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  
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
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao consultar o IPTU.');
      setResult(null);
    } finally {
      setLoading(false);
    }
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
    
    // Caixas de Dados
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

    // Recomendação Estratégica
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.setFontSize(14);
    doc.text("RECOMENDAÇÃO ESTRATÉGICA", 40, startY + 230);
    
    doc.setDrawColor(primary[0], primary[1], primary[2]);
    doc.line(40, startY + 240, pageWidth - 40, startY + 240);

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    
    const text1 = `Com um potencial construtivo de ${result.areaMaximaConstruivel.toLocaleString()} m² em zoneamento ${result.zoneamento}, este terreno apresenta uma excelente vocação para desenvolvimento imobiliário.`;
    const splitText1 = doc.splitTextToSize(text1, 515);
    doc.text(splitText1, 40, startY + 270);
    
    const text2 = `- Perfil Ideal: Lote ideal para ${result.zoneamento.includes('AMC') ? 'empreendimento misto (lojas no térreo e residências)' : 'condomínio residencial de médio padrão'}.`;
    const splitText2 = doc.splitTextToSize(text2, 515);
    doc.text(splitText2, 40, startY + 300);

    const qtdStudios = Math.floor(result.areaMaximaConstruivel / 45);
    const qtdDoisDorms = Math.floor(result.areaMaximaConstruivel / 85);
    const textExtra = `- Projeção de Construção: Estima-se comportar até ~${qtdStudios} Studios (45m² globais) ou ~${qtdDoisDorms} Apartamentos de 2 Dorms (85m²).`;
    const splitTextExtra = doc.splitTextToSize(textExtra, 515);
    doc.text(splitTextExtra, 40, startY + 325);

    const text3 = `- Ocupação Térrea: A taxa de ${result.taxaOcupacao}% permite até ${((result.areaLote * result.taxaOcupacao) / 100).toLocaleString()} m² de ocupação no térreo.`;
    const splitText3 = doc.splitTextToSize(text3, 515);
    doc.text(splitText3, 40, startY + 350);
    
    const text4 = `- VGV Estimado: Explorar o CA máximo (${result.coeficienteAproveitamento}) trará a melhor rentabilidade (ROI) para o projeto.`;
    const splitText4 = doc.splitTextToSize(text4, 515);
    doc.text(splitText4, 40, startY + 375);

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
