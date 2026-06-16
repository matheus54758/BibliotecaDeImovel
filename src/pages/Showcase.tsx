import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { formatCurrency, formatNumber } from "../lib/utils";

export const Showcase = () => {
  const { t } = useTranslation();
  const { userId } = useParams();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerTier, setOwnerTier] = useState<'free' | 'paid'>('free');
  
  // Filters
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [minSqFt, setMinSqFt] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedDevType, setSelectedDevType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [searchCity, setSearchCity] = useState<string>("");
  const [searchState, setSearchState] = useState<string>("");
  const [searchStreet, setSearchStreet] = useState<string>("");

  const propertyTypes = [
    { id: 'dormitory', label: 'Apartamento', icon: 'apartment' },
    { id: 'studio', label: 'Studio', icon: 'grid_view' },
    { id: 'commercial', label: 'Comercial', icon: 'storefront' },
    { id: 'house', label: 'Casa', icon: 'home' },
  ];

  const developmentTypes = [
    { id: 'land', label: 'Terreno', icon: 'landscape' },
    { id: 'mixed', label: 'Centro Empresarial e Residencial', icon: 'domain_add' },
    { id: 'commercial_center', label: 'Centro Empresarial', icon: 'business_center' },
    { id: 'residential_center', label: 'Centro Residencial', icon: 'apartment' },
  ];

  const tags = [
    { id: 'has_garage', label: 'Garagem', icon: 'garage' },
    { id: 'near_beach', label: 'Próximo à Praia', icon: 'beach_access' },
    { id: 'has_deed', label: 'Escritura', icon: 'description' },
    { id: 'is_penthouse', label: 'Cobertura', icon: 'vertical_align_top' },
    { id: 'has_balcony_grill', label: 'Churrasqueira', icon: 'outdoor_grill' },
    { id: 'is_furnished', label: 'Mobiliado', icon: 'chair' },
    { id: 'has_sea_view', label: 'Vista Mar', icon: 'visibility' },
    { id: 'is_pet_friendly', label: 'Pet Friendly', icon: 'pets' },
    { id: 'has_complete_leisure', label: 'Lazer Completo', icon: 'pool' },
    { id: 'has_automation', label: 'Automação', icon: 'smart_toy' },
  ];

  useEffect(() => {
    async function fetchOwnerInfo() {
      if (!userId) return;
      try {
        const { data } = await supabase.from('public_profiles').select('*').eq('id', userId).maybeSingle();
        if (data) {
          // Branding/tier info could go here
        }
      } catch (err) {
        console.error("Error fetching owner info:", err);
      }
    }
    fetchOwnerInfo();
    fetchShowcaseProperties();
  }, [userId, selectedTags, maxPrice, minSqFt, selectedType, selectedDevType, selectedStatus, searchCity, searchState, searchStreet]);

  async function fetchShowcaseProperties() {
    if (!userId) return;
    setLoading(true);
    try {
      setOwnerTier('free'); 

      let query = supabase
        .from('developments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (selectedType) query = query.eq('unit_type', selectedType);
      if (selectedDevType) query = query.eq('unit_type', selectedDevType);
      if (selectedStatus) query = query.eq('status', selectedStatus);
      if (maxPrice) query = query.lte('price_starting_at', parseFloat(maxPrice));
      if (minSqFt) query = query.gte('sq_ft', parseFloat(minSqFt));
      if (searchCity.trim()) query = query.ilike('city', `%${searchCity.trim()}%`);
      if (searchState.trim()) query = query.ilike('state', `%${searchState.trim()}%`);
      if (searchStreet.trim()) query = query.ilike('street', `%${searchStreet.trim()}%`);

      selectedTags.forEach(tag => {
        query = query.eq(tag, true);
      });

      const { data, error } = await query;
      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Error fetching showcase:", error);
    } finally {
      setLoading(false);
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
  };

  return (
    <div className="max-w-7xl mx-auto py-12 px-4">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-headline font-bold text-on-surface mb-4 tracking-tight">Vitrine de Imóveis</h1>
        <p className="text-on-surface-variant font-body text-lg max-w-2xl mx-auto">Explore as melhores oportunidades selecionadas para você. Use os filtros abaixo para encontrar o imóvel ideal.</p>
      </header>

      <section className="bg-surface-container-lowest p-6 rounded-3xl sunken-shadow mb-12 space-y-8 border border-outline-variant/10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-2 space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Preço Máximo</label>
            <input 
              type="number" 
              value={maxPrice} 
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Ex: 500.000"
              className="w-full bg-surface-container-high border-0 rounded-xl py-3 px-4 text-on-surface"
            />
          </div>
          <div className="lg:col-span-2 space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Área Mín. (m²)</label>
            <input 
              type="number" 
              value={minSqFt} 
              onChange={(e) => setMinSqFt(e.target.value)}
              placeholder="Ex: 100"
              className="w-full bg-surface-container-high border-0 rounded-xl py-3 px-4 text-on-surface"
            />
          </div>
          <div className="lg:col-span-1 space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">UF</label>
            <input 
              type="text" 
              value={searchState} 
              onChange={(e) => setSearchState(e.target.value)}
              placeholder="SC"
              className="w-full bg-surface-container-high border-0 rounded-xl py-3 px-4 text-on-surface"
            />
          </div>
          <div className="lg:col-span-3 space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Cidade</label>
            <input 
              type="text" 
              value={searchCity} 
              onChange={(e) => setSearchCity(e.target.value)}
              placeholder="Qualquer cidade"
              className="w-full bg-surface-container-high border-0 rounded-xl py-3 px-4 text-on-surface"
            />
          </div>
          <div className="lg:col-span-4 space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Status</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'available', label: 'Disponível', color: 'bg-emerald-500' },
                { id: 'reserved', label: 'Reservado', color: 'bg-amber-500' },
                { id: 'sold', label: 'Vendido', color: 'bg-red-500' },
              ].map((status) => (
                <button
                  key={status.id}
                  onClick={() => setSelectedStatus(prev => prev === status.id ? "" : status.id)}
                  className={`px-4 py-2 rounded-full text-xs font-bold border-2 transition-all ${
                    selectedStatus === status.id
                      ? `border-transparent text-white shadow-lg ${status.color}`
                      : 'bg-surface-container-high border-transparent text-on-surface-variant hover:border-outline-variant'
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-outline-variant/10">
          <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Rua / Bairro</label>
          <input 
            type="text" 
            value={searchStreet} 
            onChange={(e) => setSearchStreet(e.target.value)}
            placeholder="Ex: Rua das Flores"
            className="w-full bg-surface-container-high border-0 rounded-xl py-3 px-4 text-on-surface"
          />
        </div>

        <div className="space-y-4 pt-4 border-t border-outline-variant/10">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Tipo de Unidade / Imóvel</label>
            <div className="flex flex-wrap gap-2">
              {propertyTypes.map(t => (
                <button 
                  key={t.id} 
                  onClick={() => {
                    setSelectedType(prev => prev === t.id ? "" : t.id);
                    setSelectedDevType("");
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border-2 transition-all ${selectedType === t.id ? 'bg-primary border-primary text-on-primary shadow-lg shadow-primary/20' : 'bg-surface-container-high border-transparent text-on-surface-variant'}`}
                >
                  <span className="material-symbols-outlined text-sm">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-outline-variant/10">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Tipo de Empreendimento / Área</label>
            <div className="flex flex-wrap gap-2">
              {developmentTypes.map(t => (
                <button 
                  key={t.id} 
                  onClick={() => {
                    setSelectedDevType(prev => prev === t.id ? "" : t.id);
                    setSelectedType("");
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border-2 transition-all ${selectedDevType === t.id ? 'bg-tertiary border-tertiary text-on-tertiary shadow-lg shadow-tertiary/20' : 'bg-surface-container-high border-transparent text-on-surface-variant'}`}
                >
                  <span className="material-symbols-outlined text-sm">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-outline-variant/10">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Características Desejadas</label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button 
                  key={tag.id} 
                  onClick={() => toggleTag(tag.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border-2 transition-all ${selectedTags.includes(tag.id) ? 'bg-secondary border-secondary text-on-secondary shadow-lg shadow-secondary/20' : 'bg-surface-container-high border-transparent text-on-surface-variant hover:border-outline-variant'}`}
                >
                  <span className="material-symbols-outlined text-sm">{tag.icon}</span>
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {(maxPrice || minSqFt || selectedTags.length > 0 || selectedType || selectedDevType || selectedStatus || searchCity || searchState || searchStreet) && (
          <div className="flex justify-end pt-2">
            <button 
              onClick={() => { 
                setMaxPrice(""); 
                setMinSqFt("");
                setSelectedTags([]); 
                setSelectedType(""); 
                setSelectedDevType("");
                setSelectedStatus(""); 
                setSearchCity(""); 
                setSearchState("");
                setSearchStreet("");
              }}
              className="text-primary text-xs font-black uppercase tracking-widest hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">filter_alt_off</span>
              Limpar Filtros
            </button>
          </div>
        )}
      </section>

      {loading ? (
        <div className="py-20 text-center text-on-surface/30 animate-pulse">Carregando imóveis...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {properties.map((prop) => (
            <Link key={prop.id} to={`/view/${prop.id}`}>
              <article className="group bg-surface-container-low rounded-3xl overflow-hidden hover:bg-surface-bright transition-all duration-500 sunken-shadow h-full border border-transparent hover:border-primary/20">
                <div className="h-56 overflow-hidden relative">
                  {prop.hero_image_url?.match(/\.pdf$/i) ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-primary bg-primary/5">
                      <span className="material-symbols-outlined text-5xl">picture_as_pdf</span>
                      <span className="text-[10px] font-black mt-2 uppercase tracking-widest">Documento PDF</span>
                    </div>
                  ) : (
                    <img src={prop.hero_image_url || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"} alt={prop.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  )}
                  <div className="absolute top-4 left-4 bg-primary text-on-primary text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full">
                    {['dormitory', 'studio', 'commercial', 'house', 'land', 'mixed', 'commercial_center', 'residential_center'].includes(prop.unit_type) 
                      ? t(`consultancy.types.${prop.unit_type}`) 
                      : 'Imóvel'}
                  </div>
                  {prop.status !== 'available' && (
                    <div className={`absolute top-4 right-4 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full ${prop.status === 'sold' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                      {prop.status === 'sold' ? 'Vendido' : 'Reservado'}
                    </div>
                  )}
                </div>
                <div className="p-8">
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-2 line-clamp-1 group-hover:text-primary transition-colors">{prop.title}</h3>
                  <p className="text-sm text-on-surface-variant flex items-center gap-1 mb-6"><span className="material-symbols-outlined text-sm">location_on</span>{prop.location}</p>
                  
                  <div className="flex justify-between items-end border-t border-outline-variant/10 pt-6">
                    <div>
                      <p className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest">A partir de</p>
                      <p className="text-2xl font-headline font-black text-primary">{prop.price_starting_at ? formatCurrency(prop.price_starting_at) : 'Consulte'}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="material-symbols-outlined text-on-surface-variant/30">chevron_right</span>
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}

      {properties.length === 0 && !loading && (
        <div className="py-32 text-center">
          <span className="material-symbols-outlined text-6xl text-on-surface/10 mb-4">home_work</span>
          <p className="text-on-surface-variant font-body">Nenhum imóvel disponível nesta vitrine no momento.</p>
        </div>
      )}

      {ownerTier === 'free' && (
        <footer className="mt-20 pt-12 border-t border-outline-variant/10 text-center">
          <Link to="/" className="inline-flex flex-col items-center group">
            <span className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.3em] mb-2 group-hover:text-primary transition-colors">Gerado por</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-headline font-black text-on-surface/20 group-hover:text-primary transition-all">Lumis</span>
              <span className="material-symbols-outlined text-on-surface/10 group-hover:text-primary transition-all">offline_bolt</span>
            </div>
            <p className="mt-2 text-[10px] font-bold text-on-surface-variant/30 uppercase tracking-widest">Inteligência Imobiliária para Corretores Pro</p>
          </Link>
        </footer>
      )}
    </div>
  );
};
