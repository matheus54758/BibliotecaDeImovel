import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { MediaUpload } from "../components/MediaUpload";
import { InputField } from "../components/InputField";
import { developmentSchema, type DevelopmentInput } from "../lib/schemas";

export const RegisterLand = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [floorPlans, setFloorPlans] = useState<string[]>([]); // Used for "Topography/Map"
  const [ebooks, setEbooks] = useState<string[]>([]); // Used for "Documents"

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DevelopmentInput>({
    resolver: zodResolver(developmentSchema) as any,
    defaultValues: {
      status: "available",
      hero_image_url: "",
      location: "",
      street: "",
      city: "",
      state: "",
      title: "",
      price_starting_at: 0,
      sq_ft: 0,
      description: "",
      unit_type: "land",
      video_url: [],
      floor_plan_url: [],
      ebook_url: [],
    }
  });

  const heroImageUrl = watch("hero_image_url");

  useEffect(() => {
    async function fetchData() {
      if (isEditing) {
        setFetching(true);
        try {
          const { data, error } = await supabase
            .from('developments')
            .select('*')
            .eq('id', id)
            .single();
          
          if (error) throw error;
          
          reset(data);
          setVideoUrls(data.video_url || []);
          setFloorPlans(data.floor_plan_url || []);
          setEbooks(data.ebook_url || []);
        } catch (error) {
          console.error("Error fetching land:", error);
          alert("Erro ao carregar dados do terreno.");
          navigate("/lands");
        } finally {
          setFetching(false);
        }
      }
    }
    fetchData();
  }, [id, isEditing, reset, navigate]);

  const onSubmit = async (data: DevelopmentInput) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const parts = [];
      if (data.street) parts.push(data.street);
      if (data.city) parts.push(data.city);
      let finalLocation = parts.join(", ");
      if (data.state) finalLocation += ` - ${data.state}`;

      const landData = {
        ...data,
        location: finalLocation,
        unit_type: 'land',
        user_id: user.id,
        video_url: videoUrls,
        floor_plan_url: floorPlans,
        ebook_url: ebooks,
        builder_id: null,
        parent_id: null
      };

      if (isEditing) {
        const { error } = await supabase
          .from('developments')
          .update(landData)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('developments')
          .insert([landData]);
        if (error) throw error;
      }

      navigate("/lands");
    } catch (error: any) {
      console.error("Error saving land:", error);
      alert(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-8 text-on-surface/50 font-body">{t('common.loading')}</div>;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <header className="mb-10">
        <h1 className="font-headline text-3xl font-bold text-on-surface mb-2 tracking-tight">
          {isEditing ? "Editar Terreno" : "Cadastrar Novo Terreno"}
        </h1>
        <p className="font-body text-on-surface-variant text-lg">
          Insira as especificações técnicas, medidas e documentação da área.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Capa e Localização */}
        <div className="bg-surface-container-lowest rounded-3xl p-8 sunken-shadow border border-outline-variant/10 space-y-8">
          <MediaUpload 
            label="Foto Principal ou Drone"
            onUpload={(url) => setValue("hero_image_url", Array.isArray(url) ? url[0] : url)}
            previewUrl={heroImageUrl || undefined}
            accept="image"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Título da Área (Ex: Lote 04 - Alphaville)" {...register("title")} error={errors.title?.message} placeholder="Dê um nome para facilitar a identificação" />
            <div className="space-y-2">
              <label className="block font-label text-sm font-medium text-on-surface">Status de Venda</label>
              <select {...register("status")} className="w-full bg-surface-container-high border-0 rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 appearance-none">
                <option value="available">Disponível</option>
                <option value="reserved">Reservado</option>
                <option value="sold">Vendido</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-6">
              <InputField label="Rua / Bairro" {...register("street")} placeholder="Endereço aproximado" />
            </div>
            <div className="md:col-span-4">
              <InputField label="Cidade" {...register("city")} placeholder="Cidade" />
            </div>
            <div className="md:col-span-2">
              <InputField label="Estado" {...register("state")} placeholder="Ex: SC" />
            </div>
          </div>
        </div>

        {/* Informações Técnicas */}
        <div className="bg-surface-container-lowest rounded-3xl p-8 sunken-shadow border border-outline-variant/10 space-y-8">
          <h3 className="font-headline text-xl font-bold text-primary border-b border-surface-container-high pb-4 flex items-center gap-2">
            <span className="material-symbols-outlined">straighten</span>
            Informações Técnicas e Dimensões
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <InputField label="Área Total (m²)" type="number" step="0.01" {...register("sq_ft")} placeholder="Ex: 450" />
            <InputField label="Frente (metros)" type="number" step="0.01" placeholder="Ex: 15" />
            <InputField label="Profundidade (metros)" type="number" step="0.01" placeholder="Ex: 30" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block font-label text-sm font-medium text-on-surface">Topografia (Relevo)</label>
              <select className="w-full bg-surface-container-high border-0 rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 appearance-none">
                <option value="flat">Plano</option>
                <option value="sloped_up">Aclive (Sobe)</option>
                <option value="sloped_down">Declive (Desce)</option>
                <option value="irregular">Irregular</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block font-label text-sm font-medium text-on-surface">Zoneamento / Uso</label>
              <select className="w-full bg-surface-container-high border-0 rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 appearance-none">
                <option value="residential">Residencial</option>
                <option value="commercial">Comercial</option>
                <option value="industrial">Industrial</option>
                <option value="mixed">Uso Misto</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-4 bg-surface-container-high rounded-xl cursor-pointer hover:bg-surface-container-highest transition-colors">
              <input type="checkbox" {...register("has_deed")} className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-on-surface">Escriturado e Registrado</span>
                <span className="text-[10px] text-on-surface/50 uppercase font-black">Documentação OK</span>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 bg-surface-container-high rounded-xl cursor-pointer hover:bg-surface-container-highest transition-colors">
              <input type="checkbox" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-on-surface">Infraestrutura Básica</span>
                <span className="text-[10px] text-on-surface/50 uppercase font-black">Água, Luz e Esgoto</span>
              </div>
            </label>
          </div>
        </div>

        {/* Valores */}
        <div className="bg-surface-container-lowest rounded-3xl p-8 sunken-shadow border border-outline-variant/10 space-y-8">
          <h3 className="font-headline text-xl font-bold text-primary border-b border-surface-container-high pb-4 flex items-center gap-2">
            <span className="material-symbols-outlined">payments</span>
            Valores e Negociação
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Valor de Venda (R$)" type="number" step="0.01" {...register("price_starting_at")} placeholder="Ex: 250000" />
            <InputField label="Valor de Entrada Sugerido (R$)" type="number" step="0.01" {...register("payment_entry")} placeholder="Ex: 50000" />
          </div>

          <div className="space-y-2">
            <label className="block font-label text-sm font-medium text-on-surface">Observações de Negociação (Aceita permuta, parcelamento direto...)</label>
            <textarea {...register("description")} rows={4} className="w-full bg-surface-container-high border-0 rounded-2xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-colors" placeholder="Ex: Estuda permuta por veículo ou imóvel de menor valor..."></textarea>
          </div>
        </div>

        {/* Documentos e Mídias */}
        <div className="bg-surface-container-lowest rounded-3xl p-8 sunken-shadow border border-outline-variant/10 space-y-8">
          <h3 className="font-headline text-xl font-bold text-primary border-b border-surface-container-high pb-4">Arquivos e Anexos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <MediaUpload label="Levantamento Topográfico / Mapas" accept="image" multiple previewUrl={floorPlans} onUpload={(urls) => setFloorPlans(urls as string[])} />
            <MediaUpload label="Matrícula / IPTU / Docs (PDF)" accept="pdf" multiple previewUrl={ebooks} onUpload={(urls) => setEbooks(urls as string[])} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-4">
          <Button variant="secondary" type="button" onClick={() => navigate("/lands")}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? "Salvando..." : (isEditing ? "Atualizar Terreno" : "Salvar Terreno")}</Button>
        </div>
      </form>
    </div>
  );
};
