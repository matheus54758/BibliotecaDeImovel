import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { formatCurrency, formatNumber } from "../lib/utils";
import { generatePropertyPDF } from "../lib/pdf";

export const PropertyPublic = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<any>(null);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<{url: string, type: 'image' | 'video'} | null>(null);

  useEffect(() => {
    async function fetchPublicProperty() {
      if (!id) return;
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
        console.error("Erro ao buscar imóvel público:", error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPublicProperty();
  }, [id]);

  if (loading) return <div className="p-20 text-center animate-pulse text-on-surface/30">Carregando detalhes do imóvel...</div>;
  if (!property) return <div className="p-20 text-center text-on-surface-variant">Imóvel não encontrado.</div>;

  return (
    <div className="max-w-[1440px] mx-auto pb-24 px-4 pt-12">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-12">
          <div className="relative h-[600px] w-full bg-surface-container-low rounded-3xl overflow-hidden shadow-2xl group cursor-zoom-in" onClick={() => setSelectedMedia({ url: property.hero_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop", type: 'image' })}>
            <img src={property.hero_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"} alt={property.title} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
            <div className="absolute top-6 left-6 flex gap-3">
              <span className="px-4 py-2 bg-white/90 backdrop-blur text-primary text-xs font-black uppercase tracking-[0.2em] rounded-full shadow-lg">
                {property.unit_type || 'Imóvel'}
              </span>
            </div>
          </div>

          <section className="bg-surface-container-lowest p-10 rounded-3xl sunken-shadow border border-outline-variant/10">
            <h2 className="text-3xl font-headline font-bold text-on-surface mb-8 tracking-tight border-b border-outline-variant/10 pb-6">Sobre este Imóvel</h2>
            <div className="space-y-8">
              <p className="text-lg text-on-surface-variant leading-relaxed font-body whitespace-pre-wrap">{property.description}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-8">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest mb-1">Área</span>
                  <span className="text-xl font-headline font-bold text-primary">{formatNumber(property.sq_ft)}m²</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest mb-1">Dormitórios</span>
                  <span className="text-xl font-headline font-bold text-primary">{property.bedrooms || 0}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest mb-1">Banheiros</span>
                  <span className="text-xl font-headline font-bold text-primary">{Math.max(1, property.bathrooms || 0)}</span>
                </div>
                {property.parent_id === null && property.parking_spaces > 0 && (
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
                    <img src={media.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={`Galeria ${idx}`} />
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
            <section className="bg-primary/5 p-10 rounded-3xl border border-primary/10">
              <h2 className="text-3xl font-headline font-bold text-primary mb-8 tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-3xl">payments</span> Plano de Pagamento
              </h2>
              <div className="space-y-8">
                <div className="flex justify-between items-center pb-6 border-b border-primary/10">
                  <span className="text-sm font-black text-primary/60 uppercase tracking-widest">Valor Total</span>
                  <span className="text-4xl font-headline font-black text-primary">{formatCurrency(property.price_starting_at || 0)}</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 pt-4">
                  {property.payment_entry > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                      <span className="text-base text-on-surface-variant font-medium">Entrada</span>
                      <span className="text-xl font-bold text-on-surface">{formatCurrency(property.payment_entry || 0)}</span>
                    </div>
                  )}

                  {property.payment_installment_count > 0 && property.payment_installment_value > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                      <span className="text-base text-on-surface-variant font-medium">{property.payment_installment_count}x Mensais</span>
                      <span className="text-xl font-bold text-on-surface">{formatCurrency(property.payment_installment_value || 0)}</span>
                    </div>
                  )}

                  {property.payment_reinforcement_count > 0 && property.payment_reinforcement_value > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                      <span className="text-base text-on-surface-variant font-medium">{property.payment_reinforcement_count}x Reforços</span>
                      <span className="text-xl font-bold text-on-surface">{formatCurrency(property.payment_reinforcement_value || 0)}</span>
                    </div>
                  )}

                  {property.payment_post_construction > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                      <span className="text-base text-on-surface-variant font-medium">Saldo Pós-Obra</span>
                      <span className="text-xl font-bold text-on-surface">{formatCurrency(property.payment_post_construction || 0)}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="lg:col-span-4 relative">
          <div className="sticky top-12 space-y-8">
            <div className="bg-surface-container-lowest rounded-3xl p-10 sunken-shadow border border-outline-variant/10">
              <h1 className="text-4xl font-headline font-black text-on-surface mb-2 tracking-tighter">{property.title}</h1>
              <p className="text-on-surface-variant flex items-start gap-2 text-sm leading-relaxed mb-10">
                <span className="material-symbols-outlined text-primary text-xl">location_on</span>
                {property.location}
              </p>

              <div className="bg-primary/5 p-8 rounded-2xl border border-primary/10 mb-10 text-center">
                <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] mb-2">Valor do Investimento</p>
                <p className="text-4xl font-headline font-black text-primary">
                  {property.price_starting_at ? formatCurrency(property.price_starting_at) : 'Consulte'}
                </p>
              </div>

              <div className="space-y-4">
                <Button className="w-full py-5 text-lg font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20">
                  Tenho Interesse
                </Button>
                
                <button 
                  onClick={() => generatePropertyPDF(property, amenities, gallery, [])}
                  className="w-full py-4 border-2 border-primary text-primary hover:bg-primary hover:text-on-primary transition-all rounded-2xl font-bold flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
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

            {property.builders && (
              <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-white overflow-hidden flex items-center justify-center shadow-md border border-outline-variant/20">
                  {property.builders.logo_url ? <img src={property.builders.logo_url} alt="Builder" className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-primary text-3xl">engineering</span>}
                </div>
                <div>
                  <p className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest">Construtora Parceira</p>
                  <p className="text-xl font-headline font-bold text-on-surface">{property.builders.name}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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
