import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import { formatCurrency } from "../lib/utils";
import { Button } from "../components/Button";

export const Consultancy = () => {
  const { t } = useTranslation();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const tags = [
    { id: 'has_garage', label: t('new_development.has_garage'), icon: 'garage' },
    { id: 'near_beach', label: t('new_development.near_beach'), icon: 'beach_access' },
    { id: 'has_deed', label: t('new_development.has_deed'), icon: 'description' },
  ];

  useEffect(() => {
    fetchFilteredProperties();
  }, [selectedTags, maxPrice]);

  async function fetchFilteredProperties() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setProperties([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('developments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Apply tag filters
      selectedTags.forEach(tag => {
        query = query.eq(tag, true);
      });

      // Apply price filter
      if (maxPrice && !isNaN(parseFloat(maxPrice))) {
        query = query.lte('price_starting_at', parseFloat(maxPrice));
      }

      const { data, error } = await query;
      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Error fetching properties:", error);
    } finally {
      setLoading(false);
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId) 
        : [...prev, tagId]
    );
  };

  return (
    <div className="max-w-7xl mx-auto py-8">
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-bold text-on-surface mb-2 tracking-tight">
          {t('nav.consultancy')}
        </h1>
        <p className="text-on-surface-variant font-body text-lg">
          {t('consultancy.subtitle')}
        </p>
      </header>

      {/* Filters Section */}
      <section className="bg-surface-container-lowest p-6 rounded-2xl sunken-shadow mb-12 space-y-6">
        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
          {/* Price Filter */}
          <div className="w-full md:w-64 space-y-2">
            <label className="block text-sm font-label font-bold text-on-surface uppercase tracking-wider">
              {t('consultancy.max_price')}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/50 font-body">R$</span>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Ex: 500000"
                className="w-full bg-surface-container-high border-0 rounded-xl py-3 pl-12 pr-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-body"
              />
            </div>
          </div>

          {/* Tags Filter */}
          <div className="flex-1 space-y-2">
            <label className="block text-sm font-label font-bold text-on-surface uppercase tracking-wider">
              {t('consultancy.features')}
            </label>
            <div className="flex flex-wrap gap-3">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all font-body text-sm font-medium ${
                    selectedTags.includes(tag.id)
                      ? 'bg-primary border-primary text-on-primary shadow-lg shadow-primary/20'
                      : 'bg-surface-container-high border-transparent text-on-surface-variant hover:border-outline-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{tag.icon}</span>
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Reset Button */}
          {(maxPrice || selectedTags.length > 0) && (
            <button 
              onClick={() => { setMaxPrice(""); setSelectedTags([]); }}
              className="text-primary text-sm font-bold hover:underline pt-4 md:pt-6"
            >
              {t('consultancy.clear_filters')}
            </button>
          )}
        </div>
      </section>

      {/* Results Section */}
      {loading ? (
        <div className="py-20 text-center text-on-surface/50 font-body">{t('common.loading')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {properties.length > 0 ? (
            properties.map((prop) => (
              <Link key={prop.id} to={`/developments/${prop.id}`}>
                <article className="group bg-surface-container-low rounded-2xl overflow-hidden hover:bg-surface-bright transition-all duration-300 sunken-shadow h-full border border-transparent hover:border-primary/10">
                  <div className="h-48 overflow-hidden relative">
                    <img
                      src={prop.hero_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"}
                      alt={prop.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute top-4 right-4 bg-surface-container-lowest/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-primary">
                      {t(`status.${prop.status}`)}
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="text-xl font-headline font-bold text-on-surface group-hover:text-primary transition-colors">{prop.title}</h3>
                      <p className="text-sm text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">location_on</span>
                        {prop.location}
                      </p>
                    </div>
                    
                    <div className="text-2xl font-headline font-black text-primary">
                      {prop.price_starting_at ? formatCurrency(prop.price_starting_at) : t('common.consult')}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {prop.has_garage && <div className="p-1.5 bg-primary/5 text-primary rounded-lg" title={t('new_development.has_garage')}><span className="material-symbols-outlined text-lg">garage</span></div>}
                      {prop.near_beach && <div className="p-1.5 bg-primary/5 text-primary rounded-lg" title={t('new_development.near_beach')}><span className="material-symbols-outlined text-lg">beach_access</span></div>}
                      {prop.has_deed && <div className="p-1.5 bg-primary/5 text-primary rounded-lg" title={t('new_development.has_deed')}><span className="material-symbols-outlined text-lg">description</span></div>}
                    </div>
                  </div>
                </article>
              </Link>
            ))
          ) : (
            <div className="col-span-full py-20 text-center bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant">
              <span className="material-symbols-outlined text-5xl text-on-surface/20 mb-4">search_off</span>
              <p className="text-on-surface-variant font-body text-lg">{t('consultancy.no_results')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
