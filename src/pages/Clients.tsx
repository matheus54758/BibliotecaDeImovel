import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { InputField } from "../components/InputField";

interface Interaction {
  id: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  interest_level: 'low' | 'medium' | 'high' | 'very_high';
  notes: string;
  contact_date: string;
  property_id: string | null;
  developments: {
    title: string;
  } | null;
}

export const Clients = () => {
  const { t } = useTranslation();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [properties, setProperties] = useState<{ id: string, title: string, parent?: { title: string } | any }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [propertySearch, setPropertySearch] = useState('');
  const [isPropertyDropdownOpen, setIsPropertyDropdownOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    client_name: '',
    client_phone: '',
    client_email: '',
    property_id: '',
    interest_level: 'medium' as 'low' | 'medium' | 'high' | 'very_high',
    notes: '',
    contact_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchInteractions();
    fetchProperties();
  }, []);

  const handleEdit = (item: Interaction) => {
    setEditingId(item.id);
    const selectedProp = properties.find(p => p.id === item.property_id);
    const propTitle = selectedProp 
      ? (selectedProp.parent ? `${selectedProp.parent.title || selectedProp.parent[0]?.title} - ${selectedProp.title}` : selectedProp.title)
      : '';
    
    setPropertySearch(propTitle);
    setFormData({
      client_name: item.client_name,
      client_phone: item.client_phone || '',
      client_email: item.client_email || '',
      property_id: item.property_id || '',
      interest_level: item.interest_level,
      notes: item.notes || '',
      contact_date: item.contact_date.split('T')[0]
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setPropertySearch('');
    setIsPropertyDropdownOpen(false);
    setFormData({
      client_name: '',
      client_phone: '',
      client_email: '',
      property_id: '',
      interest_level: 'medium',
      notes: '',
      contact_date: new Date().toISOString().split('T')[0]
    });
  };

  async function fetchInteractions() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('client_interactions')
        .select(`
          *,
          developments (
            title
          )
        `)
        .eq('user_id', user.id)
        .order('contact_date', { ascending: false });

      if (error) throw error;
      setInteractions(data || []);
    } catch (error) {
      console.error("Error fetching interactions:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProperties() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('developments')
        .select('id, title, parent:parent_id(title)')
        .eq('user_id', user.id)
        .order('title', { ascending: true });

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  }

  const filteredPropertyList = properties.filter(p => {
    const parentTitle = Array.isArray(p.parent) ? p.parent[0]?.title : p.parent?.title;
    const label = parentTitle ? `${parentTitle} - ${p.title}` : p.title;
    return label.toLowerCase().includes(propertySearch.toLowerCase());
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        ...formData,
        user_id: user.id,
        property_id: formData.property_id || null
      };

      if (editingId) {
        const { error } = await supabase
          .from('client_interactions')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('client_interactions')
          .insert([payload]);
        if (error) throw error;
      }
      
      closeModal();
      fetchInteractions();
    } catch (error) {
      console.error("Error saving interaction:", error);
      alert("Erro ao salvar atendimento.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirm_delete'))) return;
    try {
      const { error } = await supabase
        .from('client_interactions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchInteractions();
    } catch (error) {
      console.error("Error deleting interaction:", error);
    }
  };

  const getInterestColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-gray-500/10 text-gray-500';
      case 'medium': return 'bg-blue-500/10 text-blue-500';
      case 'high': return 'bg-orange-500/10 text-orange-500';
      case 'very_high': return 'bg-emerald-500/10 text-emerald-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const filteredInteractions = interactions.filter(i => 
    i.client_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-headline font-bold text-on-surface tracking-tight mb-2">
            {t('clients.title')}
          </h1>
          <p className="text-on-surface/70 font-body text-lg">
            {t('clients.subtitle')}
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-8 py-3 rounded-full font-bold shadow-lg transition-all hover:scale-105">
          <span className="material-symbols-outlined">person_add</span>
          {t('clients.add_new')}
        </Button>
      </header>

      {/* Search Bar */}
      <div className="mb-8 relative max-w-xl">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/30">search</span>
        <input 
          type="text"
          placeholder="Pesquisar por nome do cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-2xl py-4 pl-12 pr-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all sunken-shadow"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : filteredInteractions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInteractions.map((item) => (
            <div key={item.id} className="bg-surface-container-lowest rounded-3xl p-6 sunken-shadow border border-outline-variant/10 group hover:border-primary/30 transition-all duration-300">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-headline font-bold text-on-surface group-hover:text-primary transition-colors">{item.client_name}</h3>
                  <div className="flex flex-col gap-2 mt-3">
                    {item.client_phone && (
                      <div className="flex items-center gap-2 bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/10 w-fit group/phone hover:bg-primary/10 transition-colors">
                        <span className="material-symbols-outlined text-primary text-[18px]">call</span>
                        <span className="text-sm font-bold text-on-surface tracking-tight leading-none">
                          {item.client_phone}
                        </span>
                      </div>
                    )}
                    {item.client_email && (
                      <div className="flex items-center gap-2 bg-indigo-500/5 px-3 py-1.5 rounded-xl border border-indigo-500/10 w-fit group/email hover:bg-indigo-500/10 transition-colors">
                        <span className="material-symbols-outlined text-indigo-500 text-[18px]">mail</span>
                        <span className="text-sm font-bold text-on-surface tracking-tight leading-none truncate max-w-[200px]">
                          {item.client_email}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getInterestColor(item.interest_level)}`}>
                    {t(`clients.levels.${item.interest_level}`)}
                  </div>
                  <div className="bg-primary/5 text-primary px-3 py-1 rounded-lg border border-primary/10 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">calendar_month</span>
                    <span className="text-[11px] font-black">{new Date(item.contact_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-low rounded-2xl p-4 mb-4 border border-outline-variant/5">
                <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-2">{t('clients.property')}</p>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">apartment</span>
                  <span className="font-bold text-on-surface truncate">{item.developments?.title || 'Não especificado'}</span>
                </div>
              </div>

              {item.notes && (
                <div className="mb-6">
                  <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-1">{t('clients.notes')}</p>
                  <p className="text-sm text-on-surface/70 line-clamp-3 font-body leading-relaxed">{item.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant/10">
                <button onClick={() => handleEdit(item)} className="text-on-surface-variant/30 hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10">
                  <span className="material-symbols-outlined text-lg">edit</span>
                </button>
                <button onClick={() => handleDelete(item.id)} className="text-on-surface-variant/30 hover:text-error transition-colors p-2 rounded-full hover:bg-error/10">
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-3xl p-16 flex flex-col items-center justify-center text-center sunken-shadow border border-outline-variant/10">
          <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl text-on-surface/20">person_search</span>
          </div>
          <p className="text-on-surface-variant font-headline text-2xl font-bold mb-2">{searchTerm ? 'Nenhum cliente encontrado' : t('clients.no_clients')}</p>
          <Button variant="secondary" onClick={() => { setShowModal(true); setSearchTerm(''); }} className="mt-4">{t('clients.add_new')}</Button>
        </div>
      )}

      {/* Modal / Form */}
      {showModal && (
        <div className="fixed inset-0 bg-on-surface/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button onClick={closeModal} className="absolute top-6 right-6 text-on-surface-variant hover:text-on-surface transition-colors p-2 rounded-full hover:bg-surface-container-high">
              <span className="material-symbols-outlined">close</span>
            </button>
            
            <h2 className="text-3xl font-headline font-bold mb-2 text-on-surface">
              {editingId ? "Editar Atendimento" : t('clients.add_new')}
            </h2>
            <p className="text-on-surface-variant mb-8 font-body">{t('clients.subtitle')}</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField 
                  label={t('clients.name')} 
                  required 
                  value={formData.client_name}
                  onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                  placeholder="Nome completo do cliente"
                />
                <InputField 
                  label={t('clients.phone')} 
                  value={formData.client_phone}
                  onChange={(e) => setFormData({...formData, client_phone: e.target.value})}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 relative">
                  <div className="relative">
                    <InputField 
                      label={t('clients.property')}
                      value={propertySearch}
                      onChange={(e) => {
                        setPropertySearch(e.target.value);
                        setIsPropertyDropdownOpen(true);
                        if (!e.target.value) setFormData({...formData, property_id: ''});
                      }}
                      onFocus={() => setIsPropertyDropdownOpen(true)}
                      placeholder="Pesquisar imóvel ou unidade..."
                    />
                    {isPropertyDropdownOpen && propertySearch && (
                      <div className="absolute z-[110] left-0 right-0 mt-1 bg-surface-container-highest border border-outline-variant rounded-xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                        {filteredPropertyList.length > 0 ? (
                          filteredPropertyList.map(p => {
                            const parentTitle = Array.isArray(p.parent) ? p.parent[0]?.title : p.parent?.title;
                            const label = parentTitle ? `${parentTitle} - ${p.title}` : p.title;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setFormData({...formData, property_id: p.id});
                                  setPropertySearch(label);
                                  setIsPropertyDropdownOpen(false);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-primary/10 text-on-surface text-sm transition-colors border-b border-outline-variant last:border-0"
                              >
                                <div className="font-bold">{p.title}</div>
                                {parentTitle && <div className="text-[10px] text-on-surface/50 uppercase tracking-widest">{parentTitle}</div>}
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-4 py-6 text-center text-on-surface/50 text-sm italic">
                            Nenhum imóvel encontrado
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block font-label text-sm font-medium text-on-surface">{t('clients.interest')}</label>
                  <select 
                    value={formData.interest_level}
                    onChange={(e) => setFormData({...formData, interest_level: e.target.value as 'low' | 'medium' | 'high' | 'very_high'})}
                    className="w-full bg-surface-container-high border-0 rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 appearance-none font-body transition-all"
                  >
                    <option value="low">{t('clients.levels.low')}</option>
                    <option value="medium">{t('clients.levels.medium')}</option>
                    <option value="high">{t('clients.levels.high')}</option>
                    <option value="very_high">{t('clients.levels.very_high')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField 
                  label={t('clients.email')} 
                  type="email"
                  value={formData.client_email}
                  onChange={(e) => setFormData({...formData, client_email: e.target.value})}
                  placeholder="cliente@email.com"
                />
                <InputField 
                  label={t('clients.date')} 
                  type="date"
                  required
                  value={formData.contact_date}
                  onChange={(e) => setFormData({...formData, contact_date: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="block font-label text-sm font-medium text-on-surface">{t('clients.notes')}</label>
                <textarea 
                  rows={4}
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full bg-surface-container-high border-0 rounded-2xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-body resize-none"
                  placeholder="Detalhes da conversa, o que o cliente busca, etc..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button variant="secondary" type="button" onClick={closeModal}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? t('common.updating') : (editingId ? "Salvar Alterações" : t('common.save'))}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
