import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { formatCurrency, formatNumber } from "../lib/utils";
import { generatePropertyPDF } from "../lib/pdf";
import { useTheme } from "../hooks/useTheme";
import { PropertyChatWidget } from "../components/PropertyChatWidget";

export const PropertyPublic = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [property, setProperty] = useState<any>(null);
  const [parentDevelopment, setParentDevelopment] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [subUnits, setSubUnits] = useState<any[]>([]);
  const [similarProperties, setSimilarProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<{url: string, type: 'image' | 'video'} | null>(null);

  useEffect(() => {
    async function fetchPublicProperty() {
      if (!id) return;
      setLoading(true);
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
        const parentProjectId = data.parent_id || data.id;

        if (data.user_id) {
          const [profileRes, similarRes, parentRes] = await Promise.all([
            supabase
              .from('public_profiles')
              .select('*')
              .eq('id', data.user_id)
              .maybeSingle(),
            supabase
              .from('developments')
              .select('id, title, location, city, sq_ft, bedrooms, price_starting_at, hero_image_url, unit_type, status')
              .eq('user_id', data.user_id)
              .is('parent_id', null)
              .neq('id', parentProjectId)
              .eq('status', 'available')
              .limit(4),
            data.parent_id
              ? supabase
                  .from('developments')
                  .select('*, builders(*)')
                  .eq('id', data.parent_id)
                  .maybeSingle()
              : Promise.resolve({ data: null })
          ]);

          if (profileRes.data) setProfile(profileRes.data);
          setSimilarProperties(similarRes.data || []);
          setParentDevelopment(parentRes.data || null);
        }

        const [amenityRes, galleryRes, unitsRes] = await Promise.all([
          supabase.from('amenities').select('*').eq('development_id', parentProjectId),
          supabase.from('development_images').select('*').eq('development_id', id).order('display_order', { ascending: true }),
          supabase.from('developments').select('*').eq('parent_id', parentProjectId).order('price_starting_at', { ascending: true })
        ]);

        setAmenities(amenityRes.data || []);
        setGallery((galleryRes.data || []).map(item => ({ ...item, type: item.url.match(/\.(mp4|webm|ogg)$/i) ? 'video' : 'image' })));
        setSubUnits(unitsRes.data || []);

      } catch (error: any) {
        console.error("Erro ao buscar imóvel público:", error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPublicProperty();
  }, [id]);

  useEffect(() => {
    if (!profile?.theme_config) return;
    const { facebook_pixel_id, google_analytics_id } = profile.theme_config;

    // Injeção do Facebook Pixel
    if (facebook_pixel_id) {
      if (!document.getElementById('fb-pixel')) {
        const script = document.createElement('script');
        script.id = 'fb-pixel';
        script.innerHTML = `
          !function(f,b,e,v,n,t,s)
          {if(f,fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${facebook_pixel_id}');
        `;
        document.head.appendChild(script);
      }
      // @ts-ignore
      if (window.fbq) {
        // @ts-ignore
        window.fbq('track', 'ViewContent', { content_ids: [id], content_type: 'product', content_name: property?.title });
      }
    }

    // Injeção do Google Analytics
    if (google_analytics_id) {
      if (!document.getElementById('ga-script')) {
        const script = document.createElement('script');
        script.id = 'ga-script';
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${google_analytics_id}`;
        document.head.appendChild(script);

        const scriptInit = document.createElement('script');
        scriptInit.innerHTML = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${google_analytics_id}');
        `;
        document.head.appendChild(scriptInit);
      }
      // @ts-ignore
      if (window.gtag) {
        // @ts-ignore
        window.gtag('event', 'view_item', { items: [{ id, name: property?.title }] });
      }
    }
  }, [profile, id, property?.title]);

  if (loading) return <div className="p-20 text-center animate-pulse text-on-surface/30">Carregando detalhes do imóvel...</div>;
  if (!property) return <div className="p-20 text-center text-on-surface-variant">Imóvel não encontrado.</div>;

  const availableUnits = subUnits.filter(u => u.status === 'available' && u.id !== property.id);

  return (
    <div className="max-w-[1440px] mx-auto pb-28 px-4 pt-12">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12">
        <div className="lg:col-span-8 space-y-10">
          <div className="space-y-4">
            <div className="bg-surface-container-lowest p-6 md:p-8 rounded-3xl sunken-shadow border border-outline-variant/10">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
                  <span className="material-symbols-outlined text-base">apartment</span>
                  <span>
                    {parentDevelopment
                      ? `Empreendimento: ${parentDevelopment.title}`
                      : "Empreendimento / Imóvel"}
                  </span>
                </div>
                {parentDevelopment && (
                  <button
                    onClick={() => navigate(`/view/${parentDevelopment.id}?chat=open`)}
                    className="text-xs font-black text-primary hover:underline uppercase tracking-widest flex items-center gap-1"
                  >
                    Ver Empreendimento Completo
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-black text-on-surface tracking-tight break-words leading-tight">
                {property.title}
              </h1>
              {(property.location || parentDevelopment?.location || property.city) && (
                <p className="text-on-surface-variant flex items-center gap-1.5 text-sm mt-2">
                  <span className="material-symbols-outlined text-primary text-lg">location_on</span>
                  <span>{property.location || parentDevelopment?.location || property.city}</span>
                </p>
              )}
            </div>

            <div className="relative h-[600px] w-full bg-surface-container-low rounded-3xl overflow-hidden shadow-2xl group cursor-zoom-in" onClick={() => setSelectedMedia({ url: property.hero_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop", type: property.hero_image_url?.match(/\.pdf$/i) ? 'image' : 'image' })}>
            {property.hero_image_url?.match(/\.pdf$/i) ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-primary bg-primary/5">
                <span className="material-symbols-outlined text-[120px]">picture_as_pdf</span>
                <span className="text-2xl font-black mt-4 uppercase tracking-[0.2em]">Documento PDF</span>
                <a href={property.hero_image_url} target="_blank" rel="noopener noreferrer" className="mt-8 px-8 py-3 bg-primary text-on-primary rounded-full font-bold uppercase tracking-widest hover:opacity-90 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  Abrir Documento
                </a>
              </div>
            ) : (
              <img src={property.hero_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"} alt={property.title} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
            )}
            <div className="absolute top-6 left-6 flex gap-3">
              <span className="px-4 py-2 bg-white/90 backdrop-blur text-primary text-xs font-black uppercase tracking-[0.2em] rounded-full shadow-lg">
                {['land', 'mixed', 'commercial_center', 'residential_center', 'dormitory', 'studio', 'commercial', 'house'].includes(property.unit_type) 
                  ? t(`consultancy.types.${property.unit_type}`) 
                  : 'Imóvel'}
              </span>
            </div>
            </div>
          </div>

          <section className="bg-surface-container-lowest p-10 rounded-3xl sunken-shadow border border-outline-variant/10">
            <h2 className="text-3xl font-headline font-bold text-on-surface mb-8 tracking-tight border-b border-outline-variant/10 pb-6">
              {parentDevelopment ? `Sobre esta Unidade (${parentDevelopment.title})` : "Sobre este Empreendimento"}
            </h2>
            <div className="space-y-8">
              <p className="text-lg text-on-surface-variant leading-relaxed font-body whitespace-pre-wrap">{property.description}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-8">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest mb-1">Área</span>
                  <span className="text-xl font-headline font-bold text-primary">{formatNumber(property.sq_ft)}m²</span>
                </div>
                {property.unit_type !== 'land' && (
                  <>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest mb-1">Dormitórios</span>
                      <span className="text-xl font-headline font-bold text-primary">{property.bedrooms || 0}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest mb-1">Banheiros</span>
                      <span className="text-xl font-headline font-bold text-primary">{Math.max(1, property.bathrooms || 0)}</span>
                    </div>
                  </>
                )}
                {property.parking_spaces > 0 && property.unit_type !== 'land' && (
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest mb-1">Vagas</span>
                    <span className="text-xl font-headline font-bold text-primary">{property.parking_spaces}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {gallery.length > 0 && (
            <section className="space-y-8">
              <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight">Galeria de Fotos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {gallery.map((media, idx) => (
                  <div key={idx} className="relative aspect-[4/3] bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant/10 cursor-zoom-in group" onClick={() => setSelectedMedia({ url: media.url, type: media.type })}>
                    {media.url.match(/\.pdf$/i) ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-primary bg-primary/5 p-8">
                        <span className="material-symbols-outlined text-6xl">picture_as_pdf</span>
                        <span className="text-xs font-bold mt-4 uppercase text-center">Documento PDF</span>
                      </div>
                    ) : (
                      <img src={media.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={`Galeria ${idx}`} />
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {(amenities.length > 0 || property.is_penthouse || property.near_beach || property.has_garage || property.has_balcony_grill || property.is_furnished || property.has_sea_view || property.is_pet_friendly || property.has_complete_leisure || property.has_automation) && (
            <section className="bg-surface-container-lowest p-10 rounded-3xl sunken-shadow border border-outline-variant/10">
              <h2 className="text-3xl font-headline font-bold text-on-surface mb-8 tracking-tight border-b border-outline-variant/10 pb-6">Diferenciais e Lazer</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {/* Features direct from property */}
                {property.is_penthouse && <FeatureItem icon="home_work" label="Cobertura" />}
                {property.near_beach && <FeatureItem icon="beach_access" label="Próximo à Praia" />}
                {property.has_garage && <FeatureItem icon="garage" label="Vaga de Garagem" />}
                {property.has_balcony_grill && <FeatureItem icon="outdoor_grill" label="Churrasqueira na Sacada" />}
                {property.is_furnished && <FeatureItem icon="chair" label="Mobiliado" />}
                {property.has_sea_view && <FeatureItem icon="visibility" label="Vista para o Mar" />}
                {property.is_pet_friendly && <FeatureItem icon="pets" label="Pet Friendly" />}
                {property.has_complete_leisure && <FeatureItem icon="pool" label="Lazer Completo" />}
                {property.has_automation && <FeatureItem icon="smart_toy" label="Automação Residencial" />}
                
                {/* Amenities from database */}
                {amenities.map((amenity, idx) => (
                  <FeatureItem key={idx} icon="check_circle" label={amenity.name} />
                ))}
              </div>
            </section>
          )}

          {property.price_starting_at > 0 && (
            <section className="bg-primary/5 p-6 sm:p-8 md:p-10 rounded-3xl border border-primary/10">
              <h2 className="text-2xl sm:text-3xl font-headline font-bold text-primary mb-6 sm:mb-8 tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl sm:text-3xl">payments</span> Plano de Pagamento
              </h2>
              <div className="space-y-6">
                <div className="flex flex-wrap justify-between items-baseline gap-2 pb-5 border-b border-primary/10">
                  <span className="text-sm font-black text-primary/60 uppercase tracking-widest">Valor Total</span>
                  <span className="text-2xl sm:text-3xl xl:text-4xl font-headline font-black text-primary break-words">{formatCurrency(property.price_starting_at || 0)}</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-2">
                  {property.payment_entry > 0 && (
                    <div className="flex flex-wrap justify-between items-baseline gap-2 py-2 border-b border-outline-variant/10">
                      <span className="text-sm sm:text-base text-on-surface-variant font-medium">Entrada</span>
                      <span className="text-lg sm:text-xl font-bold text-on-surface">{formatCurrency(property.payment_entry || 0)}</span>
                    </div>
                  )}

                  {property.payment_installment_count > 0 && property.payment_installment_value > 0 && (
                    <div className="flex flex-wrap justify-between items-baseline gap-2 py-2 border-b border-outline-variant/10">
                      <span className="text-sm sm:text-base text-on-surface-variant font-medium">{property.payment_installment_count}x Mensais</span>
                      <span className="text-lg sm:text-xl font-bold text-on-surface">{formatCurrency(property.payment_installment_value || 0)}</span>
                    </div>
                  )}

                  {property.payment_reinforcement_count > 0 && property.payment_reinforcement_value > 0 && (
                    <div className="flex flex-wrap justify-between items-baseline gap-2 py-2 border-b border-outline-variant/10">
                      <span className="text-sm sm:text-base text-on-surface-variant font-medium">{property.payment_reinforcement_count}x Reforços</span>
                      <span className="text-lg sm:text-xl font-bold text-on-surface">{formatCurrency(property.payment_reinforcement_value || 0)}</span>
                    </div>
                  )}

                  {property.payment_post_construction > 0 && (
                    <div className="flex flex-wrap justify-between items-baseline gap-2 py-2 border-b border-outline-variant/10">
                      <span className="text-sm sm:text-base text-on-surface-variant font-medium">Saldo Pós-Obra</span>
                      <span className="text-lg sm:text-xl font-bold text-on-surface">{formatCurrency(property.payment_post_construction || 0)}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {availableUnits.length > 0 && (
            <section className="bg-surface-container-lowest p-10 rounded-3xl sunken-shadow border border-outline-variant/10">
              <div className="mb-6">
                <h2 className="text-2xl font-headline font-bold text-on-surface tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">apartment</span>
                  {parentDevelopment
                    ? `Unidades em ${parentDevelopment.title}`
                    : `Unidades neste Empreendimento`}
                </h2>
                <p className="text-xs font-bold text-on-surface-variant mt-1">
                  {subUnits.length} unidades no total • {availableUnits.length} disponíveis para venda
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[520px] overflow-y-auto pr-2">
                {availableUnits.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => navigate(`/view/${u.id}?chat=open`)}
                    className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/15 hover:border-primary/50 cursor-pointer transition-all flex items-center justify-between gap-4 group"
                  >
                    <div>
                      <h3 className="font-headline font-bold text-base text-on-surface group-hover:text-primary transition-colors">
                        {u.title}
                      </h3>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {formatNumber(u.sq_ft)}m² • {u.bedrooms || 0} dorm.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-headline font-black text-base text-primary">
                        {u.price_starting_at > 0 ? formatCurrency(u.price_starting_at) : "Consulte"}
                      </div>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                        Ver Unidade →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {similarProperties.length > 0 && (
            <section className="bg-surface-container-lowest p-10 rounded-3xl sunken-shadow border border-outline-variant/10">
              <h2 className="text-2xl font-headline font-bold text-on-surface mb-6 tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">recommend</span>
                Outros Empreendimentos que Podem te Interessar
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {similarProperties.map((sim) => (
                  <div
                    key={sim.id}
                    onClick={() => navigate(`/view/${sim.id}?chat=open`)}
                    className="bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant/15 hover:border-primary/40 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="px-5 pt-4 pb-3">
                      <h3 className="font-headline font-bold text-lg text-on-surface group-hover:text-primary transition-colors break-words">
                        {sim.title}
                      </h3>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {sim.city || sim.location} • {formatNumber(sim.sq_ft)}m²
                      </p>
                    </div>
                    <div className="relative h-44 overflow-hidden">
                      <img
                        src={sim.hero_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=800&auto=format&fit=crop"}
                        alt={sim.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-5 pt-3 border-t border-outline-variant/10 flex items-center justify-between">
                      <span className="font-headline font-black text-lg text-primary">
                        {sim.price_starting_at > 0 ? formatCurrency(sim.price_starting_at) : "Consulte"}
                      </span>
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">
                        Ver Detalhes →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="lg:col-span-4 relative">
          <div className="sticky top-12 space-y-8">
            <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 sunken-shadow border border-outline-variant/10">
              {parentDevelopment && (
                <div className="text-[10px] font-black uppercase tracking-widest text-primary mb-1 break-words">
                  {parentDevelopment.title}
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl font-headline font-black text-on-surface mb-2 tracking-tighter break-words">{property.title}</h1>
              <p className="text-on-surface-variant flex items-start gap-2 text-sm leading-relaxed mb-8">
                <span className="material-symbols-outlined text-primary text-xl shrink-0">location_on</span>
                <span className="break-words">{property.location || parentDevelopment?.location}</span>
              </p>

              <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 mb-8 text-center">
                <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] mb-2">Valor do Investimento</p>
                <p className="text-2xl sm:text-3xl xl:text-4xl font-headline font-black text-primary break-words">
                  {property.price_starting_at ? formatCurrency(property.price_starting_at) : 'Consulte'}
                </p>
              </div>

              <div className="space-y-4">
                <Button 
                  onClick={() => {
                    // Triggers Lead tracking
                    // @ts-ignore
                    if (window.fbq) window.fbq('track', 'Lead', { content_name: property?.title });
                    // @ts-ignore
                    if (window.gtag) window.gtag('event', 'generate_lead', { item_name: property?.title });

                    if (profile?.whatsapp) {
                      const message = encodeURIComponent(`Olá! Tenho interesse no imóvel "${property.title}"${parentDevelopment ? ` (${parentDevelopment.title})` : ''} que vi no seu catálogo. Poderia me passar mais informações?`);
                      window.open(`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}?text=${message}`, '_blank');
                    } else {
                      alert('Este corretor ainda não configurou o WhatsApp.');
                    }
                  }}
                  className="w-full py-5 text-lg font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-2 bg-[#25D366] text-white hover:bg-[#1DA851] border-none"
                >
                  <span className="material-symbols-outlined">chat</span>
                  Falar no WhatsApp
                </Button>
                
                <button 
                  onClick={() => generatePropertyPDF(property, amenities, gallery, subUnits, theme)}
                  className="w-full px-6 py-4 bg-primary text-on-primary rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined">download</span>
                  Baixar Apresentação PDF
                </button>

                <button 
                  onClick={() => navigate(-1)} 
                  className="w-full py-4 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors uppercase tracking-widest"
                >
                  Voltar para Vitrine
                </button>
              </div>
            </div>

            {(property.builders || parentDevelopment?.builders) && (
              <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-white overflow-hidden flex items-center justify-center shadow-md border border-outline-variant/20">
                  {(property.builders?.logo_url || parentDevelopment?.builders?.logo_url) ? (
                    <img src={property.builders?.logo_url || parentDevelopment?.builders?.logo_url} alt="Builder" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-primary text-3xl">engineering</span>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest">Construtora Parceira</p>
                  <p className="text-xl font-headline font-bold text-on-surface">{property.builders?.name || parentDevelopment?.builders?.name}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Automatizado 24h com Gemini + Fallback Local */}
      <PropertyChatWidget
        property={property}
        parentDevelopment={parentDevelopment}
        profile={profile}
        amenities={amenities}
        subUnits={subUnits}
        similarProperties={similarProperties}
      />
    </div>
  );
};

const FeatureItem = ({ icon, label }: { icon: string, label: string }) => (
  <div className="flex items-center gap-3 p-4 bg-surface-container-high rounded-2xl border border-outline-variant/10 group hover:bg-primary/5 hover:border-primary/20 transition-all">
    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
      <span className="material-symbols-outlined text-xl">{icon}</span>
    </div>
    <span className="text-sm font-bold text-on-surface-variant group-hover:text-primary transition-colors">{label}</span>
  </div>
);
