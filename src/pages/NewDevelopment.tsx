import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { MediaUpload } from "../components/MediaUpload";
import { InputField } from "../components/InputField";
import { developmentSchema, type DevelopmentInput } from "../lib/schemas";
import { useUserTier } from "../hooks/useUserTier";

export const NewDevelopment = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(id);
  const isForcedProject = searchParams.get("type") === "project";
  const { canAddDevelopment } = useUserTier();
  
  const [builders, setBuilders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [galleryMedia, setGalleryMedia] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [floorPlans, setFloorPlans] = useState<string[]>([]);
  const [floorLayouts, setFloorLayouts] = useState<string[]>([]);
  const [ebooks, setEbooks] = useState<string[]>([]);
  const [parentId, setParentId] = useState<string | null>(null);

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
      title: "",
      price_starting_at: 1,
      sq_ft: 1,
      bedrooms: 0,
      bathrooms: 0,
      parking_spaces: 0,
      description: "",
      has_garage: false,
      near_beach: false,
      has_deed: false,
      video_url: [],
      floor_plan_url: [],
      floor_layout_url: [],
      ebook_url: [],
    }
  });

  const heroImageUrl = watch("hero_image_url");

  useEffect(() => {
    async function fetchData() {
      if (isEditing) setFetching(true);
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const { data: buildersData } = await supabase
          .from('builders')
          .select('id, name')
          .eq('user_id', user.id);
        
        setBuilders(buildersData || []);

        if (isEditing) {
          const { data: propData, error: propError } = await supabase
            .from('developments')
            .select('*')
            .eq('id', id)
            .single();
          
          if (propError) throw propError;
          reset(propData);
          setParentId(propData.parent_id);
          setVideoUrls(propData.video_url || []);
          setFloorPlans(propData.floor_plan_url || []);
          setFloorLayouts(propData.floor_layout_url || []);
          setEbooks(propData.ebook_url || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        alert(t('common.load_error'));
        navigate("/developments");
      } finally {
        setFetching(false);
      }
    }
    fetchData();
  }, [id, isEditing, reset, navigate, t]);

  const onSubmit = async (data: DevelopmentInput) => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const developmentData = {
        builder_id: data.builder_id,
        title: data.title,
        location: data.location,
        hero_image_url: data.hero_image_url,
        status: data.status || 'available',
        price_starting_at: data.price_starting_at,
        sq_ft: data.sq_ft,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        parking_spaces: data.parking_spaces,
        user_id: user.id,
        description: data.description || "Edifício cadastrado para importação de unidades.",
        video_url: videoUrls,
        floor_plan_url: floorPlans,
        floor_layout_url: floorLayouts,
        ebook_url: ebooks,
        payment_entry: data.payment_entry,
        payment_installment_value: data.payment_installment_value,
        payment_installment_count: data.payment_installment_count,
        payment_reinforcement_value: data.payment_reinforcement_value,
        payment_reinforcement_count: data.payment_reinforcement_count,
        payment_post_construction: data.payment_post_construction,
        unit_type: data.type
      };

      if (isEditing) {
        const { error: devError } = await supabase
          .from('developments')
          .update(developmentData)
          .eq('id', id);
        if (devError) throw devError;
        navigate(parentId ? `/units/${id}` : `/projects/${id}`);
      } else {
        const { data: newData, error: devError } = await supabase
          .from('developments')
          .insert([developmentData])
          .select();
        if (devError) throw devError;
        
        if (newData && newData[0]) {
          const newItem = newData[0];
          navigate(newItem.parent_id ? `/units/${newItem.id}` : `/projects/${newItem.id}`);
        } else {
          navigate(parentId ? "/developments" : "/project-developments");
        }
      }
    } catch (error: any) {
      console.error("Error saving development:", error);
      alert(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Log de erros de validação (ajuda muito a descobrir por que o botão não faz nada)
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.warn("Erros de validação no formulário:", errors);
    }
  }, [errors]);

  if (fetching) return <div className="p-8 text-on-surface/50 font-body">{t('common.loading')}</div>;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="font-headline text-3xl font-bold text-on-surface mb-2 tracking-tight">
        {parentId 
          ? (isEditing ? "Editar Unidade" : "Nova Unidade") 
          : (isEditing ? "Editar Empreendimento" : "Novo Empreendimento")
        }
      </h1>
      <p className="font-body text-on-surface-variant mb-8 text-lg">
        {parentId 
          ? "Ajuste os detalhes específicos deste apartamento ou sala." 
          : "Configure as informações gerais do projeto arquitetônico."
        }
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="bg-surface-container-lowest rounded-xl p-8 sunken-shadow space-y-6">
          <h3 className="font-headline text-xl font-bold text-primary border-b border-surface-container-high pb-4">
            {parentId ? "Informações da Unidade" : "Informações do Empreendimento"}
          </h3>
          
          <div className="space-y-8">
            <MediaUpload 
              label={parentId ? "Imagem da Unidade" : "Imagem de Capa do Empreendimento"}
              onUpload={(url) => setValue("hero_image_url", url, { shouldValidate: true })}
              previewUrl={heroImageUrl || undefined}
              accept="image"
            />
            {errors.hero_image_url && <p className="text-xs text-error font-medium">{errors.hero_image_url.message}</p>}

            <div className="grid grid-cols-1 gap-6">
              {!parentId && (
                <div className="space-y-2">
                  <label className="block font-label text-sm font-medium text-on-surface">{t('new_development.partner')} *</label>
                  <select
                    {...register("builder_id")}
                    className="w-full bg-surface-container-high border-0 rounded py-3 px-4 text-on-surface focus:ring-2 focus:ring-surface-tint/20 transition-colors appearance-none"
                  >
                    <option value="">{t('new_development.select_partner')}</option>
                    {builders.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  {errors.builder_id && <p className="text-xs text-error font-medium">{errors.builder_id.message}</p>}
                </div>
              )}

              <div className="space-y-2">
                <label className="block font-label text-sm font-medium text-on-surface">Status</label>
                <select
                  {...register("status")}
                  className="w-full bg-surface-container-high border-0 rounded py-3 px-4 text-on-surface focus:ring-2 focus:ring-surface-tint/20 transition-colors appearance-none"
                >
                  <option value="available">Disponível</option>
                  {!parentId ? (
                    <option value="unavailable">Indisponível</option>
                  ) : (
                    <>
                      <option value="reserved">Reservado</option>
                      <option value="sold">Vendido</option>
                    </>
                  )}
                </select>
              </div>

              <InputField 
                label={parentId ? "Identificação da Unidade (Ex: Apto 101)" : "Nome do Empreendimento"}
                {...register("title")}
                error={errors.title?.message}
                placeholder={parentId ? "Ex: Apto 101" : "Ex: Edifício Harmony"}
              />

              {!parentId && (
                <InputField 
                  label="Localização / Endereço"
                  {...register("location")}
                  error={errors.location?.message}
                  placeholder="Cidade, Bairro ou Endereço Completo"
                />
              )}

              <div className="space-y-2">
                <label className="block font-label text-sm font-medium text-on-surface">
                  {parentId ? "Observações Privadas da Unidade" : "Descrição Pública do Empreendimento"}
                </label>
                <textarea
                  {...register("description")}
                  rows={4}
                  className="w-full bg-surface-container-high border-0 rounded py-3 px-4 text-on-surface focus:ring-2 focus:ring-surface-tint/20 transition-colors"
                  placeholder={parentId ? "Notas específicas deste apartamento..." : "Descreva os diferenciais do condomínio, áreas comuns e infraestrutura..."}
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        {parentId && (
          <div className="bg-surface-container-lowest rounded-xl p-8 sunken-shadow space-y-8">
            <h3 className="font-headline text-xl font-bold text-primary border-b border-surface-container-high pb-4">
              Métricas e Plano de Pagamento
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <InputField 
                label="Valor Total (R$)"
                type="number"
                step="0.01"
                {...register("price_starting_at")}
              />
              <InputField 
                label="Área Privativa (m²)"
                type="number"
                step="0.01"
                {...register("sq_ft")}
              />
              <InputField 
                label="Qtd Dormitórios"
                type="number"
                {...register("bedrooms")}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-outline-variant/10">
              <InputField label="Valor de Entrada (R$)" type="number" step="0.01" {...register("payment_entry")} />
              <InputField label="Saldo Pós-Obra (R$)" type="number" step="0.01" {...register("payment_post_construction")} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-outline-variant/10">
              <div className="space-y-4">
                <h4 className="font-bold text-primary flex items-center gap-2 text-sm uppercase tracking-wider">
                  <span className="material-symbols-outlined text-sm">payments</span> Parcelas Mensais
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Valor (R$)" type="number" step="0.01" {...register("payment_installment_value")} />
                  <InputField label="Quantidade" type="number" {...register("payment_installment_count")} />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-primary flex items-center gap-2 text-sm uppercase tracking-wider">
                  <span className="material-symbols-outlined text-sm">event_repeat</span> Reforços Anuais
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Valor (R$)" type="number" step="0.01" {...register("payment_reinforcement_value")} />
                  <InputField label="Quantidade" type="number" {...register("payment_reinforcement_count")} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-surface-container-lowest rounded-xl p-8 sunken-shadow space-y-8">
          <h3 className="font-headline text-xl font-bold text-primary border-b border-surface-container-high pb-4">
            {parentId ? "Mídias da Unidade" : "Materiais do Empreendimento"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <MediaUpload 
              label="Vídeos de Apresentação"
              accept="video"
              multiple
              previewUrl={videoUrls}
              onUpload={(urls) => setVideoUrls(urls as string[])}
            />

            <MediaUpload 
              label={parentId ? "E-books da Unidade" : "E-book / Memorial Descritivo"}
              accept="pdf"
              multiple
              previewUrl={ebooks}
              onUpload={(urls) => setEbooks(urls as string[])}
            />

            <MediaUpload 
              label={parentId ? "Plantas Baixas" : "Plantas Gerais"}
              accept="image"
              multiple
              previewUrl={floorPlans}
              onUpload={(urls) => setFloorPlans(urls as string[])}
            />

            <MediaUpload 
              label="Layouts e Pavimentos"
              accept="image"
              multiple
              previewUrl={floorLayouts}
              onUpload={(urls) => setFloorLayouts(urls as string[])}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-4">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Processando..." : (isEditing ? "Atualizar" : "Salvar")}
          </Button>
        </div>
      </form>
    </div>
  );
};
