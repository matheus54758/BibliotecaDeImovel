import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Link, useSearchParams } from "react-router-dom";
import { formatCurrency } from "../lib/utils";

export const Developments = () => {
  const { t } = useTranslation();
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
          .order('created_at', { ascending: false });

        if (builderId) {
          query = query.eq('builder_id', builderId);
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
  }, [builderId]);

  if (loading) {
    return <div className="p-8 text-on-surface/50 font-body">{t('developments.loading')}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <section className="mb-16 mt-8 flex flex-col md:flex-row justify-between items-end gap-8">
        <div className="max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-headline font-extrabold text-on-surface tracking-tight mb-4 leading-tight">
            {builderId ? t('developments.title_builder') : t('developments.title_premium')} <br />
            <span className="bg-gradient-to-r from-primary to-primary-container bg-clip-text text-transparent">
              {t('developments.title_suffix')}
            </span>
          </h2>
          <p className="text-lg text-on-surface-variant font-body leading-relaxed max-w-xl">
            {builderId 
              ? t('developments.subtitle_builder')
              : t('developments.subtitle_all')
            }
          </p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <Link to="/developments/new">
            <button className="flex-1 md:flex-none bg-gradient-primary text-on-primary font-body font-medium py-2.5 px-6 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-sm">add</span>
              {t('developments.new_asset')}
            </button>
          </Link>
          {builderId && (
            <Link to="/developments">
              <button className="flex-1 md:flex-none bg-surface-container-high text-primary font-body font-medium py-2.5 px-6 rounded-lg hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2">
                {t('common.show_all')}
              </button>
            </Link>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-24">
        {developments.length > 0 ? (
          developments.map((dev) => (
            <Link key={dev.id} to={`/developments/${dev.id}`}>
              <article
                className="group rounded-xl overflow-hidden bg-surface-container-low hover:bg-surface-bright transition-all duration-300 relative sunken-shadow h-full"
              >
                <div className="h-64 overflow-hidden relative">
                  <img
                    src={dev.hero_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"}
                    alt={dev.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-4 left-4 bg-tertiary-container text-on-tertiary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {t(`status.${dev.status}`)}
                  </div>
                </div>
                <div className="p-6 relative">
                  <div className="absolute -top-12 left-6 right-6 glass-panel rounded-lg p-4 sunken-shadow flex justify-between items-end">
                    <div>
                      <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">{dev.location}</p>
                      <h3 className="text-xl font-headline font-bold text-on-background">{dev.title}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-on-surface-variant font-medium">{t('common.starting_at')}</p>
                      <p className="text-lg font-headline font-extrabold text-primary">
                        {dev.price_starting_at ? formatCurrency(dev.price_starting_at) : t('common.consult')}
                      </p>
                    </div>
                  </div>
                  <div className="pt-8 mt-4 grid grid-cols-3 gap-4 border-t border-surface-container-highest/50">
                    <div className="flex flex-col items-center">
                      <span className="material-symbols-outlined text-on-surface-variant mb-1 text-sm">bed</span>
                      <span className="text-sm font-semibold text-on-surface">{dev.bedrooms} {t('developments.beds')}</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-r border-surface-container-highest/50">
                      <span className="material-symbols-outlined text-on-surface-variant mb-1 text-sm">shower</span>
                      <span className="text-sm font-semibold text-on-surface">{dev.bathrooms} {t('developments.baths')}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="material-symbols-outlined text-on-surface-variant mb-1 text-sm">square_foot</span>
                      <span className="text-sm font-semibold text-on-surface">{dev.sq_ft}m²</span>
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          ))
        ) : (
          <div className="col-span-full py-24 text-center bg-surface-container-low rounded-xl">
             <p className="text-on-surface/50 font-body">{t('developments.no_developments')}</p>
          </div>
        )}
      </section>
    </div>
  );
};
