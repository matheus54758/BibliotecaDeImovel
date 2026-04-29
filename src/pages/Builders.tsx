import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { cn } from "../lib/utils";
import { Link } from "react-router-dom";

export const Builders = () => {
  const { t } = useTranslation();
  const [builders, setBuilders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBuilders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBuilders([]);
        setLoading(false);
        return;
      }

      // Fetch builders with their project count
      const { data, error } = await supabase
        .from('builders')
        .select(`
          *,
          developments (id)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      setBuilders(data || []);
    } catch (error) {
      console.error("Error fetching builders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm(t('common.confirm_delete'))) return;

    setDeletingId(id);
    try {
      // Note: If builder has developments, this might fail unless developments are deleted first
      // or the DB has CASCADE DELETE. Showing error to user if it fails.
      const { error } = await supabase
        .from('builders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      alert(t('common.delete_success'));
      fetchBuilders();
    } catch (error: any) {
      console.error("Error deleting builder:", error);
      alert(`${t('common.delete_error')}: ${error.message || 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchBuilders();
  }, []);

  if (loading) {
    return <div className="p-8 text-on-surface/50 font-body">{t('builders.loading')}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-12 gap-6">
        <div>
          <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight mb-2">
            {t('builders.title')}
          </h1>
          <p className="font-body text-on-surface-variant text-lg">
            {t('builders.subtitle')}
          </p>
        </div>
        <Link to="/builders/new">
          <Button className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">add_business</span>
            {t('builders.add_new')}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {builders.length > 0 ? (
          builders.map((builder) => (
            <article
              key={builder.id}
              className="bg-surface-container-lowest rounded-xl p-6 transition-all duration-300 hover:bg-surface-bright hover:sunken-shadow group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex justify-between items-start mb-6">
                <div className="w-16 h-16 rounded-lg bg-surface-container flex items-center justify-center p-2">
                  {builder.logo_url ? (
                    <img
                      src={builder.logo_url}
                      alt={builder.name}
                      className="w-full h-full object-contain mix-blend-multiply"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-3xl text-on-surface/20">business</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-3 py-1 rounded-full font-label text-xs font-semibold",
                      builder.status === "active"
                        ? "bg-surface-container-low text-primary"
                        : "bg-surface-container-low text-on-surface-variant"
                    )}
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        builder.status === "active" ? "bg-tertiary-fixed-dim" : "bg-outline-variant"
                      )}
                    ></span>
                    {builder.status === 'active' ? t('builders.active') : t('builders.inactive')}
                  </span>
                  
                  <Link to={`/builders/edit/${builder.id}`}>
                    <button 
                      className="text-on-surface-variant hover:text-primary hover:bg-primary/10 p-1.5 rounded-full transition-all"
                      title={t('common.edit')}
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  </Link>

                  <button 
                    onClick={(e) => handleDelete(e, builder.id)}
                    disabled={deletingId === builder.id}
                    className="text-on-surface-variant hover:text-error hover:bg-error/10 p-1.5 rounded-full transition-all"
                    title={t('common.delete')}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {deletingId === builder.id ? 'sync' : 'delete'}
                    </span>
                  </button>
                </div>
              </div>
              <h3 className="font-headline text-xl font-bold text-on-surface mb-1">{builder.name}</h3>
              <p className="font-body text-sm text-on-surface-variant mb-6">
                {t(`specialization.${builder.specialization.toLowerCase().replace(/ /g, '_')}`, { defaultValue: builder.specialization })}
              </p>
              <div className="flex justify-between items-center pt-6 border-t border-surface-container">
                <div>
                  <p className="font-label text-xs text-on-surface-variant uppercase tracking-wider mb-1">
                    {t('builders.active_sites')}
                  </p>
                  <p
                    className={cn(
                      "font-headline text-2xl font-semibold",
                      builder.status === "active" ? "text-primary" : "text-on-surface-variant"
                    )}
                  >
                    {(builder.developments?.length || 0).toString().padStart(2, '0')}
                  </p>
                </div>
                <Link to={`/developments?builder=${builder.id}`}>
                  <Button variant="secondary" className="text-sm">
                    {t('common.view_portfolio')}
                  </Button>
                </Link>
              </div>
            </article>
          ))
        ) : (
          <div className="col-span-full py-12 text-center bg-surface-container-low rounded-xl">
            <p className="text-on-surface/50">{t('builders.no_builders')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
