import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import { formatCurrency } from "../lib/utils";

export const Consultancy = () => {
  const { t } = useTranslation();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [searchState, setSearchState] = useState<string>("");
  const [searchCity, setSearchCity] = useState<string>("");
  const [searchStreet, setSearchStreet] = useState<string>("");
  const [streetSuggestions, setStreetSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const propertyTypes = [
    { id: 'dormitory', label: t('consultancy.types.dormitory'), icon: 'apartment' },
    { id: 'studio', label: t('consultancy.types.studio'), icon: 'grid_view' },
    { id: 'commercial', label: t('consultancy.types.commercial'), icon: 'storefront' },
    { id: 'house', label: t('consultancy.types.house'), icon: 'home' },
  ];

  const tags = [
    { id: 'has_garage', label: t('new_development.has_garage'), icon: 'garage' },
    { id: 'near_beach', label: t('new_development.near_beach'), icon: 'beach_access' },
    { id: 'has_deed', label: t('new_development.has_deed'), icon: 'description' },
    { id: 'is_penthouse', label: t('consultancy.tags.is_penthouse'), icon: 'vertical_align_top' },
    { id: 'has_balcony_grill', label: t('consultancy.tags.has_balcony_grill'), icon: 'outdoor_grill' },
    { id: 'is_furnished', label: t('consultancy.tags.is_furnished'), icon: 'chair' },
    { id: 'has_sea_view', label: t('consultancy.tags.has_sea_view'), icon: 'visibility' },
    { id: 'is_pet_friendly', label: t('consultancy.tags.is_pet_friendly'), icon: 'pets' },
    { id: 'has_complete_leisure', label: t('consultancy.tags.has_complete_leisure'), icon: 'pool' },
    { id: 'has_automation', label: t('consultancy.tags.has_automation'), icon: 'smart_toy' },
  ];

  useEffect(() => {
    fetchFilteredProperties();
  }, [selectedTags, maxPrice, selectedType, selectedStatus, searchState, searchCity, searchStreet]);

  // Street Autocomplete Logic
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchStreet.length < 1) {
        setStreetSuggestions([]);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('developments')
          .select('street')
          .ilike('street', `${searchStreet}%`)
          .not('street', 'is', null)
          .limit(20);
        
        if (!error && data) {
          const uniqueStreets = Array.from(new Set(data.map(d => d.street))).filter(Boolean) as string[];
          setStreetSuggestions(uniqueStreets);
        }
      } catch (err) {
        console.error("Error fetching street suggestions:", err);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [searchStreet]);

  async function fetchFilteredProperties() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setProperties([]);
        setLoading(false);
        return;
      }

      // Query units (parent_id != null) and standalone properties (parent_id == null AND builder_id == null)
      // Exclude developments (parent_id == null AND builder_id != null)
      let query = supabase
        .from('developments')
        .select('*')
        .eq('user_id', user.id)
        .or('parent_id.not.is.null,builder_id.is.null')
        .order('created_at', { ascending: false });

      // Apply type filter
      if (selectedType) {
        query = query.eq('unit_type', selectedType);
      }

      // Apply status filter
      if (selectedStatus) {
        query = query.eq('status', selectedStatus);
      }

      // Apply tag filters
      selectedTags.forEach(tag => {
        query = query.eq(tag, true);
      });

      // Apply price filter
      if (maxPrice && !isNaN(parseFloat(maxPrice))) {
        query = query.lte('price_starting_at', parseFloat(maxPrice));
      }

      // Apply Location Filters
      if (searchState.trim()) {
        query = query.ilike('state', `%${searchState.trim()}%`);
      }
      if (searchCity.trim()) {
        query = query.ilike('city', `%${searchCity.trim()}%`);
      }
      if (searchStreet.trim()) {
        query = query.ilike('street', `%${searchStreet.trim()}%`);
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

  const toggleType = (typeId: string) => {
    setSelectedType(prev => prev === typeId ? "" : typeId);
  };

  return (
    <div className="max-w-7xl mx-auto py-8">
      <header className="mb-12 px-4 md:px-0">
        <h1 className="text-4xl font-headline font-bold text-on-surface mb-2 tracking-tight">
          {t('nav.consultancy')}
        </h1>
        <p className="text-on-surface-variant font-body text-lg">
          {t('consultancy.subtitle')}
        </p>
      </header>

      {/* Filters Section */}
      <section className="bg-surface-container-lowest p-6 rounded-2xl sunken-shadow mb-12 space-y-8 mx-4 md:mx-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          {/* Status Filter */}
          <div className="lg:col-span-4 space-y-2">
            <label className="block text-sm font-label font-bold text-on-surface uppercase tracking-wider">
              Status da Unidade
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'available', label: 'Disponível', color: 'bg-emerald-500', icon: 'check_circle' },
                { id: 'reserved', label: 'Reservado', color: 'bg-amber-500', icon: 'schedule' },
                { id: 'sold', label: 'Vendido', color: 'bg-red-500', icon: 'sell' },
              ].map((status) => (
                <button
                  key={status.id}
                  onClick={() => setSelectedStatus(prev => prev === status.id ? "" : status.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all font-body text-xs font-medium ${
                    selectedStatus === status.id
                      ? `border-transparent text-white shadow-lg ${status.color}`
                      : 'bg-surface-container-high border-transparent text-on-surface-variant hover:border-outline-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{status.icon}</span>
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div className="lg:col-span-8 space-y-2">
            <label className="block text-sm font-label font-bold text-on-surface uppercase tracking-wider">
              {t('consultancy.search_by_type')}
            </label>
            <div className="flex flex-wrap gap-2">
              {propertyTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => toggleType(type.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all font-body text-xs font-medium ${
                    selectedType === type.id
                      ? 'bg-primary border-primary text-on-primary shadow-lg shadow-primary/20'
                      : 'bg-surface-container-high border-transparent text-on-surface-variant hover:border-outline-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Location Filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-surface-container-high">
          <div className="md:col-span-2 space-y-2">
            <label className="block text-sm font-label font-bold text-on-surface uppercase tracking-wider">Estado</label>
            <input
              type="text"
              value={searchState}
              onChange={(e) => setSearchState(e.target.value)}
              placeholder="Ex: SC"
              className="w-full bg-surface-container-high border-0 rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-body"
            />
          </div>
          <div className="md:col-span-4 space-y-2">
            <label className="block text-sm font-label font-bold text-on-surface uppercase tracking-wider">Cidade</label>
            <input
              type="text"
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              placeholder="Ex: Balneário Camboriú"
              className="w-full bg-surface-container-high border-0 rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-body"
            />
          </div>
          <div className="md:col-span-6 space-y-2 relative">
            <label className="block text-sm font-label font-bold text-on-surface uppercase tracking-wider">Rua / Bairro</label>
            <input
              type="text"
              value={searchStreet}
              onChange={(e) => {
                setSearchStreet(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Ex: Rua das Flores"
              className="w-full bg-surface-container-high border-0 rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-body"
            />
            {showSuggestions && streetSuggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-surface-container-lowest mt-1 rounded-xl shadow-xl border border-outline-variant max-h-60 overflow-auto">
                {streetSuggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    onClick={() => {
                      setSearchStreet(suggestion);
                      setShowSuggestions(false);
                    }}
                    className="px-4 py-3 hover:bg-surface-container-high cursor-pointer text-on-surface font-body text-sm border-b border-outline-variant/30 last:border-0"
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Tags Filter */}
        <div className="space-y-2 pt-4 border-t border-surface-container-high">
          <label className="block text-sm font-label font-bold text-on-surface uppercase tracking-wider">
            {t('consultancy.features')}
          </label>
          <div className="flex flex-wrap gap-3">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all font-body text-xs font-medium ${
                  selectedTags.includes(tag.id)
                    ? 'bg-secondary border-secondary text-on-secondary shadow-lg shadow-secondary/20'
                    : 'bg-surface-container-high border-transparent text-on-surface-variant hover:border-outline-variant'
                }`}
              >
                <span className="material-symbols-outlined text-base">{tag.icon}</span>
                {tag.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Reset Button */}
        {(maxPrice || selectedTags.length > 0 || selectedType || selectedStatus || searchState || searchCity || searchStreet) && (
          <div className="flex justify-end pt-2">
            <button 
              onClick={() => { 
                setMaxPrice(""); 
                setSelectedTags([]); 
                setSelectedType(""); 
                setSelectedStatus("");
                setSearchState(""); 
                setSearchCity(""); 
                setSearchStreet(""); 
              }}
              className="flex items-center gap-1 text-primary text-sm font-bold hover:underline"
            >
              <span className="material-symbols-outlined text-sm">filter_alt_off</span>
              {t('consultancy.clear_filters')}
            </button>
          </div>
        )}
      </section>

      {/* Results Section */}
      {loading ? (
        <div className="py-20 text-center text-on-surface/50 font-body">{t('common.loading')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 px-4 md:px-0">
          {properties.length > 0 ? (
            properties.map((prop) => (
              <Link key={prop.id} to={`/units/${prop.id}`}>
                <article className="group bg-surface-container-low rounded-2xl overflow-hidden hover:bg-surface-bright transition-all duration-300 sunken-shadow h-full border border-transparent hover:border-primary/10">
                  <div className="h-48 overflow-hidden relative">
                    <img
                      src={prop.hero_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"}
                      alt={prop.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute top-4 left-4 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold bg-primary/90 text-on-primary uppercase tracking-widest">
                      {prop.unit_type ? t(`consultancy.types.${prop.unit_type}`) : t('nav.developments')}
                    </div>
                    <div className={`absolute top-4 right-4 backdrop-blur px-3 py-1 rounded-full text-xs font-bold ${
                      prop.title?.includes('(INDISPONÍVEL)') 
                        ? 'bg-error/10 text-error border border-error/20' 
                        : 'bg-surface-container-lowest/90 text-primary'
                    }`}>
                      {prop.title?.includes('(INDISPONÍVEL)') ? t('status.unavailable') : t(`status.${prop.status}`)}
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="text-xl font-headline font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1">{prop.title}</h3>
                      <p className="text-sm text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">location_on</span>
                        {prop.location}
                      </p>
                    </div>
                    
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-headline font-black text-primary">
                        {prop.price_starting_at ? formatCurrency(prop.price_starting_at) : t('common.consult')}
                      </span>
                      {prop.sq_ft > 0 && (
                        <span className="text-xs text-on-surface-variant font-body">
                          • {prop.sq_ft}m²
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {prop.has_garage && <div className="p-1.5 bg-primary/5 text-primary rounded-lg" title={t('developments.garage_title')}><span className="material-symbols-outlined text-lg">garage</span></div>}
                      {prop.near_beach && <div className="p-1.5 bg-primary/5 text-primary rounded-lg" title={t('developments.beach_title')}><span className="material-symbols-outlined text-lg">beach_access</span></div>}
                      {prop.is_penthouse && <div className="p-1.5 bg-primary/5 text-primary rounded-lg" title={t('consultancy.tags.is_penthouse')}><span className="material-symbols-outlined text-lg">vertical_align_top</span></div>}
                      {prop.has_sea_view && <div className="p-1.5 bg-primary/5 text-primary rounded-lg" title={t('consultancy.tags.has_sea_view')}><span className="material-symbols-outlined text-lg">visibility</span></div>}
                      {prop.is_furnished && <div className="p-1.5 bg-primary/5 text-primary rounded-lg" title={t('consultancy.tags.is_furnished')}><span className="material-symbols-outlined text-lg">chair</span></div>}
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

