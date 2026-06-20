import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { formatCurrency, formatNumber } from "../lib/utils";
import { generatePropertyPDF } from "../lib/pdf";
import { useUserTier } from "../hooks/useUserTier";
import { useTheme } from "../hooks/useTheme";
import { FloorPlanCropper } from "../components/FloorPlanCropper";
import { InvestmentSimulatorModal } from "../components/InvestmentSimulatorModal";

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configuração do Worker do PDF.js compatível com Vite/Browser (Local via Vite)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const PropertyDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { tier } = useUserTier();
  const { theme } = useTheme();
  const [property, setProperty] = useState<any>(null);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [subUnits, setSubUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{url: string, type: 'image' | 'video'} | null>(null);
  const [processingPdf, setProcessingPdf] = useState(false);
  const [selling, setSelling] = useState(false);
  const [updateReport, setUpdateReport] = useState<{
    unit: string;
    oldPrice: number;
    newPrice: number;
    status: 'updated' | 'inserted' | 'no_change' | 'error';
    error?: string;
  }[] | null>(null);

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [bulkPercent, setBulkPercent] = useState<number>(0);
  const [bulkCubRate, setBulkCubRate] = useState<number>(0);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [isFloorPlanModalOpen, setIsFloorPlanModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [processingFloorPlanPdf, setProcessingFloorPlanPdf] = useState(false);
  const [floorPlansExtracted, setFloorPlansExtracted] = useState<any[]>([]);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0, message: "" });
  const [floorPlanPdfUrl, setFloorPlanPdfUrl] = useState<string | null>(null);
  const [activePlanToCrop, setActivePlanToCrop] = useState<any>(null);
  const [croppedImagesToAssociate, setCroppedImagesToAssociate] = useState<{name: string, dataUrl: string} | null>(null);
  const [associationSelectedUnits, setAssociationSelectedUnits] = useState<string[]>([]);
  const [isAssociating, setIsAssociating] = useState(false);

  const handleFloorPlanPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingFloorPlanPdf(true);
    setExtractionProgress({ current: 0, total: 0, message: "Iniciando motor visual..." });
    setFloorPlansExtracted([]);
    
    try {
      console.log("Iniciando leitura do PDF:", file.name, "Tamanho:", file.size);
      const fileUrl = URL.createObjectURL(file);
      setFloorPlanPdfUrl(fileUrl);
      const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      console.log("PDF carregado com sucesso. Total de páginas:", numPages);
      
      setExtractionProgress({ current: 0, total: numPages, message: "Fatiando páginas do PDF..." });

      const batchSize = 5;
      const allExtractedPlans = [];

      for (let i = 1; i <= numPages; i += batchSize) {
        const batchImages = [];
        const endPage = Math.min(i + batchSize - 1, numPages);
        
        setExtractionProgress({ current: i, total: numPages, message: `Renderizando imagens: Páginas ${i} a ${endPage}` });
        
        for (let j = i; j <= endPage; j++) {
           const page = await pdf.getPage(j);
           const viewport = page.getViewport({ scale: 1.5 }); // Escala 1.5 para boa legibilidade
           const canvas = document.createElement('canvas');
           const context = canvas.getContext('2d');
           if (context) {
             canvas.width = viewport.width;
             canvas.height = viewport.height;
             await page.render({ canvasContext: context, viewport } as any).promise;
             // JPG com compressão 0.8 garante arquivo muito leve
             const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
             batchImages.push({ index: j, base64, mimeType: 'image/jpeg' });
           }
        }
        
        setExtractionProgress({ current: endPage, total: numPages, message: `Analisando páginas ${i} a ${endPage} com IA...` });
        
        const { data, error } = await supabase.functions.invoke('process-floor-plans-ai', {
           body: { images: batchImages }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.details || data.error);
        if (data?.plans) {
           allExtractedPlans.push(...data.plans);
        }
      }

      setFloorPlansExtracted(allExtractedPlans);
      setExtractionProgress({ current: numPages, total: numPages, message: "Mágica concluída!" });
      
      if (allExtractedPlans.length === 0) {
        URL.revokeObjectURL(fileUrl); // Limpar se não encontrou nada
        setFloorPlanPdfUrl(null);
      }

    } catch (error: any) {
      console.error("ERRO FATAL NA EXTRAÇÃO VISUAL:", error);
      alert("Erro na extração visual: " + error.message);
    } finally {
      setProcessingFloorPlanPdf(false);
      // Reset input value to allow selecting same file again
      e.target.value = '';
    }
  };

  const handleAssociateImageToUnits = async () => {
    if (!croppedImagesToAssociate || associationSelectedUnits.length === 0) return;
    setIsAssociating(true);
    
    try {
      const res = await fetch(croppedImagesToAssociate.dataUrl);
      const blob = await res.blob();
      const fileName = `${id}/${Date.now()}-plan.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(fileName, blob, { contentType: 'image/jpeg' });
        
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(fileName);
        
      for (const unitId of associationSelectedUnits) {
        const unit = subUnits.find(u => u.id === unitId);
        if (unit) {
          const currentUrls = unit.floor_plan_url || [];
          await supabase.from('developments').update({
            floor_plan_url: [...currentUrls, publicUrl]
          }).eq('id', unitId);
        }
      }
      
      fetchSubUnits();
      alert("Planta associada com sucesso!");
      setCroppedImagesToAssociate(null);
      setAssociationSelectedUnits([]);
      
    } catch (err: any) {
      console.error(err);
      alert("Erro ao associar planta: " + err.message);
    } finally {
      setIsAssociating(false);
    }
  };

  const handleSelectUnit = (unitId: string) => {
    setSelectedUnits(prev => prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]);
  };

  const handleSelectAll = () => {
    if (selectedUnits.length === subUnits.length) setSelectedUnits([]);
    else setSelectedUnits(subUnits.map(u => u.id));
  };

  const handleSelectByType = (type: string) => {
    const unitsOfType = subUnits.filter(u => u.unit_type === type).map(u => u.id);
    const currentlySelected = unitsOfType.every(id => selectedUnits.includes(id));
    
    if (currentlySelected) {
       // Se já estão todos selecionados, remove da lista
       setSelectedUnits(prev => prev.filter(id => !unitsOfType.includes(id)));
    } else {
       // Se não, adiciona todos
       setSelectedUnits(prev => Array.from(new Set([...prev, ...unitsOfType])));
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedUnits.length === 0) return;
    setBulkProcessing(true);
    try {
      const unitsToUpdate = subUnits.filter(u => selectedUnits.includes(u.id));
      const report: any[] = [];
      
      for (const unit of unitsToUpdate) {
        const updates: any = {};
        if (bulkPercent !== 0) {
          updates.price_starting_at = unit.price_starting_at * (1 + bulkPercent / 100);
        }
        if (bulkCubRate !== 0) {
          updates.cub_monthly_rate = bulkCubRate;
        }

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase.from('developments').update(updates).eq('id', unit.id);
          if (!error) {
             report.push({ unit: unit.title, oldPrice: unit.price_starting_at, newPrice: updates.price_starting_at || unit.price_starting_at, status: 'updated' });
          } else {
             report.push({ unit: unit.title, status: 'error', error: error.message });
          }
        }
      }
      
      setIsBulkModalOpen(false);
      setBulkPercent(0);
      setBulkCubRate(0);
      setSelectedUnits([]);
      setUpdateReport(report);
      fetchSubUnits();
    } catch (e: any) {
      alert("Erro ao atualizar em massa: " + e.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleMarkAsSold = async () => {
    if (!property || selling) return;
    
    const confirmMessage = property.parent_id 
      ? `Confirmar venda da unidade ${property.title}?` 
      : `Confirmar venda do imóvel ${property.title}?`;
      
    if (!window.confirm(confirmMessage)) return;

    setSelling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const now = new Date();
      const monthYear = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
      const salePrice = property.price_starting_at || 0;

      // 1. Atualizar status para Vendido
      const { error: updateError } = await supabase
        .from('developments')
        .update({ status: 'sold' })
        .eq('id', id);

      if (updateError) throw updateError;

      // 2. Registrar Receita
      // Tenta buscar registro existente para o mês/ano
      const { data: existingRevenue } = await supabase
        .from('revenue_tracking')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', monthYear)
        .maybeSingle();

      if (existingRevenue) {
        await supabase
          .from('revenue_tracking')
          .update({
            total_revenue: (existingRevenue.total_revenue || 0) + salePrice,
            sales_count: (existingRevenue.sales_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRevenue.id);
      } else {
        await supabase
          .from('revenue_tracking')
          .insert([{
            user_id: user.id,
            month_year: monthYear,
            total_revenue: salePrice,
            sales_count: 1
          }]);
      }

      alert("Venda registrada com sucesso! Receita atualizada para " + monthYear);
      setProperty({ ...property, status: 'sold' });
    } catch (error: any) {
      console.error("Erro ao registrar venda:", error);
      alert("Erro ao registrar venda: " + error.message);
    } finally {
      setSelling(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    if (tier === 'free') {
      alert("No plano gratuito, a IA de PDF é limitada para testes. Para processar tabelas ilimitadas e ter suporte prioritário, faça upgrade para o plano Pro!");
    }

    setProcessingPdf(true);
    try {
      // Lendo o PDF no navegador usando pdfjsLib para evitar timeout no servidor
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      let extractedText = "";
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        let lastY = -1;
        textContent.items.forEach((item: any) => {
          // Detecta mudança de linha baseado na coordenada Y
          if (lastY !== item.transform[5]) {
            extractedText += '\n';
            lastY = item.transform[5];
          }
          // Adiciona o texto com espaçamento para preservar a tabela visual
          extractedText += item.str + '  '; 
        });
        extractedText += '\n\n---FIM DA PÁGINA---\n\n';
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: extractedData, error: funcError } = await supabase.functions.invoke('process-pdf-units', {
        body: JSON.stringify({ pdfText: extractedText }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (funcError) throw funcError;
      if (extractedData.error) throw new Error(extractedData.details || extractedData.error);

      console.log("DADOS EXTRAÍDOS PELA IA:", extractedData);

      if (!Array.isArray(extractedData) || extractedData.length === 0) {
        alert("A IA não conseguiu identificar uma tabela de unidades neste PDF. Verifique se o arquivo contém dados de preços claros ou tente um arquivo com melhor qualidade visual.");
        return;
      }

      const cleanStatus = (s: any) => {
        const val = String(s || '').toLowerCase().replace(/[^a-z_]/g, '').trim();
        if (val.includes('vend') || val.includes('sold')) return 'sold';
        if (val.includes('unavail') || val.includes('reser')) return 'reserved';
        return 'available';
      };

      const cleanNumber = (val: any) => {
        if (!val) return 0;
        let str = String(val).replace(/R\$/g, '').trim();
        
        // Se houver vírgula E ponto, o ponto é milhar. Removemos.
        if (str.includes(',') && str.includes('.')) {
          str = str.replace(/\./g, '');
        }
        
        // Troca vírgula por ponto para parseFloat
        str = str.replace(',', '.');
        
        // Se após trocar vírgula por ponto, ainda houver mais de um ponto, removemos os primeiros (milhares)
        const parts = str.split('.');
        if (parts.length > 2) {
          str = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
        }

        const num = parseFloat(str.replace(/[^-0-9.]/g, '')) || 0;
        return num;
      };

      const unitsToInsert = extractedData.map((unit: any) => {
        const status = cleanStatus(unit.status);
        
        let area = cleanNumber(unit.sq_ft);
        
        if (area > 1000 && !String(unit.sq_ft).includes('.') && !String(unit.sq_ft).includes(',')) {
          area = area / 100;
        }

        let bedrooms = Number(unit.bedrooms);
        if (isNaN(bedrooms) || bedrooms === 0) {
          bedrooms = 1; 
          // Se for studio, geralmente é 1 dormitório ou 0, mas o sistema espera >= 1 para alguns casos?
          // Se unit_type for studio, bedrooms pode ser 1.
          if (unit.unit_type === 'studio') bedrooms = 1;
          else if (unit.description) {
            const match = unit.description.match(/(\d+)\s*[Dd]/);
            if (match) bedrooms = parseInt(match[1]);
          }
        }
        bedrooms = Math.max(1, bedrooms);

        // Normalize unit_type to our standard keys
        const normalizeType = (type: string, desc: string) => {
          const combined = (String(type || '') + ' ' + String(desc || '')).toLowerCase();
          if (combined.includes('sala') || combined.includes('comercial') || combined.includes('loja') || combined.includes('escritorio') || combined.includes('office')) return 'commercial';
          if (combined.includes('studio') || combined.includes('kitnet')) return 'studio';
          if (combined.includes('casa') || combined.includes('sobrado')) return 'house';
          return 'dormitory';
        };

        const finalType = normalizeType(unit.unit_type, unit.description);
        
        const parking = Math.max(0, Number(unit.parking_spaces) || 0);
        const price = cleanNumber(unit.price_starting_at);
        
        return {
          title: `${String(unit.title || "Unidade").trim()}${status === 'sold' ? ' (VENDIDO)' : status === 'reserved' ? ' (RESERVADO)' : ''}`,
          sq_ft: area,
          price_starting_at: price,
          status: status,
          bedrooms: bedrooms,
          bathrooms: Math.max(1, Number(unit.bathrooms) || 0),
          parking_spaces: parking,
          unit_type: finalType,
          payment_entry: cleanNumber(unit.payment_entry),
          payment_installment_value: cleanNumber(unit.payment_installment_value),
          payment_installment_count: Math.max(0, Number(unit.payment_installment_count) || 0),
          payment_reinforcement_value: cleanNumber(unit.payment_reinforcement_value),
          payment_reinforcement_count: Math.max(0, Number(unit.payment_reinforcement_count) || 0),
          payment_post_construction: cleanNumber(unit.payment_post_construction),
          
          // Cálculos Automáticos de Investimento (ROI) baseados no Preço da Unidade
          roi_appreciation_1y: 15,
          roi_appreciation_2y: 12,
          roi_appreciation_3y: 10,
          rent_seasonal: price * 0.01,
          rent_annual: price * 0.005,
          sale_value_after_keys: price * 1.30,
          cub_monthly_rate: 0,
          months_until_keys: 0,
          description: String(unit.description || unit.unit_type || "Unidade importada via PDF").trim(),
          builder_id: property.builder_id,
          parent_id: id,
          user_id: user.id,
          location: property.location,
          street: property.street,
          city: property.city,
          state: property.state,
          hero_image_url: property.hero_image_url,
          is_penthouse: !!unit.is_penthouse,
          has_sea_view: !!unit.has_sea_view,
          has_garage: !!unit.has_garage || parking > 0,
          is_furnished: !!unit.is_furnished,
          is_pet_friendly: !!unit.is_pet_friendly,
          has_complete_leisure: !!unit.has_complete_leisure,
          has_automation: !!unit.has_automation,
          has_balcony_grill: !!unit.has_balcony_grill
        };
      });

      console.log("UNIDADES PREPARADAS PARA SALVAR:", unitsToInsert);

      // 1. Buscar unidades existentes para comparação
      const { data: existingUnits } = await supabase
        .from('developments')
        .select('*')
        .eq('parent_id', id);

      const existingMap = new Map();
      existingUnits?.forEach(u => {
        const cleanTitle = u.title.replace(' (VENDIDO)', '').replace(' (RESERVADO)', '').trim();
        existingMap.set(cleanTitle, u);
      });

      const report: any[] = [];
      let successCount = 0;

      for (const unit of unitsToInsert) {
        const cleanSearchTitle = unit.title.replace(' (VENDIDO)', '').replace(' (RESERVADO)', '').trim();
        const existing = existingMap.get(cleanSearchTitle);

        if (existing) {
          // Comparar preços
          const oldPrice = existing.price_starting_at || 0;
          const newPrice = unit.price_starting_at || 0;

          const { error: updError } = await supabase
            .from('developments')
            .update(unit)
            .eq('id', existing.id);

          if (!updError) {
            successCount++;
            report.push({
              unit: unit.title,
              oldPrice,
              newPrice,
              status: oldPrice === newPrice ? 'no_change' : 'updated'
            });
          } else {
            report.push({ unit: unit.title, status: 'error', error: updError.message });
          }
        } else {
          // Inserir como novo
          const { error: insError } = await supabase.from('developments').insert([unit]);
          if (!insError) {
            successCount++;
            report.push({
              unit: unit.title,
              oldPrice: 0,
              newPrice: unit.price_starting_at,
              status: 'inserted'
            });
          } else {
            report.push({ unit: unit.title, status: 'error', error: insError.message });
          }
        }
      }

      setUpdateReport(report);
      fetchSubUnits();
    } catch (error: any) {
      console.error("Error processing PDF:", error);
      alert("Falha ao processar PDF: " + error.message);
    } finally {
      setProcessingPdf(false);
      if (e.target) e.target.value = '';
    }
  };

  async function fetchSubUnits() {
    if (!id) return;
    const { data } = await supabase
      .from('developments')
      .select('*')
      .eq('parent_id', id)
      .order('title', { ascending: true });
    setSubUnits(data || []);
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const isProject = property.parent_id === null;
    const message = isProject 
      ? "Tem certeza? Isso excluirá o empreendimento e todas as suas unidades vinculadas."
      : t('common.confirm_delete');

    if (!window.confirm(message)) return;
    
    setDeleting(true);
    
    try {
      // If it's a project, explicitly delete units first to handle constraints
      if (isProject) {
        await supabase
          .from('developments')
          .delete()
          .eq('parent_id', id);
      }

      await Promise.all([
        supabase.from('development_images').delete().eq('development_id', id),
        supabase.from('amenities').delete().eq('development_id', id)
      ]);

      const { error } = await supabase
        .from('developments')
        .delete({ count: 'exact' })
        .eq('id', id);

      if (error) {
        alert(`Erro ao excluir: ${error.message}`);
      } else {
        alert("Excluído com sucesso!");
        navigate(property.parent_id ? `/projects/${property.parent_id}` : "/developments");
      }
    } catch (err: any) {
      alert(`Erro inesperado: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    async function fetchProperty() {
      if (!id || deleting) return;
      
      try {
        const { data, error } = await supabase
          .from('developments')
          .select('*, builders(*)')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setLoading(false);
          return;
        }

        setProperty(data);

        const { data: amenityData } = await supabase.from('amenities').select('*').eq('development_id', id);
        setAmenities(amenityData || []);

        const { data: galleryData } = await supabase.from('development_images').select('*').eq('development_id', id).order('display_order', { ascending: true });
        setGallery((galleryData || []).map(item => ({ ...item, type: item.url.match(/\.(mp4|webm|ogg)$/i) ? 'video' : 'image' })));

      } catch (error: any) {
        console.error("Erro ao buscar imóvel:", error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProperty();
    fetchSubUnits();
  }, [id, deleting]);

  if (loading) return <div className="p-8 font-body text-on-surface/50">{t('developments.loading')}</div>;
  if (!property) return <div className="p-8">{t('common.no_data')}</div>;

  const isSubUnit = property.parent_id !== null;
  const isStandaloneProperty = property.parent_id === null && property.builder_id === null;
  const isProject = property.parent_id === null && property.builder_id !== null;
  
  const showPaymentPlan = isSubUnit || isStandaloneProperty;
  const showSpecificFeatures = isSubUnit || isStandaloneProperty;
  const showUnitsSection = isProject; // Only show units for actual Projects (with builders)

  const getStatusColor = (status: string, title?: string) => {
    const isUnavailable = title?.includes('(INDISPONÍVEL)');
    if (isUnavailable || status === 'sold') return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (status === 'reserved') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  };

  const getStatusDotColor = (status: string, title?: string) => {
    const isUnavailable = title?.includes('(INDISPONÍVEL)');
    if (isUnavailable || status === 'sold') return 'bg-red-500';
    if (status === 'reserved') return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="max-w-[1920px] mx-auto pb-24">
      {selectedMedia && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer" onClick={() => setSelectedMedia(null)}>
          <button className="absolute top-8 right-8 text-white/70 hover:text-white p-2 rounded-full transition-colors bg-white/10 hover:bg-white/20 z-10" onClick={(e) => { e.stopPropagation(); setSelectedMedia(null); }}>
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>
          {selectedMedia.type === 'video' ? (
            <video src={selectedMedia.url} className="max-w-full max-h-full rounded-lg shadow-2xl" controls autoPlay onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={selectedMedia.url} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="Full view" />
          )}
        </div>
      )}

      <nav className="py-6 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 font-body flex justify-between items-center px-4">
        <ol className="flex items-center gap-2">
          <li><Link to="/" className="hover:text-primary transition-colors">{t('nav.overview')}</Link></li>
          <li><span className="material-symbols-outlined text-[10px]">chevron_right</span></li>
          <li>
            <button 
              onClick={() => navigate(property.builder_id ? '/project-developments' : '/developments')} 
              className="hover:text-primary transition-colors"
            >
              {property.builder_id ? t('nav.project_developments') : (isStandaloneProperty ? "Imóveis" : t('nav.developments'))}
            </button>
          </li>
          {isSubUnit && (
            <>
              <li><span className="material-symbols-outlined text-[10px]">chevron_right</span></li>
              <li><Link to={`/projects/${property.parent_id}`} className="hover:text-primary transition-colors">Ver Empreendimento</Link></li>
            </>
          )}
          <li><span className="material-symbols-outlined text-[10px]">chevron_right</span></li>
          <li className="text-primary/60">{property.title}</li>
        </ol>
        <div className="flex gap-2">
          <Link to={
            property.unit_type === 'land'
              ? `/lands/edit/${id}`
              : (property.parent_id !== null 
                  ? `/units/edit/${id}` 
                  : (isStandaloneProperty ? `/units/edit/${id}?type=property` : `/projects/edit/${id}?type=project`))
          }><button className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors flex items-center gap-2"><span className="material-symbols-outlined">edit</span><span className="text-sm font-medium">{t('common.edit')}</span></button></Link>
          <button onClick={handleDelete} disabled={deleting} className="text-error hover:bg-error/10 p-2 rounded-full transition-colors flex items-center gap-2"><span className="material-symbols-outlined">{deleting ? 'sync' : 'delete'}</span><span className="text-sm font-medium">{deleting ? t('common.deleting') : t('common.delete')}</span></button>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4">
        <div className="lg:col-span-8 space-y-12">
          <div className="space-y-4">
            <div className="relative h-64 sm:h-96 md:h-[500px] lg:h-[614px] w-full bg-surface-container-low rounded-xl overflow-hidden group cursor-zoom-in" onClick={() => setSelectedMedia({ url: property.hero_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop", type: property.hero_image_url?.match(/\.pdf$/i) ? 'image' : 'image' })}>
              {property.hero_image_url?.match(/\.pdf$/i) ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-primary bg-primary/5">
                  <span className="material-symbols-outlined text-[120px]">picture_as_pdf</span>
                  <span className="text-2xl font-black mt-4 uppercase tracking-[0.2em]">Documento PDF</span>
                  <a href={property.hero_image_url} target="_blank" rel="noopener noreferrer" className="mt-8 px-8 py-3 bg-primary text-on-primary rounded-full font-bold uppercase tracking-widest hover:opacity-90 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    Abrir Documento
                  </a>
                </div>
              ) : (
                <img src={property.hero_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"} alt={property.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              )}
              <div className="absolute top-6 left-6 flex gap-3">
                <span className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider font-label flex items-center gap-1 border ${getStatusColor(property.status, property.title)}`}>
                  <span className={`w-2 h-2 rounded-full ${getStatusDotColor(property.status, property.title)}`}></span> 
                  {property.title?.includes('(INDISPONÍVEL)') ? t('status.unavailable') : t(`status.${property.status}`)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="space-y-8">
            {/* Descrição em Bloco Único e Amplo */}
            <section className="bg-surface-container-lowest p-10 rounded-xl sunken-shadow min-h-[400px]">
              <h2 className="text-2xl font-headline font-bold text-on-surface mb-8 tracking-tight border-b border-outline-variant/10 pb-4">
                {isSubUnit ? "Sobre esta Unidade" : (isStandaloneProperty ? "Sobre este Imóvel" : "Sobre este Empreendimento")}
              </h2>
              <div className="space-y-6 text-on-surface-variant leading-relaxed text-lg font-body">
                <p className="whitespace-pre-wrap">{property.description}</p>
                {(isSubUnit || isStandaloneProperty) && (
                <div className="grid grid-cols-3 gap-8 pt-10 border-t border-outline-variant/10">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase text-on-surface-variant/60 font-bold tracking-widest mb-1">Área Total</span>
                    <span className="text-2xl font-headline font-bold text-primary">{formatNumber(property.sq_ft)}m²</span>
                  </div>
                  {property.unit_type !== 'land' && (
                    <>
                      <div className="flex flex-col">
                        <span className="text-xs uppercase text-on-surface-variant/60 font-bold tracking-widest mb-1">Dormitórios</span>
                        <span className="text-2xl font-headline font-bold text-primary">{property.bedrooms || 0}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs uppercase text-on-surface-variant/60 font-bold tracking-widest mb-1">Banheiros</span>
                        <span className="text-2xl font-headline font-bold text-primary">{property.bathrooms || 0}</span>
                      </div>
                    </>
                  )}
                  {!isSubUnit && property.parking_spaces > 0 && property.unit_type !== 'land' && (
                    <div className="flex flex-col">
                      <span className="text-xs uppercase text-on-surface-variant/60 font-bold tracking-widest mb-1">Vagas</span>
                      <span className="text-2xl font-headline font-bold text-primary">{property.parking_spaces}</span>
                    </div>
                  )}
                </div>
                )}
              </div>
            </section>

            {showPaymentPlan && property.price_starting_at > 0 && (
              <section className="bg-primary/5 p-10 rounded-xl border border-primary/10">
                <h2 className="text-2xl font-headline font-bold text-primary mb-6 tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined">payments</span> Plano de Pagamento
                </h2>
                <div className="space-y-6">
                  <div className="flex justify-between items-center pb-4 border-b border-primary/10">
                    <span className="text-sm font-bold text-on-surface-variant uppercase">Valor Total do Ativo</span>
                    <span className="text-4xl font-headline font-black text-primary">{formatCurrency(property.price_starting_at || 0)}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-4">
                    {property.payment_entry > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                        <span className="text-base text-on-surface-variant">Entrada</span>
                        <span className="text-xl font-bold text-on-surface">{formatCurrency(property.payment_entry || 0)}</span>
                      </div>
                    )}

                    {property.payment_installment_count > 0 && property.payment_installment_value > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                        <span className="text-base text-on-surface-variant">{property.payment_installment_count}x Mensais</span>
                        <span className="text-xl font-bold text-on-surface">{formatCurrency(property.payment_installment_value || 0)}</span>
                      </div>
                    )}

                    {property.payment_reinforcement_count > 0 && property.payment_reinforcement_value > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                        <span className="text-base text-on-surface-variant">{property.payment_reinforcement_count}x Reforços</span>
                        <span className="text-xl font-bold text-on-surface">{formatCurrency(property.payment_reinforcement_value || 0)}</span>
                      </div>
                    )}

                    {property.payment_post_construction > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                        <span className="text-base text-on-surface-variant">Saldo Pós-Obra</span>
                        <span className="text-xl font-bold text-on-surface">{formatCurrency(property.payment_post_construction || 0)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {showPaymentPlan && (property.roi_appreciation_1y > 0 || property.rent_annual > 0 || property.rent_seasonal > 0 || property.sale_value_after_keys > 0 || property.cub_monthly_rate > 0) && (
              <section className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 p-[2px] rounded-2xl shadow-2xl relative overflow-hidden group">
                {/* Efeito Ouro Premium */}
                <div className="absolute inset-0 bg-gradient-to-tr from-yellow-400/20 via-transparent to-yellow-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                
                <div className="bg-surface-container-lowest/95 backdrop-blur-3xl h-full w-full rounded-2xl p-6 md:p-10 relative z-10">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <span className="material-symbols-outlined text-[120px] text-emerald-600">moving</span>
                  </div>
                  
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-10">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30 shrink-0">
                      <span className="material-symbols-outlined text-emerald-600 text-3xl">insights</span>
                    </div>
                    <div>
                      <h2 className="text-3xl font-headline font-black text-on-surface tracking-tight">
                        Potencial de Investimento
                      </h2>
                      <p className="text-emerald-600 font-bold tracking-widest uppercase text-xs mt-1">Análise de Rentabilidade e Valorização</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Card Valorização */}
                    <div className="bg-surface-container-high rounded-xl p-6 border border-emerald-500/10 hover:border-emerald-500/30 transition-all shadow-sm relative overflow-hidden group/card">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-[100px] transition-transform group-hover/card:scale-110"></div>
                      <h3 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-emerald-500">trending_up</span> Valorização
                      </h3>
                      <div className="space-y-4 relative z-10">
                        {property.roi_appreciation_1y > 0 && (
                          <div className="flex justify-between items-end">
                            <span className="text-sm font-bold text-on-surface-variant">Em 1 Ano:</span>
                            <span className="font-black text-3xl text-emerald-600 tracking-tighter">+{property.roi_appreciation_1y}%</span>
                          </div>
                        )}
                        {property.roi_appreciation_2y > 0 && (
                          <div className="flex justify-between items-end border-t border-outline-variant/10 pt-3">
                            <span className="text-xs font-bold text-on-surface-variant">Em 2 Anos:</span>
                            <span className="font-black text-xl text-emerald-600/80">+{property.roi_appreciation_2y}%</span>
                          </div>
                        )}
                        {property.roi_appreciation_3y > 0 && (
                          <div className="flex justify-between items-end border-t border-outline-variant/10 pt-3">
                            <span className="text-xs font-bold text-on-surface-variant">Em 3 Anos:</span>
                            <span className="font-black text-xl text-emerald-600/80">+{property.roi_appreciation_3y}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Rentabilidade */}
                    <div className="bg-surface-container-high rounded-xl p-6 border border-amber-500/10 hover:border-amber-500/30 transition-all shadow-sm relative overflow-hidden group/card">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-[100px] transition-transform group-hover/card:scale-110"></div>
                      <h3 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-amber-500">payments</span> Renda Passiva
                      </h3>
                      <div className="space-y-5 relative z-10">
                        {property.rent_seasonal > 0 && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Locação Temporada</span>
                            <div className="flex items-baseline gap-1">
                              <span className="font-black text-3xl text-amber-600 tracking-tighter">{formatCurrency(property.rent_seasonal)}</span>
                              <span className="text-[10px] text-on-surface-variant/70 font-bold uppercase tracking-wider">/mês est.</span>
                            </div>
                          </div>
                        )}
                        {property.rent_annual > 0 && (
                          <div className="flex flex-col gap-1 border-t border-outline-variant/10 pt-4">
                            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Locação Anual</span>
                            <div className="flex items-baseline gap-1">
                              <span className="font-black text-xl text-amber-600/80 tracking-tighter">{formatCurrency(property.rent_annual)}</span>
                              <span className="text-[10px] text-on-surface-variant/70 font-bold uppercase tracking-wider">/mês est.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Finalização */}
                    <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 rounded-xl p-6 text-emerald-50 relative overflow-hidden shadow-inner flex flex-col justify-between group/card">
                      <div className="absolute -right-8 -bottom-8 opacity-10 transition-transform duration-700 group-hover/card:scale-150 group-hover/card:rotate-12">
                        <span className="material-symbols-outlined text-[150px]">diamond</span>
                      </div>
                      
                      <div>
                        <h3 className="text-[10px] font-black text-emerald-300 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 relative z-10">
                          <span className="material-symbols-outlined text-[18px]">account_balance</span> Projeção nas Chaves
                        </h3>
                        <div className="space-y-4 relative z-10">
                          {property.sale_value_after_keys > 0 && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-bold text-emerald-200/80">Venda Estimada:</span>
                              <span className="font-black text-4xl text-white drop-shadow-md tracking-tighter">{formatCurrency(property.sale_value_after_keys)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-emerald-700/50 pt-4 mt-6 relative z-10 bg-black/10 p-3 rounded-lg backdrop-blur-sm">
                        {property.cub_monthly_rate > 0 && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase tracking-widest text-emerald-300 font-bold">Reajuste CUB</span>
                            <span className="font-black text-lg text-emerald-50">+{property.cub_monthly_rate}%<span className="text-[9px] font-normal"> a.m.</span></span>
                          </div>
                        )}
                        {property.months_until_keys > 0 && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase tracking-widest text-emerald-300 font-bold">Prazo Chaves</span>
                            <span className="font-black text-lg text-emerald-50">{property.months_until_keys} m.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-10 pt-6 border-t border-outline-variant/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <p className="text-[10px] text-on-surface-variant/60 font-medium max-w-2xl uppercase tracking-wider leading-relaxed">
                      * Projeções matemáticas baseadas no histórico do mercado. Valores e percentuais não garantem rentabilidade futura absoluta e sofrem variações de acordo com CUB/INCC.
                    </p>
                    <button onClick={() => setIsSimulatorOpen(true)} className="shrink-0 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/40 hover:-translate-y-1">
                      Simular Investimento <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>

          {(property.video_url?.length > 0 || property.ebook_url?.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {property.video_url?.length > 0 && (
                <section className="bg-surface-container-lowest p-8 rounded-xl sunken-shadow">
                  <h2 className="text-2xl font-headline font-bold text-on-surface mb-6 tracking-tight flex items-center gap-2">
                    <span className="material-symbols-outlined">movie</span> Galeria de Vídeos
                  </h2>
                  <div className="grid grid-cols-1 gap-4">
                    {property.video_url.map((url: string, index: number) => (
                      <video 
                        key={index}
                        src={url} 
                        className="w-full rounded-lg bg-black aspect-video" 
                        controls 
                      />
                    ))}
                  </div>
                </section>
              )}

              {property.ebook_url?.length > 0 && (
                <section className="bg-surface-container-lowest p-8 rounded-xl sunken-shadow">
                  <h2 className="text-2xl font-headline font-bold text-on-surface mb-6 tracking-tight flex items-center gap-2">
                    <span className="material-symbols-outlined">menu_book</span> Materiais e E-books
                  </h2>
                  <div className="space-y-4">
                    {property.ebook_url.map((url: string, index: number) => (
                      <a 
                        key={index}
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-4 p-4 rounded-lg border border-outline-variant/30 hover:bg-primary/5 hover:border-primary/30 transition-all group"
                      >
                        <span className="material-symbols-outlined text-3xl text-primary">picture_as_pdf</span>
                        <div className="flex-1">
                          <div className="font-bold text-on-surface group-hover:text-primary transition-colors">E-book Informativo #{index + 1}</div>
                          <div className="text-xs text-on-surface-variant">Clique para abrir o PDF</div>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant">open_in_new</span>
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {(property.floor_plan_url?.length > 0 || property.floor_layout_url?.length > 0) && (
            <section className="bg-surface-container-lowest p-8 rounded-xl sunken-shadow">
              <h2 className="text-2xl font-headline font-bold text-on-surface mb-8 tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined">{isStandaloneProperty ? "image" : "architecture"}</span> {isStandaloneProperty ? "Imagens do Imóvel" : "Plantas e Layouts"}
              </h2>
              
              <div className="space-y-12">
                {property.floor_plan_url?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-primary uppercase tracking-widest mb-4">
                      {isStandaloneProperty ? "Galeria de Fotos" : "Plantas Baixas"}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {property.floor_plan_url.map((url: string, index: number) => (
                        <div 
                          key={index}
                          className="relative aspect-[4/3] bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/20 cursor-zoom-in group"
                          onClick={() => setSelectedMedia({ url, type: url.match(/\.pdf$/i) ? 'image' : 'image' })}
                        >
                          {url.match(/\.pdf$/i) ? (
                            <div className="w-full h-full flex flex-col items-center justify-center text-primary bg-primary/5 p-4">
                              <span className="material-symbols-outlined text-4xl">picture_as_pdf</span>
                              <span className="text-[10px] font-bold mt-2 uppercase text-center">Documento PDF</span>
                            </div>
                          ) : (
                            <img src={url} className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500" alt={isStandaloneProperty ? `Foto ${index + 1}` : `Planta ${index + 1}`} />
                          )}
                          <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-full uppercase tracking-tighter">
                            {isStandaloneProperty ? `Imagem #${index + 1}` : `Planta #${index + 1}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {property.floor_layout_url?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-primary uppercase tracking-widest mb-4">Layout do Pavimento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {property.floor_layout_url.map((url: string, index: number) => (
                        <div 
                          key={index}
                          className="relative aspect-[4/3] bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/20 cursor-zoom-in group"
                          onClick={() => setSelectedMedia({ url, type: 'image' })}
                        >
                          <img src={url} className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500" alt={`Layout ${index + 1}`} />
                          <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-full uppercase tracking-tighter">
                            Layout #{index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="lg:col-span-4 relative">
          <div className="sticky top-28 space-y-6">
            <div className="bg-surface-container-lowest rounded-xl sunken-shadow overflow-hidden">
              <div className="p-8 space-y-6">
                <div>
                  <h1 className="text-3xl font-headline font-bold text-on-surface mb-2 tracking-tighter">{property.title}</h1>
                  <p className="text-on-surface-variant flex items-start gap-2 text-sm leading-relaxed mb-6"><span className="material-symbols-outlined text-primary text-lg mt-0.5">location_on</span>{property.location}</p>
                  
                  {showSpecificFeatures && (
                    <div className="flex flex-wrap gap-2 pt-6 border-t border-outline-variant/10">
                      {property.is_penthouse && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                          <span className="material-symbols-outlined text-xs">home_work</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">Cobertura</span>
                        </div>
                      )}
                      {property.near_beach && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                          <span className="material-symbols-outlined text-xs">beach_access</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">Praia</span>
                        </div>
                      )}
                      {property.has_garage && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                          <span className="material-symbols-outlined text-xs">garage</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">Garagem</span>
                        </div>
                      )}
                      {property.has_balcony_grill && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                          <span className="material-symbols-outlined text-xs">outdoor_grill</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">Churrasqueira</span>
                        </div>
                      )}
                      {property.is_furnished && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                          <span className="material-symbols-outlined text-xs">chair</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">Mobiliado</span>
                        </div>
                      )}
                      {property.has_sea_view && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                          <span className="material-symbols-outlined text-xs">visibility</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">Vista Mar</span>
                        </div>
                      )}
                      {property.is_pet_friendly && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                          <span className="material-symbols-outlined text-xs">pets</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">Pet Friendly</span>
                        </div>
                      )}
                      {property.has_complete_leisure && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                          <span className="material-symbols-outlined text-xs">pool</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">Lazer</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-6 border-t border-outline-variant/10">
                  {property.status !== 'sold' && (
                    <Button 
                      onClick={handleMarkAsSold} 
                      disabled={selling}
                      className="w-full py-4 text-lg font-bold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <span className="material-symbols-outlined">{selling ? 'sync' : 'check_circle'}</span>
                      {selling ? 'Registrando...' : (property.parent_id ? "Unidade Vendida" : "Imóvel Vendido")}
                    </Button>
                  )}
                  <button onClick={() => generatePropertyPDF(property, amenities, gallery, subUnits, theme)} className="w-full py-3 border-2 border-primary text-primary hover:bg-primary hover:text-on-primary transition-all rounded-md font-bold flex items-center justify-center gap-2"><span className="material-symbols-outlined">download</span>{t('common.download_pdf')}</button>
                </div>
              </div>
              {property.builders && (
                <div className="bg-surface-container-low p-6 flex items-center justify-between border-t border-outline-variant/20">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-surface-container-high overflow-hidden flex items-center justify-center">
                      {property.builders.logo_url ? <img src={property.builders.logo_url} alt="Builder" className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-primary">engineering</span>}
                    </div>
                    <div><div className="font-bold text-on-surface text-sm">{property.builders.name}</div><div className="text-xs text-on-surface-variant">{t('new_development.partner')}</div></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showUnitsSection && (
        <div className="mt-16 px-4">
          <section className="bg-surface-container-lowest rounded-2xl p-8 sunken-shadow border border-outline-variant/10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 border-b border-outline-variant/20 pb-6">
              <div><h2 className="text-3xl font-headline font-bold text-on-surface mb-2 tracking-tight">Unidades do Empreendimento</h2><p className="text-on-surface-variant font-body">Gerencie as unidades e quartos deste prédio aqui.</p></div>
              <div className="flex flex-wrap gap-4 items-center">
                <button onClick={() => setIsBulkModalOpen(true)} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-surface-container-high border-2 border-outline-variant hover:border-primary hover:bg-primary/5 font-bold uppercase tracking-wider transition-all shadow-sm">
                  <span className="material-symbols-outlined text-primary">edit_square</span>Atualização em Massa {selectedUnits.length > 0 && `(${selectedUnits.length})`}
                </button>

                <Link to={`/developments/new?parentId=${id}`} className="flex items-center gap-3 px-6 py-3 rounded-xl bg-primary text-on-primary font-bold uppercase tracking-wider hover:opacity-90 transition-all sunken-shadow">
                  <span className="material-symbols-outlined">add_circle</span>Adicionar Unidade
                </Link>

                <label title="Atualiza preços existentes ou cadastra novas unidades automaticamente" className={`flex items-center gap-3 px-6 py-3 rounded-xl cursor-pointer transition-all duration-300 border-2 border-dashed ${processingPdf ? 'bg-primary/5 border-primary/40 animate-pulse' : 'bg-surface-container-high border-outline-variant hover:border-primary hover:bg-surface-bright'}`}>
                  {processingPdf ? (<><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div><span className="text-sm font-bold text-primary uppercase tracking-wider">Extraindo...</span></>) : (<><span className="material-symbols-outlined text-primary">upload_file</span><span className="text-sm font-bold text-on-surface uppercase tracking-wider">Importar Tabela PDF</span></>)}
                  <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} disabled={processingPdf} />
                </label>
                
                <button onClick={() => setIsFloorPlanModalOpen(true)} className="flex items-center gap-3 px-6 py-3 rounded-xl bg-surface-container-high border-2 border-outline-variant hover:border-primary hover:bg-surface-bright font-bold uppercase tracking-wider transition-all shadow-sm">
                  <span className="material-symbols-outlined text-primary">architecture</span>Importar Plantas (PDF)
                </button>
              </div>
            </div>

            {subUnits.length > 0 ? (
              <div className="space-y-4">
                <div className="flex justify-end px-2">
                  <button onClick={handleSelectAll} className="text-xs font-bold text-primary uppercase tracking-widest hover:underline">
                    {selectedUnits.length === subUnits.length ? "Desmarcar Todas" : "Selecionar Todas"}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {subUnits.map((unit) => (
                    <article key={unit.id} className={`relative bg-surface-container-low rounded-xl p-6 flex flex-col justify-between border-2 transition-all group shadow-sm ${selectedUnits.includes(unit.id) ? 'border-primary bg-primary/5' : 'border-transparent hover:border-primary/20'}`}>
                      <div className="absolute top-4 right-4 z-10">
                        <input type="checkbox" checked={selectedUnits.includes(unit.id)} onChange={() => handleSelectUnit(unit.id)} className="w-5 h-5 accent-primary cursor-pointer shadow-sm rounded-sm" />
                      </div>
                      <div className="pr-8">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
                        <h3 className={`font-headline font-bold text-lg leading-tight break-words max-w-full ${unit.title?.includes('(INDISPONÍVEL)') ? 'text-on-surface/40' : 'text-on-surface group-hover:text-primary'}`}>{unit.title}</h3>
                        <span className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(unit.status, unit.title)}`}>
                          {unit.title?.includes('(INDISPONÍVEL)') ? t('status.unavailable') : t(`status.${unit.status}`)}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-primary uppercase tracking-tighter mb-4">
                        {['land', 'mixed', 'commercial_center', 'residential_center', 'dormitory', 'studio', 'commercial', 'house'].includes(unit.unit_type) ? t(`consultancy.types.${unit.unit_type}`) : 'Unidade'}
                      </p>
                      
                      <div className="space-y-4 mb-6">
                        <div className="grid grid-cols-2 gap-y-3">
                          <div className="flex items-center gap-2 text-on-surface-variant">
                            <span className="material-symbols-outlined text-sm">square_foot</span>
                            <span className="text-sm font-medium">{formatNumber(unit.sq_ft)}m²</span>
                          </div>
                          {unit.unit_type !== 'land' && (
                            <div className="flex items-center gap-2 text-on-surface-variant">
                              <span className="material-symbols-outlined text-sm">meeting_room</span>
                              <span className="text-sm font-medium">{unit.bedrooms || 0} Dorm.</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 pt-2 border-t border-outline-variant/5">
                          {unit.payment_entry > 0 && (
                            <div className="flex justify-between text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                              <span>Entrada</span>
                              <span className="text-on-surface">{formatCurrency(unit.payment_entry || 0)}</span>
                            </div>
                          )}
                          
                          {unit.payment_installment_count > 0 && unit.payment_installment_value > 0 && (
                            <div className="flex justify-between text-[11px] font-medium text-on-surface-variant italic">
                              <span>{unit.payment_installment_count}x Mensais</span>
                              <span>{formatCurrency(unit.payment_installment_value || 0)}</span>
                            </div>
                          )}

                          {unit.payment_reinforcement_count > 0 && unit.payment_reinforcement_value > 0 && (
                            <div className="flex justify-between text-[11px] font-medium text-on-surface-variant italic">
                              <span>{unit.payment_reinforcement_count}x Reforços</span>
                              <span>{formatCurrency(unit.payment_reinforcement_value || 0)}</span>
                            </div>
                          )}

                          {unit.payment_post_construction > 0 && (
                            <div className="flex justify-between text-[11px] font-medium text-on-surface-variant italic">
                              <span>Saldo Pós-Obra</span>
                              <span>{formatCurrency(unit.payment_post_construction || 0)}</span>
                            </div>
                          )}
                        </div>

                        {unit.description && unit.description !== "Cadastro manual" && (
                          <p className="text-[10px] text-on-surface-variant/70 leading-relaxed italic line-clamp-2">
                            {unit.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-end justify-between border-t border-outline-variant/10 pt-4">
                      <span className="text-xl font-headline font-black text-primary">{unit.price_starting_at ? formatCurrency(unit.price_starting_at) : t('common.consult')}</span>
                      <Link to={`/units/${unit.id}`} state={{ isProject: false }} className="text-xs font-bold text-on-surface-variant hover:text-primary underline uppercase tracking-widest transition-colors">Detalhes</Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            ) : (
              <div className="py-20 text-center bg-surface-container-low/50 rounded-2xl border-2 border-dashed border-outline-variant/20"><span className="material-symbols-outlined text-6xl text-on-surface/10 mb-4 italic">apartment</span><p className="text-on-surface-variant font-body text-lg italic">Nenhuma unidade cadastrada neste empreendimento ainda.</p><p className="text-sm text-on-surface/40 mt-2">Use o botão acima para importar unidades via PDF.</p></div>
            )}
          </section>
        </div>
      )}

      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col sunken-shadow border border-outline-variant/10">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
              <div>
                <h2 className="text-2xl font-headline font-bold text-on-surface">Atualização em Massa</h2>
                <p className="text-sm text-on-surface-variant font-body mt-1">
                  Atualize {selectedUnits.length} unidade(s) selecionada(s).
                </p>
              </div>
              <button onClick={() => setIsBulkModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="space-y-3 bg-surface-container-low p-5 rounded-2xl border border-outline-variant/20">
                <label className="block text-sm font-bold text-on-surface uppercase tracking-widest flex items-center justify-between">
                  <span>Seleção Rápida</span>
                  <span className="text-primary font-black">{selectedUnits.length} selecionada(s)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={handleSelectAll} 
                    className={`px-4 py-2 transition-colors rounded-lg text-xs font-bold uppercase tracking-wider border ${selectedUnits.length === subUnits.length && subUnits.length > 0 ? 'bg-primary text-on-primary border-primary shadow-md' : 'bg-surface-container-high hover:bg-primary/10 hover:text-primary border-outline-variant/20'}`}
                  >
                    {selectedUnits.length === subUnits.length && subUnits.length > 0 ? "Desmarcar Todas" : "Todas as Unidades"}
                  </button>
                  {Array.from(new Set(subUnits.map(u => u.unit_type))).map(type => {
                    const unitsOfType = subUnits.filter(u => u.unit_type === type);
                    const isSelected = unitsOfType.length > 0 && unitsOfType.every(u => selectedUnits.includes(u.id));
                    
                    return (
                      <button 
                        key={type} 
                        onClick={() => handleSelectByType(type)}
                        className={`px-4 py-2 transition-colors rounded-lg text-xs font-bold uppercase tracking-wider border flex items-center gap-2 ${isSelected ? 'bg-primary text-on-primary border-primary shadow-md' : 'bg-surface-container-high hover:bg-primary/10 hover:text-primary border-outline-variant/20'}`}
                      >
                        {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                        Todos os {['land', 'mixed', 'commercial_center', 'residential_center', 'dormitory', 'studio', 'commercial', 'house'].includes(type) ? t(`consultancy.types.${type}`) : 'Imóveis'}
                      </button>
                    );
                  })}
                  {selectedUnits.length > 0 && (
                    <button onClick={() => setSelectedUnits([])} className="px-4 py-2 text-error hover:bg-error/10 transition-colors rounded-lg text-xs font-bold uppercase tracking-wider ml-auto">
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              {selectedUnits.length === 0 ? (
                <div className="text-center py-4 text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl mb-4 opacity-50">check_box_outline_blank</span>
                  <p>Selecione pelo menos uma unidade acima para aplicar reajustes.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-on-surface uppercase tracking-widest">Reajuste CUB (%)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={bulkCubRate} 
                      onChange={(e) => setBulkCubRate(Number(e.target.value))} 
                      className="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl p-4 text-on-surface focus:ring-2 focus:ring-primary/50 transition-all" 
                      placeholder="Ex: 0.5 para mudar o CUB de todas" 
                    />
                    <p className="text-xs text-on-surface-variant">Isso irá substituir o CUB das unidades selecionadas. Deixe 0 para não alterar.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-on-surface uppercase tracking-widest">Aumento de Preço de Tabela (%)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={bulkPercent} 
                      onChange={(e) => setBulkPercent(Number(e.target.value))} 
                      className="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl p-4 text-on-surface focus:ring-2 focus:ring-primary/50 transition-all" 
                      placeholder="Ex: 5 para aumentar o preço em 5%" 
                    />
                    <p className="text-xs text-on-surface-variant">O preço inicial será recalculado adicionando +{bulkPercent || 0}% ao valor atual de cada unidade. Deixe 0 para não alterar.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 bg-surface-container-low border-t border-outline-variant/10 flex justify-end gap-4">
              <Button variant="secondary" onClick={() => setIsBulkModalOpen(false)}>Cancelar</Button>
              <Button disabled={selectedUnits.length === 0 || bulkProcessing} onClick={handleBulkUpdate}>
                {bulkProcessing ? "Processando..." : "Aplicar Atualização"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {updateReport && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sunken-shadow border border-outline-variant/10">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
              <div>
                <h2 className="text-2xl font-headline font-bold text-on-surface">Relatório de Processamento PDF</h2>
                <p className="text-sm text-on-surface-variant font-body mt-1">Confira as alterações realizadas nas unidades.</p>
              </div>
              <button onClick={() => setUpdateReport(null)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 gap-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/60 border-b border-outline-variant/20">
                        <th className="py-4 px-2">Unidade</th>
                        <th className="py-4 px-2">Status do Processo</th>
                        <th className="py-4 px-2 text-right">Valor Anterior</th>
                        <th className="py-4 px-2 text-right">Novo Valor</th>
                        <th className="py-4 px-2 text-right">Variação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {updateReport.map((r, i) => {
                        const diff = r.newPrice - r.oldPrice;
                        const percent = r.oldPrice > 0 ? (diff / r.oldPrice) * 100 : 0;
                        
                        return (
                          <tr key={i} className="group hover:bg-surface-container-low/50 transition-colors">
                            <td className="py-4 px-2">
                              <div className="font-bold text-on-surface group-hover:text-primary transition-colors">{r.unit}</div>
                            </td>
                            <td className="py-4 px-2">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                r.status === 'updated' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                                r.status === 'inserted' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                r.status === 'no_change' ? 'bg-surface-container-high text-on-surface-variant/60 border-outline-variant/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                              }`}>
                                {r.status === 'updated' ? 'Atualizado' : r.status === 'inserted' ? 'Nova Unidade' : r.status === 'no_change' ? 'Sem Alteração' : 'Erro'}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-right font-body text-on-surface-variant">
                              {r.oldPrice > 0 ? formatCurrency(r.oldPrice) : '---'}
                            </td>
                            <td className="py-4 px-2 text-right font-headline font-bold text-on-surface">
                              {formatCurrency(r.newPrice)}
                            </td>
                            <td className="py-4 px-2 text-right">
                              {r.status === 'inserted' ? (
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Inaugural</span>
                              ) : diff !== 0 ? (
                                <div className={`flex flex-col items-end ${diff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                  <span className="text-xs font-bold">{diff > 0 ? '↑' : '↓'} {formatCurrency(Math.abs(diff))}</span>
                                  <span className="text-[10px] font-black uppercase tracking-tighter opacity-80">{percent > 0 ? '+' : ''}{percent.toFixed(1)}%</span>
                                </div>
                              ) : (
                                <span className="text-on-surface-variant/30 text-xs">---</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="p-8 bg-surface-container-low border-t border-outline-variant/10 flex justify-between items-center">
              <div className="flex gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest">Total Processado</span>
                  <span className="text-xl font-headline font-bold text-on-surface">{updateReport.length}</span>
                </div>
                <div className="flex flex-col border-l border-outline-variant/20 pl-4">
                  <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest">Sucesso</span>
                  <span className="text-xl font-headline font-bold text-emerald-500">{updateReport.filter(r => r.status !== 'error').length}</span>
                </div>
              </div>
              <Button onClick={() => setUpdateReport(null)} className="px-10 py-4 rounded-xl">Entendido</Button>
            </div>
          </div>
        </div>
      )}

      {isFloorPlanModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col sunken-shadow border border-outline-variant/10 min-h-[600px]">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
              <div>
                <h2 className="text-2xl font-headline font-bold text-on-surface flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-3xl">architecture</span>
                  Laboratório de Plantas Baixas
                </h2>
                <p className="text-sm text-on-surface-variant font-body mt-2">
                  Faça o upload do Caderno de Plantas. A Inteligência Artificial vai analisar, identificar os desenhos arquitetônicos e preparar tudo para você recortar e atribuir às unidades.
                </p>
              </div>
              <button onClick={() => setIsFloorPlanModalOpen(false)} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors bg-surface-container-lowest shadow-sm border border-outline-variant/10">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="flex-1 p-8 flex flex-col items-center justify-center bg-surface-container-lowest relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-surface-container-lowest to-surface-container-lowest"></div>
              
              <div className="relative z-10 w-full max-w-xl text-center space-y-8">
                {processingFloorPlanPdf && (
                  <div className="bg-surface-container p-10 rounded-3xl shadow-xl border border-primary/20 flex flex-col items-center">
                    <div className="relative w-32 h-32 mb-6">
                      <div className="absolute inset-0 rounded-full border-4 border-surface-container-highest"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-primary animate-pulse">memory</span>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-on-surface mb-2">{extractionProgress.message}</h3>
                    <p className="text-sm font-bold text-primary tracking-widest uppercase mb-6">
                      Processando {extractionProgress.current} de {extractionProgress.total} páginas
                    </p>
                    <div className="w-full bg-surface-container-highest rounded-full h-3 overflow-hidden shadow-inner">
                      <div 
                        className="bg-primary h-full transition-all duration-500 ease-out"
                        style={{ width: (extractionProgress.total > 0 ? (extractionProgress.current / extractionProgress.total) * 100 : 0) + '%' }}
                      ></div>
                    </div>
                  </div>
                )}
                
                {!processingFloorPlanPdf && floorPlansExtracted.length > 0 && (
                  <div className="bg-surface-container p-8 rounded-3xl shadow-xl border border-primary/20 w-full max-w-4xl">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-on-surface">Plantas Encontradas ({floorPlansExtracted.length})</h3>
                      <button onClick={() => setFloorPlansExtracted([])} className="text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">Limpar / Novo PDF</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
                      {floorPlansExtracted.map((plan, idx) => (
                        <div key={idx} className="bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-xl flex flex-col gap-3 group hover:border-primary/50 transition-colors">
                          <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                            <span className="text-xs font-black text-on-surface-variant uppercase tracking-wider">Página {plan.index}</span>
                            <span className="material-symbols-outlined text-primary text-xl">architecture</span>
                          </div>
                          <h4 className="font-bold text-on-surface truncate" title={plan.name}>{plan.name}</h4>
                          <button 
                            onClick={() => setActivePlanToCrop(plan)}
                            className="w-full py-2 bg-primary/10 text-primary font-bold rounded-lg uppercase tracking-wider text-xs hover:bg-primary hover:text-on-primary transition-colors mt-auto">
                            Recortar Planta
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {!processingFloorPlanPdf && floorPlansExtracted.length === 0 && (
                  <>
                    <div className="w-32 h-32 mx-auto bg-surface-container-low rounded-3xl border-4 border-dashed border-primary/20 flex flex-col items-center justify-center text-primary/50 group-hover:border-primary/50 transition-colors animate-pulse shadow-inner">
                      <span className="material-symbols-outlined text-5xl mb-2">upload_file</span>
                      <span className="text-[10px] font-black uppercase tracking-widest">PDF AI</span>
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-bold text-on-surface mb-2">Selecione o Caderno de Plantas</h3>
                      <p className="text-on-surface-variant text-sm max-w-md mx-auto">
                        Não importa se o PDF tem 100 páginas de imagens e marketing. A IA vai vasculhar página por página e extrair magicamente apenas os desenhos técnicos para você.
                      </p>
                    </div>
                    
                    <label className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-primary text-on-primary font-bold uppercase tracking-widest cursor-pointer hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">
                      <span className="material-symbols-outlined">auto_awesome</span>
                      Iniciar Extração Mágica
                      <input type="file" className="hidden" accept=".pdf" onChange={handleFloorPlanPdfUpload} disabled={processingFloorPlanPdf} />
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activePlanToCrop && floorPlanPdfUrl && (
        <div className="fixed inset-0 z-[300] bg-black/90">
          <FloorPlanCropper
            pdfUrl={floorPlanPdfUrl}
            initialPage={activePlanToCrop.index}
            onComplete={(images) => {
               setCroppedImagesToAssociate({ name: activePlanToCrop.name, dataUrl: images[0] });
               setActivePlanToCrop(null);
            }}
            onCancel={() => setActivePlanToCrop(null)}
          />
        </div>
      )}

      {croppedImagesToAssociate && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col sunken-shadow border border-outline-variant/10">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
              <div>
                <h2 className="text-2xl font-headline font-bold text-on-surface">Atribuir Planta</h2>
                <p className="text-sm text-on-surface-variant font-body mt-2">
                  Planta: <strong className="text-primary">{croppedImagesToAssociate.name}</strong>
                </p>
              </div>
              <button onClick={() => setCroppedImagesToAssociate(null)} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors shadow-sm border border-outline-variant/10">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-8 max-h-[50vh] overflow-y-auto">
              <div className="flex gap-4 mb-6">
                <div className="w-1/3 bg-surface-container rounded-xl overflow-hidden shadow-inner flex items-center justify-center border border-outline-variant/10 p-2">
                  <img src={croppedImagesToAssociate.dataUrl} alt="Preview" className="max-w-full max-h-32 object-contain rounded-lg" />
                </div>
                <div className="w-2/3">
                  <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest mb-4">Selecione as Unidades</h3>
                  <div className="space-y-2">
                    {subUnits.map(u => (
                      <label key={u.id} className="flex items-center gap-3 p-3 rounded-lg border border-outline-variant/20 hover:bg-surface-container-low cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded border-outline-variant/50 text-primary focus:ring-primary bg-transparent"
                          checked={associationSelectedUnits.includes(u.id)}
                          onChange={(e) => {
                             if (e.target.checked) setAssociationSelectedUnits([...associationSelectedUnits, u.id]);
                             else setAssociationSelectedUnits(associationSelectedUnits.filter(id => id !== u.id));
                          }}
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface text-sm">{u.title}</span>
                          <span className="text-[10px] uppercase text-on-surface-variant/60">{t(`status.${u.status}`)} • {u.unit_type}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-surface-container-low border-t border-outline-variant/10 flex justify-end gap-4">
              <Button onClick={() => setCroppedImagesToAssociate(null)} variant="secondary">Cancelar</Button>
              <Button onClick={handleAssociateImageToUnits} disabled={isAssociating || associationSelectedUnits.length === 0} className="flex items-center gap-2">
                {isAssociating ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save</span>}
                {isAssociating ? 'Salvando...' : 'Salvar Associação'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <InvestmentSimulatorModal 
        isOpen={isSimulatorOpen} 
        onClose={() => setIsSimulatorOpen(false)} 
        property={property} 
      />
    </div>
  );
};
