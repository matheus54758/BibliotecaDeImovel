import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import { formatCurrency, formatNumber } from "../lib/utils";

export const Lands = () => {
  const { t } = useTranslation();
  const [lands, setLands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLands() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('developments')
          .select('*')
          .eq('user_id', user.id)
          .eq('unit_type', 'land')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setLands(data || []);
      } catch (error) {
        console.error("Error fetching lands:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLands();
  }, []);

  if (loading) return <div className="p-8 font-body text-on-surface/50">{t('common.loading')}</div>;

  return (
    <div className="max-w-7xl mx-auto py-12 px-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-headline font-bold text-on-surface mb-2 tracking-tight">Terrenos</h1>
          <p className="text-on-surface-variant font-body text-lg">Gerencie seus lotes e áreas para incorporação.</p>
        </div>
        <Link 
          to="/lands/new" 
          className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-on-primary font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-primary/20"
        >
          <span className="material-symbols-outlined">add_circle</span>
          Novo Terreno
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {lands.length > 0 ? (
          lands.map((land) => (
            <Link to={`/units/${land.id}`} key={land.id} className="group bg-surface-container-lowest rounded-3xl overflow-hidden sunken-shadow border border-outline-variant/10 hover:border-primary/30 transition-all">
              <div className="h-64 overflow-hidden relative">
                <img
                  src={land.hero_image_url || "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2000&auto=format&fit=crop"}
                  alt={land.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute top-4 left-4 bg-primary text-on-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                  Terreno
                </div>
                <div className={`absolute top-4 right-4 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${
                  land.status === 'sold' ? 'bg-red-500 text-white border-transparent' : 'bg-emerald-500 text-white border-transparent'
                }`}>
                  {t(`status.${land.status}`)}
                </div>
              </div>
              <div className="p-8">
                <h3 className="text-xl font-headline font-bold text-on-surface mb-2 group-hover:text-primary transition-colors">{land.title}</h3>
                <p className="text-on-surface-variant flex items-center gap-1.5 text-sm mb-6">
                  <span className="material-symbols-outlined text-sm">location_on</span>
                  {land.city}, {land.state}
                </p>
                <div className="flex justify-between items-center pt-6 border-t border-outline-variant/10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-on-surface-variant/50 tracking-widest">Área</span>
                    <span className="text-lg font-headline font-bold text-on-surface">{formatNumber(land.sq_ft)}m²</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] font-black uppercase text-on-surface-variant/50 tracking-widest">Valor</span>
                    <span className="text-lg font-headline font-bold text-primary">{formatCurrency(land.price_starting_at)}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full py-24 text-center bg-surface-container-low/30 rounded-3xl border-2 border-dashed border-outline-variant/20">
            <span className="material-symbols-outlined text-7xl text-on-surface/10 mb-6">landscape</span>
            <p className="text-on-surface-variant font-body text-xl">Nenhum terreno cadastrado.</p>
            <p className="text-on-surface/40 mt-2">Clique em "Novo Terreno" para começar.</p>
          </div>
        )}
      </div>
    </div>
  );
};
