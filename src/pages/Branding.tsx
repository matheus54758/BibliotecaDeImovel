import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useTheme } from "../hooks/useTheme";
import { Button } from "../components/Button";
import { InputField } from "../components/InputField";
import { MediaUpload } from "../components/MediaUpload";

export const Branding = () => {
  const { theme, updateTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    company_name: theme.company_name || "",
    primary_color: theme.primary_color || "#D4AF37",
    banner_url: theme.banner_url || "",
    about_me: (theme as any).about_me || "",
    slug: (theme as any).slug || "",
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Basic slug validation
      if (formData.slug && !/^[a-z0-9-]+$/.test(formData.slug)) {
        alert("O link deve conter apenas letras minúsculas, números e hifens.");
        setSaving(false);
        return;
      }

      // Update theme_config as before, but also update the slug column
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          theme_config: {
            company_name: formData.company_name,
            primary_color: formData.primary_color,
            banner_url: formData.banner_url,
            about_me: formData.about_me,
            slug: formData.slug
          },
          slug: formData.slug || null
        })
        .eq('id', user.id);

      if (profileError) {
        if (profileError.code === '23505') {
          throw new Error("Este link já está em uso por outro usuário.");
        }
        throw profileError;
      }

      await updateTheme(formData);
      alert("Configurações de marca atualizadas com sucesso!");
    } catch (error: any) {
      console.error("Error saving branding:", error);
      alert(error.message || "Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <header className="mb-10">
        <h1 className="text-4xl font-headline font-bold text-on-surface tracking-tight mb-2">
          Personalização e Marca
        </h1>
        <p className="text-on-surface/70 font-body text-lg">
          Deixe o sistema com a cara da sua empresa e impacte seus clientes.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Settings */}
        <form onSubmit={handleSave} className="space-y-8">
          <div className="bg-surface-container-lowest p-6 rounded-3xl sunken-shadow border border-outline-variant/10 space-y-6">
            <h3 className="text-xl font-headline font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined">link</span>
              Link da sua Vitrine
            </h3>

            <div className="space-y-2">
              <InputField 
                label="Endereço Personalizado"
                value={formData.slug}
                onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                placeholder="ex: minha-imobiliaria"
              />
              <p className="text-[10px] text-on-surface/40 font-medium uppercase tracking-widest">
                Seu link será: <span className="text-primary lowercase">app.lumis.com.br/{formData.slug || 'seu-nome'}</span>
              </p>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-6 rounded-3xl sunken-shadow border border-outline-variant/10 space-y-6">
            <h3 className="text-xl font-headline font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined">palette</span>
              Cores e Identidade
            </h3>

            <InputField 
              label="Nome da Empresa"
              value={formData.company_name}
              onChange={(e) => setFormData({...formData, company_name: e.target.value})}
              placeholder="Ex: Minha Imobiliária Premium"
            />

            <div className="space-y-2">
              <label className="block font-label text-sm font-medium text-on-surface">Cor Principal da Marca</label>
              <div className="flex gap-4 items-center">
                <input 
                  type="color" 
                  value={formData.primary_color}
                  onChange={(e) => setFormData({...formData, primary_color: e.target.value})}
                  className="w-16 h-16 rounded-xl cursor-pointer bg-surface-container-high border-0 overflow-hidden"
                />
                <div className="flex-1">
                  <p className="text-sm font-bold text-on-surface uppercase tracking-widest">{formData.primary_color}</p>
                  <p className="text-xs text-on-surface/50">Esta cor será aplicada em botões, ícones e destaques.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-label text-sm font-medium text-on-surface">Sobre Mim / Perfil Profissional</label>
              <textarea 
                rows={5}
                value={formData.about_me}
                onChange={(e) => setFormData({...formData, about_me: e.target.value})}
                className="w-full bg-surface-container-high border-0 rounded-2xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all font-body resize-none"
                placeholder="Conte um pouco sobre sua trajetória, especialidades e como você ajuda seus clientes..."
              ></textarea>
              <p className="text-[10px] text-on-surface/40 uppercase font-black tracking-widest">Este texto aparecerá em destaque na sua vitrine pública.</p>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-6 rounded-3xl sunken-shadow border border-outline-variant/10 space-y-6">
            <h3 className="text-xl font-headline font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined">branding_watermark</span>
              Logo / Banner da Vitrine
            </h3>
            
            <p className="text-xs text-on-surface/50 mb-4">
              Este banner aparecerá no topo da sua vitrine pública para clientes. Use uma imagem horizontal de alta qualidade (1920x600 recomendado).
            </p>

            <MediaUpload 
              label="Upload do Banner"
              onUpload={(url) => setFormData({...formData, banner_url: Array.isArray(url) ? url[0] : url})}
              previewUrl={formData.banner_url}
              accept="image"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="px-12">
              {saving ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </form>

        {/* Live Preview Side */}
        <div className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">Prévia da Vitrine</h3>
          <div className="bg-background rounded-3xl overflow-hidden shadow-2xl border border-outline-variant/20 aspect-[4/5] scale-95 origin-top sticky top-8">
            {/* Mock Showcase Banner */}
            <div className="h-1/3 bg-surface-container-high relative overflow-hidden">
              {formData.banner_url ? (
                <img src={formData.banner_url} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-on-surface/10">
                  <span className="material-symbols-outlined text-4xl">image</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
              <div className="absolute bottom-4 left-4">
                <h4 className="text-white font-headline font-bold text-xl">{formData.company_name || "Sua Marca Aqui"}</h4>
                <div className="w-10 h-1 mt-1 rounded-full" style={{ backgroundColor: formData.primary_color }}></div>
              </div>
            </div>
            
            {/* Mock Showcase Content */}
            <div className="p-4 space-y-4 overflow-y-auto max-h-[60%]">
              {formData.about_me && (
                <div className="bg-surface-container-low p-3 rounded-xl border border-outline-variant/5">
                  <div className="w-4 h-0.5 mb-2" style={{ backgroundColor: formData.primary_color }}></div>
                  <p className="text-[10px] text-on-surface/60 italic line-clamp-3">"{formData.about_me}"</p>
                </div>
              )}
              <div className="h-4 w-1/3 bg-surface-container-high rounded-full"></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="aspect-square bg-surface-container-low rounded-2xl border border-outline-variant/10 flex flex-col p-2 gap-2">
                  <div className="flex-1 bg-surface-container-high rounded-xl"></div>
                  <div className="h-2 w-full bg-surface-container-high rounded-full" style={{ backgroundColor: `${formData.primary_color}20` }}></div>
                </div>
                <div className="aspect-square bg-surface-container-low rounded-2xl border border-outline-variant/10 flex flex-col p-2 gap-2">
                  <div className="flex-1 bg-surface-container-high rounded-xl"></div>
                  <div className="h-2 w-full bg-surface-container-high rounded-full" style={{ backgroundColor: `${formData.primary_color}20` }}></div>
                </div>
              </div>
              <div className="h-10 w-full rounded-xl flex items-center justify-center text-[10px] font-bold text-white uppercase tracking-widest" style={{ backgroundColor: formData.primary_color }}>
                Botão de Exemplo
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
