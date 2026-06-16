import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { formatCurrency, formatNumber } from "../lib/utils";
import { generatePropertyPDF } from "../lib/pdf";
import { useUserTier } from "../hooks/useUserTier";

export const PropertyDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { tier } = useUserTier();
  const [property, setProperty] = useState<any>(null);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [subUnits, setSubUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{url: string, type: 'image' | 'video'} | null>(null);
  const [processingPdf, setProcessingPdf] = useState(false);
  const [selling, setSelling] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [updateReport, setUpdateReport] = useState<{
    unit: string;
    oldPrice: number;
    newPrice: number;
    status: 'updated' | 'inserted' | 'no_change' | 'error';
    error?: string;
  }[] | null>(null);

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
      const arrayBuffer = await file.arrayBuffer();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: extractedData, error: funcError } = await supabase.functions.invoke('process-pdf-units', {
        body: arrayBuffer,
        headers: { 'Content-Type': 'application/pdf' }
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
        
        return {
          title: `${String(unit.title || "Unidade").trim()}${status === 'sold' ? ' (VENDIDO)' : status === 'reserved' ? ' (RESERVADO)' : ''}`,
          sq_ft: area,
          price_starting_at: cleanNumber(unit.price_starting_at),
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
      existingUnits?.forEach(u => existingMap.set(u.title, u));

      const report: any[] = [];
      let successCount = 0;

      for (const unit of unitsToInsert) {
        const existing = existingMap.get(unit.title);

        if (existing && isUpdateMode) {
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
            property.parent_id !== null 
              ? `/units/edit/${id}` 
              : (isStandaloneProperty ? `/units/edit/${id}?type=property` : `/projects/edit/${id}?type=project`)
          }><button className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors flex items-center gap-2"><span className="material-symbols-outlined">edit</span><span className="text-sm font-medium">{t('common.edit')}</span></button></Link>
          <button onClick={handleDelete} disabled={deleting} className="text-error hover:bg-error/10 p-2 rounded-full transition-colors flex items-center gap-2"><span className="material-symbols-outlined">{deleting ? 'sync' : 'delete'}</span><span className="text-sm font-medium">{deleting ? t('common.deleting') : t('common.delete')}</span></button>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4">
        <div className="lg:col-span-8 space-y-12">
          <div className="space-y-4">
            <div className="relative h-[614px] min-h-[500px] w-full bg-surface-container-low rounded-xl overflow-hidden group cursor-zoom-in" onClick={() => setSelectedMedia({ url: property.hero_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop", type: property.hero_image_url?.match(/\.pdf$/i) ? 'image' : 'image' })}>
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
                  <button onClick={() => generatePropertyPDF(property, amenities, gallery, subUnits)} className="w-full py-3 border-2 border-primary text-primary hover:bg-primary hover:text-on-primary transition-all rounded-md font-bold flex items-center justify-center gap-2"><span className="material-symbols-outlined">download</span>{t('common.download_pdf')}</button>
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
                <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-xl border border-outline-variant/30">
                  <input 
                    type="checkbox" 
                    id="updateMode" 
                    checked={isUpdateMode} 
                    onChange={(e) => setIsUpdateMode(e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <label htmlFor="updateMode" className="text-[10px] font-black text-on-surface uppercase tracking-widest cursor-pointer select-none">
                    Atualizar existentes
                  </label>
                </div>
                <Link to={`/developments/new?parentId=${id}`} className="flex items-center gap-3 px-6 py-3 rounded-xl bg-primary text-on-primary font-bold uppercase tracking-wider hover:opacity-90 transition-all sunken-shadow">
                  <span className="material-symbols-outlined">add_circle</span>Adicionar Unidade
                </Link>
                <label className={`flex items-center gap-3 px-6 py-3 rounded-xl cursor-pointer transition-all duration-300 border-2 border-dashed ${processingPdf ? 'bg-primary/5 border-primary/40 animate-pulse' : 'bg-surface-container-high border-outline-variant hover:border-primary hover:bg-surface-bright'}`}>
                  {processingPdf ? (<><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div><span className="text-sm font-bold text-primary uppercase tracking-wider">Extraindo...</span></>) : (<><span className="material-symbols-outlined text-primary">upload_file</span><span className="text-sm font-bold text-on-surface uppercase tracking-wider">Importar PDF</span></>)}
                  <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} disabled={processingPdf} />
                </label>
              </div>
            </div>

            {subUnits.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {subUnits.map((unit) => (
                  <article key={unit.id} className="bg-surface-container-low rounded-xl p-6 flex flex-col justify-between border border-transparent hover:border-primary/20 transition-all group">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`font-headline font-bold text-lg leading-tight ${unit.title?.includes('(INDISPONÍVEL)') ? 'text-on-surface/40' : 'text-on-surface group-hover:text-primary'}`}>{unit.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(unit.status, unit.title)}`}>
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
            ) : (
              <div className="py-20 text-center bg-surface-container-low/50 rounded-2xl border-2 border-dashed border-outline-variant/20"><span className="material-symbols-outlined text-6xl text-on-surface/10 mb-4 italic">apartment</span><p className="text-on-surface-variant font-body text-lg italic">Nenhuma unidade cadastrada neste empreendimento ainda.</p><p className="text-sm text-on-surface/40 mt-2">Use o botão acima para importar unidades via PDF.</p></div>
            )}
          </section>
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
    </div>
  );
};
