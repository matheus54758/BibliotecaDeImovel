import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { formatCurrency } from "../lib/utils";

export const PropertyDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<any>(null);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm(t('common.confirm_delete'))) return;
    
    setDeleting(true);
    
    try {
      console.log("Iniciando limpeza de dependências para ID:", id);

      // Limpa apenas o que sabemos que existe e pode bloquear a exclusão
      await Promise.all([
        supabase.from('development_images').delete().eq('development_id', id),
        supabase.from('amenities').delete().eq('development_id', id)
      ]);

      console.log("Enviando comando DELETE para o Supabase...");
      
      // 2. Exclusão principal
      const { error, status, count } = await supabase
        .from('developments')
        .delete({ count: 'exact' })
        .eq('id', id);

      console.log("Resultado Supabase:", { error, status, count });

      if (error) {
        console.error("Erro detectado:", error);
        alert(`O Banco recusou: ${error.message}`);
        setDeleting(false);
      } else if (count === 0) {
        console.warn("Nenhuma linha foi apagada. Provavelmente erro de RLS (Permissão).");
        alert("Atenção: O comando foi aceito, mas 0 imóveis foram apagados.\n\nIsso geralmente indica que você não tem permissão de DELETE na tabela 'developments' no painel do Supabase.");
        setDeleting(false);
      } else {
        console.log("Sucesso! Linhas apagadas:", count);
        alert("Imóvel removido com sucesso!");
        window.location.replace('/developments');
      }
    } catch (err: any) {
      console.error("Erro catastrófico:", err);
      alert(`Erro inesperado no código:\n${err.message}`);
    } finally {
      console.log("Processo de exclusão finalizado.");
      setDeleting(false);
    }
  };

  useEffect(() => {
    async function fetchProperty() {
      if (!id || deleting) return; // Não busca se estiver apagando
      
      try {
        const { data, error } = await supabase
          .from('developments')
          .select('*, builders(*)')
          .eq('id', id)
          .maybeSingle(); // Usa maybeSingle para evitar erro 406 se retornar 0 linhas

        if (error) throw error;
        
        if (!data) {
          console.log("Imóvel não encontrado ou já removido.");
          setLoading(false);
          return;
        }

        setProperty(data);

        // Fetch Amenities
        const { data: amenityData } = await supabase
          .from('amenities')
          .select('*')
          .eq('development_id', id);
        setAmenities(amenityData || []);

        // Fetch Gallery Images
        const { data: galleryData } = await supabase
          .from('development_images')
          .select('*')
          .eq('development_id', id)
          .order('display_order', { ascending: true });
        setGallery(galleryData || []);

      } catch (error: any) {
        console.error("Erro ao buscar imóvel:", error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProperty();
  }, [id, deleting]);

  if (loading) return <div className="p-8 font-body text-on-surface/50">{t('developments.loading')}</div>;
  if (!property) return <div className="p-8">{t('common.no_data')}</div>;

  return (
    <div className="max-w-[1920px] mx-auto pb-24">
      {/* Lightbox Overlay */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-12 cursor-pointer"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-8 right-8 text-white/70 hover:text-white p-2 rounded-full transition-colors bg-white/10 hover:bg-white/20 z-10"
            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
          >
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>
          <img 
            src={selectedImage} 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in duration-300"
            alt="Full view"
          />
        </div>
      )}

      <nav className="py-6 text-sm text-on-surface-variant font-body flex justify-between items-center">
        <ol className="flex items-center gap-2">
          <li><button onClick={() => navigate('/developments')} className="hover:text-primary transition-colors">{t('nav.developments')}</button></li>
          <li><span className="material-symbols-outlined text-sm">chevron_right</span></li>
          <li className="font-medium text-on-surface">{property.title}</li>
        </ol>
        
        <div className="flex gap-2">
          <Link to={`/developments/edit/${id}`}>
            <button 
              className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors flex items-center gap-2"
              title={t('common.edit')}
            >
              <span className="material-symbols-outlined">edit</span>
              <span className="text-sm font-medium">{t('common.edit')}</span>
            </button>
          </Link>

          <button 
            onClick={handleDelete}
            disabled={deleting}
            className="text-error hover:bg-error/10 p-2 rounded-full transition-colors flex items-center gap-2"
            title={t('common.delete')}
          >
            <span className="material-symbols-outlined">{deleting ? 'sync' : 'delete'}</span>
            <span className="text-sm font-medium">{deleting ? t('common.deleting') : t('common.delete')}</span>
          </button>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-12">
          <div className="space-y-4">
            <div 
              className="relative h-[614px] min-h-[500px] w-full bg-surface-container-low rounded-xl overflow-hidden group cursor-zoom-in"
              onClick={() => setSelectedImage(property.hero_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop")}
            >
              <img
                src={property.hero_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"}
                alt={property.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute top-6 left-6 flex gap-3">
                <span className="bg-tertiary-container text-on-tertiary px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider font-label flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim"></span> {t(`status.${property.status}`)}
                </span>
              </div>
            </div>

            {gallery.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {gallery.slice(0, 3).map((img, idx) => (
                  <div 
                    key={img.id} 
                    className="h-48 rounded-lg overflow-hidden bg-surface-container-low cursor-zoom-in group relative"
                    onClick={() => setSelectedImage(img.url)}
                  >
                    <img 
                      src={img.url} 
                      className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${idx === 2 && gallery.length > 3 ? 'opacity-80' : ''}`} 
                    />
                    {idx === 2 && gallery.length > 3 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-sm">
                        <span className="text-on-primary font-medium flex items-center gap-2">
                          <span className="material-symbols-outlined">collections</span>
                          +{gallery.length - 3} More
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <section className="bg-surface-container-lowest p-8 lg:p-12 rounded-xl sunken-shadow">
            <h2 className="text-3xl font-headline font-bold text-on-surface mb-6 tracking-tight">{t('new_development.description')}</h2>
            <div className="space-y-6 text-on-surface-variant leading-relaxed text-lg font-body">
              <p>{property.description}</p>
            </div>
          </section>

          {amenities.length > 0 && (
            <section className="bg-surface-container-low p-8 lg:p-12 rounded-xl">
              <h3 className="text-2xl font-headline font-bold text-on-surface mb-8">Premium Amenities</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {amenities.map((amenity) => (
                  <div key={amenity.id} className="flex flex-col items-center justify-center text-center p-6 bg-surface-container-lowest rounded-xl sunken-shadow hover:bg-surface-bright transition-colors">
                    <span className="material-symbols-outlined text-4xl text-primary mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {amenity.icon_name || 'apps'}
                    </span>
                    <span className="font-medium text-sm text-on-surface">{amenity.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="lg:col-span-4 relative">
          <div className="sticky top-28 space-y-6">
            <div className="bg-surface-container-lowest rounded-xl sunken-shadow overflow-hidden">
              <div className="p-8">
                <h1 className="text-4xl font-headline font-bold text-on-surface mb-2 tracking-tighter">{property.title}</h1>
                <p className="text-on-surface-variant flex items-start gap-2 mb-8">
                  <span className="material-symbols-outlined text-primary mt-0.5">location_on</span>
                  {property.location}
                </p>
                <div className="mb-8">
                  <span className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">{t('common.starting_at')}</span>
                  <div className="text-4xl font-headline font-extrabold text-primary">
                    {property.price_starting_at ? formatCurrency(property.price_starting_at) : t('common.consult')}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <StatBox icon="bed" value={property.bedrooms} label={t('developments.beds')} />
                  <StatBox icon="shower" value={property.bathrooms} label={t('developments.baths')} />
                  <StatBox icon="garage_home" value={property.parking_spaces} label={t('new_development.parking')} />
                  <StatBox icon="square_foot" value={`${property.sq_ft}m²`} label={t('new_development.area')} />
                </div>

                {/* Novas Características (Só aparecem se forem verdadeiras) */}
                {(property.has_garage || property.near_beach || property.has_deed) && (
                  <div className="mb-8 space-y-3">
                    {property.has_garage && (
                      <div className="flex items-center p-3 bg-surface-container-low rounded-lg gap-3">
                        <span className="material-symbols-outlined text-primary">garage</span>
                        <span className="text-sm font-medium text-on-surface">{t('developments.garage_title')}</span>
                      </div>
                    )}

                    {property.near_beach && (
                      <div className="flex items-center p-3 bg-surface-container-low rounded-lg gap-3">
                        <span className="material-symbols-outlined text-primary">beach_access</span>
                        <span className="text-sm font-medium text-on-surface">{t('developments.beach_title')}</span>
                      </div>
                    )}

                    {property.has_deed && (
                      <div className="flex items-center p-3 bg-surface-container-low rounded-lg gap-3">
                        <span className="material-symbols-outlined text-primary">description</span>
                        <span className="text-sm font-medium text-on-surface">{t('developments.deed_title')}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-4">
                  <Button className="w-full py-4 text-lg font-bold flex items-center justify-center gap-2">
                    Request More Info
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </Button>
                </div>
              </div>
              
              {property.builders && (
                <div className="bg-surface-container-low p-6 flex items-center justify-between border-t border-outline-variant/20">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-surface-container-high overflow-hidden flex items-center justify-center">
                      {property.builders.logo_url ? (
                        <img src={property.builders.logo_url} alt="Builder" className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-primary">engineering</span>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-on-surface text-sm">{property.builders.name}</div>
                      <div className="text-xs text-on-surface-variant">{t('new_development.partner')}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ icon, value, label }: any) => (
  <div className="bg-surface-container-low p-4 rounded-lg flex items-center gap-3">
    <span className="material-symbols-outlined text-2xl text-secondary">{icon}</span>
    <div>
      <div className="font-bold text-on-surface">{value || 'N/A'}</div>
      <div className="text-xs text-on-surface-variant">{label}</div>
    </div>
  </div>
);
