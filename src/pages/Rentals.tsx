import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Link, useSearchParams, useLocation } from "react-router-dom";

export const Rentals = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [rentals, setRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRentals() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setRentals([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('developments')
          .select('*')
          .eq('user_id', user.id)
          .eq('unit_type', 'rental') // Filtra apenas aluguéis
          .order('created_at', { ascending: false });

        if (error) throw error;
        setRentals(data || []);
      } catch (error) {
        console.error("Error fetching rentals:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRentals();
  }, []);

  if (loading) {
    return <div className="p-8 text-on-surface/50 font-body">{t('common.loading')}</div>;
  }

  const title = "Aluguéis";
  const subtitle = "Administre seus imóveis para aluguel, acompanhe a disponibilidade e valores mensais.";

  return (
    <div className="max-w-7xl mx-auto">
      <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 mt-8 mb-2 font-body">
        <Link to="/" className="hover:text-primary transition-colors">{t('nav.overview')}</Link>
        <span className="material-symbols-outlined text-[10px]">chevron_right</span>
        <span className="text-primary/60">Aluguéis</span>
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
          <Link to="/rentals/new?type=property&unitType=rental">
            <button className="flex-1 md:flex-none bg-gradient-primary text-on-primary font-body font-medium py-2.5 px-6 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-sm">add</span>
              Novo Aluguel
            </button>
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-24">
        {rentals.length > 0 ? (
          rentals.map((rental) => (
            <Link key={rental.id} to={`/rentals/${rental.id}`}>
              <article
                className="group rounded-xl overflow-hidden bg-surface-container-low hover:bg-surface-bright transition-all duration-300 relative sunken-shadow h-full"
              >
                <div className="h-64 overflow-hidden relative">
                  {rental.hero_image_url?.match(/\.pdf$/i) ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-primary bg-primary/5">
                      <span className="material-symbols-outlined text-5xl">picture_as_pdf</span>
                      <span className="text-[10px] font-black mt-2 uppercase tracking-widest">Documento PDF</span>
                    </div>
                  ) : (
                    <img
                      src={rental.hero_image_url || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=2070&auto=format&fit=crop"}
                      alt={rental.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  )}
                  <div className={`absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                    rental.status === 'rented' || rental.title?.includes('(ALUGADO)')
                      ? 'bg-error/10 text-error border border-error/20' 
                      : 'bg-tertiary-container text-on-tertiary'
                  }`}>
                    {rental.status === 'rented' || rental.title?.includes('(ALUGADO)') 
                      ? 'Alugado' 
                      : 'Disponível'}
                  </div>
                </div>
                <div className="p-6 relative">
                  <div className="absolute -top-12 left-6 right-6 glass-panel rounded-lg p-4 sunken-shadow flex justify-between items-end">
                    <div>
                      <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">{rental.location}</p>
                      <h3 className="text-xl font-headline font-bold text-on-background">{rental.title}</h3>
                    </div>
                  </div>
                  <div className="pt-8 mt-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Valor Mensal</span>
                    <span className="text-lg font-black text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rental.rent_annual / 12 || rental.price_starting_at || 0)}
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          ))
        ) : (
          <div className="col-span-full py-24 text-center bg-surface-container-low rounded-xl">
             <p className="text-on-surface/50 font-body">
               Nenhum imóvel de aluguel cadastrado ainda.
             </p>
          </div>
        )}
      </section>
    </div>
  );
};

