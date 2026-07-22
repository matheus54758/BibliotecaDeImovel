import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Link, useSearchParams, useLocation } from "react-router-dom";

export const Developments = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const isProjectsView = location.pathname === "/project-developments";
  const [developments, setDevelopments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const builderId = searchParams.get("builder");

  useEffect(() => {
    async function fetchDevelopments() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setDevelopments([]);
          setLoading(false);
          return;
        }

        let query = supabase
          .from('developments')
          .select('*')
          .eq('user_id', user.id)
          .is('parent_id', null) // Mostra apenas os prédios (pais)
          .neq('unit_type', 'land') // Exclui terrenos da aba de imóveis
          .neq('unit_type', 'rental') // Exclui locações, pois já possuem aba própria
          .order('created_at', { ascending: false });

        if (builderId) {
          query = query.eq('builder_id', builderId);
        } else if (isProjectsView) {
          // Show only those with a builder
          query = query.not('builder_id', 'is', null);
        } else {
          // Show only those WITHOUT a builder
          query = query.is('builder_id', null);
        }

        const { data, error } = await query;

        if (error) throw error;
        setDevelopments(data || []);
      } catch (error) {
        console.error("Error fetching developments:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDevelopments();
  }, [builderId, isProjectsView]);

  if (loading) {
    return <div className="p-8 text-on-surface/50 font-body">{t('common.loading')}</div>;
  }

  const title = builderId 
    ? t('developments.title_builder') 
    : (isProjectsView ? t('developments.title_project') : t('developments.title_premium'));
  
  const subtitle = builderId 
    ? t('developments.subtitle_builder')
    : (isProjectsView ? t('developments.subtitle_projects') : t('developments.subtitle_all'));

  return (
    <div className="max-w-7xl mx-auto">
      <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 mt-8 mb-2 font-body">
        <Link to="/" className="hover:text-primary transition-colors">{t('nav.overview')}</Link>
        <span className="material-symbols-outlined text-[10px]">chevron_right</span>
        <span className="text-primary/60">{isProjectsView ? t('nav.project_developments') : t('nav.developments')}</span>
      </nav>

      <section className="mb-16 mt-0 flex flex-col md:flex-row justify-between items-end gap-8">
        <div className="max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-headline font-extrabold text-on-surface tracking-tight mb-4 leading-tight">
            {title} <br />
            <span className="bg-gradient-to-r from-primary to-primary-container bg-clip-text text-transparent">
              {t('developments.title_suffix')}
            </span>
          </h2>
          <p className="text-lg text-on-surface-variant font-body leading-relaxed max-w-xl">
            {subtitle}
          </p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <Link to={isProjectsView ? "/projects/new?type=project" : "/units/new?type=property"}>
            <button className="flex-1 md:flex-none bg-gradient-primary text-on-primary font-body font-medium py-2.5 px-6 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-sm">add</span>
              {isProjectsView ? t('developments.new_project') : t('developments.new_asset')}
            </button>
          </Link>

        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-24">
        {developments.length > 0 ? (
          developments.map((dev) => (
            <Link key={dev.id} to={isProjectsView ? `/projects/${dev.id}` : `/units/${dev.id}`}>
              <article
                className="group rounded-xl overflow-hidden bg-surface-container-low hover:bg-surface-bright transition-all duration-300 relative sunken-shadow h-full"
              >
                <div className="h-64 overflow-hidden relative">
                  {dev.hero_image_url?.match(/\.pdf$/i) ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-primary bg-primary/5">
                      <span className="material-symbols-outlined text-5xl">picture_as_pdf</span>
                      <span className="text-[10px] font-black mt-2 uppercase tracking-widest">Documento PDF</span>
                    </div>
                  ) : (
                    <img
                      src={dev.hero_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"}
                      alt={dev.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  )}
                  <div className={`absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                    dev.title?.includes('(INDISPONÍVEL)') 
                      ? 'bg-error/10 text-error border border-error/20' 
                      : 'bg-tertiary-container text-on-tertiary'
                  }`}>
                    {dev.title?.includes('(INDISPONÍVEL)') 
                      ? t('status.unavailable') 
                      : (['land', 'mixed', 'commercial_center', 'residential_center'].includes(dev.unit_type)
                          ? t(`consultancy.types.${dev.unit_type}`) 
                          : (isProjectsView ? "Empreendimento" : "Imóvel")
                        )
                    }
                  </div>
                </div>
                <div className="p-6 relative">
                  <div className="absolute -top-12 left-6 right-6 glass-panel rounded-lg p-4 sunken-shadow flex justify-between items-end">
                    <div>
                      <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">{dev.location}</p>
                      <h3 className="text-xl font-headline font-bold text-on-background">{dev.title}</h3>
                    </div>
                  </div>
                  <div className="pt-8 mt-4">
                    {/* Espaçador para manter o design consistente após remover as métricas */}
                  </div>
                </div>
              </article>
            </Link>
          ))
        ) : (
          <div className="col-span-full py-24 text-center bg-surface-container-low rounded-xl">
             <p className="text-on-surface/50 font-body">
               {isProjectsView ? t('developments.no_projects') : t('developments.no_developments')}
             </p>
          </div>
        )}
      </section>
    </div>
  );
};

