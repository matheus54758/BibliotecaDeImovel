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

export const NewDevelopment = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(id);
  const [isStandaloneProperty, setIsStandaloneProperty] = useState(searchParams.get("type") === "property");
  const parentIdFromUrl = searchParams.get("parentId");
  const unitTypeFromUrl = searchParams.get("unitType");
  
  const [builders, setBuilders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [floorPlans, setFloorPlans] = useState<string[]>([]);
  const [floorLayouts, setFloorLayouts] = useState<string[]>([]);
  const [ebooks, setEbooks] = useState<string[]>([]);
  const [parentId, setParentId] = useState<string | null>(parentIdFromUrl);

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
      price_starting_at: 1,
      sq_ft: 1,
      bedrooms: 0,
      bathrooms: 0,
      parking_spaces: 0,
      description: "",
      has_garage: false,
      near_beach: false,
      has_deed: false,
      is_penthouse: false,
      has_balcony_grill: false,
      is_furnished: false,
      has_sea_view: false,
      is_pet_friendly: false,
      has_complete_leisure: false,
      has_automation: false,
      video_url: [],
      floor_plan_url: [],
      floor_layout_url: [],
      ebook_url: [],
    }
  });

  const heroImageUrl = watch("hero_image_url");

  useEffect(() => {
    async function fetchData() {
      // Always reset states first to prevent leakage
      setVideoUrls([]);
      setFloorPlans([]);
      setFloorLayouts([]);
      setEbooks([]);
      setParentId(parentIdFromUrl);
      
      // Update isStandaloneProperty based on URL param initially
      setIsStandaloneProperty(searchParams.get("type") === "property");

      if (!isEditing) {
        reset({
          status: "available",
          hero_image_url: "",
          location: "",
          street: "",
          city: "",
          state: "",
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
          is_penthouse: false,
          has_balcony_grill: false,
          is_furnished: false,
          has_sea_view: false,
          is_pet_friendly: false,
          has_complete_leisure: false,
          has_automation: false,
          video_url: [],
          floor_plan_url: [],
          floor_layout_url: [],
          ebook_url: [],
        });
      }

      if (isEditing) setFetching(true);
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const { data: buildersData } = await supabase
          .from('builders')
          .select('id, name')
          .eq('user_id', user.id);
        
        setBuilders(buildersData || []);

        if (unitTypeFromUrl) {
          setValue("type", unitTypeFromUrl);
        }

        if (isEditing) {
          const { data: propData, error: propError } = await supabase
            .from('developments')
            .select('*')
            .eq('id', id)
            .single();
          
          if (propError) throw propError;
          
          // Detect type from data if param is missing
          if (propData.parent_id === null && propData.builder_id === null) {
            setIsStandaloneProperty(true);
          } else {
            setIsStandaloneProperty(false);
          }

          // Parse location string into street, city, state
          // Prioritize separate columns if they have data
          let street = propData.street || "";
          let city = propData.city || "";
          let state = propData.state || "";
          
          if (!street && !city && !state && propData.location) {
            // Expected format: "Street, City - State"
            const parts = propData.location.split(" - ");
            if (parts.length === 2) {
              state = parts[1];
              const streetCity = parts[0].split(", ");
              if (streetCity.length === 2) {
                street = streetCity[0];
                city = streetCity[1];
              } else {
                street = parts[0];
              }
            } else {
              const streetCity = propData.location.split(", ");
              if (streetCity.length === 2) {
                street = streetCity[0];
                city = streetCity[1];
              } else {
                street = propData.location;
              }
            }
          }

          reset({
            ...propData,
            street,
            city,
            state
          });
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
  }, [id, isEditing, reset, navigate, t, parentIdFromUrl, searchParams]);

  const onSubmit = async (data: DevelopmentInput) => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Build the base data object
      let finalLocation = data.location;
      
      // If it's a development or standalone property, combine the fields
      if (!parentId) {
        const parts = [];
        if (data.street) parts.push(data.street);
        if (data.city) parts.push(data.city);
        
        finalLocation = parts.join(", ");
        if (data.state) {
          finalLocation += ` - ${data.state}`;
        }
      }

      let finalStreet = data.street;
      let finalCity = data.city;
      let finalState = data.state;

      if (parentId && !finalLocation) {
        const { data: parentData } = await supabase
          .from('developments')
          .select('location, street, city, state')
          .eq('id', parentId)
          .single();
        if (parentData) {
          finalLocation = parentData.location;
          finalStreet = parentData.street;
          finalCity = parentData.city;
          finalState = parentData.state;
        }
      }

      const developmentData: any = {
        builder_id: isStandaloneProperty ? null : (data.builder_id || null),
        title: data.title,
        location: finalLocation || "Consulte-nos",
        street: finalStreet || null,
        city: finalCity || null,
        state: finalState || null,
        hero_image_url: data.hero_image_url || null,
        status: data.status || 'available',
        price_starting_at: data.price_starting_at || 0,
        sq_ft: data.sq_ft || 0,
        bedrooms: data.bedrooms || 0,
        bathrooms: data.bathrooms || 0,
        parking_spaces: data.parking_spaces || 0,
        user_id: user.id,
        description: data.description || "",
        video_url: videoUrls,
        floor_plan_url: floorPlans,
        floor_layout_url: floorLayouts,
        ebook_url: ebooks,
        payment_entry: data.payment_entry || 0,
        payment_installment_value: data.payment_installment_value || 0,
        payment_installment_count: data.payment_installment_count || 0,
        payment_reinforcement_value: data.payment_reinforcement_value || 0,
        payment_reinforcement_count: data.payment_reinforcement_count || 0,
        payment_post_construction: data.payment_post_construction || 0,
        unit_type: data.type || "Imóvel",
        has_garage: !!data.has_garage,
        near_beach: !!data.near_beach,
        has_deed: !!data.has_deed,
        is_penthouse: !!data.is_penthouse,
        has_balcony_grill: !!data.has_balcony_grill,
        is_furnished: !!data.is_furnished,
        has_sea_view: !!data.has_sea_view,
        is_pet_friendly: !!data.is_pet_friendly,
        has_complete_leisure: !!data.has_complete_leisure,
        has_automation: !!data.has_automation,
        parent_id: parentId // Hierarchy integrity
      };

      if (isEditing) {
        const { error: devError } = await supabase
          .from('developments')
          .update(developmentData)
          .eq('id', id);
        
        if (devError) throw devError;
        navigate(parentId ? `/units/${id}` : (isStandaloneProperty ? `/units/${id}` : `/projects/${id}`));
      } else {
        const { data: newData, error: devError } = await supabase
          .from('developments')
          .insert([developmentData])
          .select();
        
        if (devError) throw devError;
        
        if (newData && newData[0]) {
          const newItem = newData[0];
          navigate(newItem.parent_id ? `/units/${newItem.id}` : (isStandaloneProperty ? `/units/${newItem.id}` : `/projects/${newItem.id}`));
        } else {
          navigate("/developments");
        }
      }
    } catch (error: any) {
      console.error("Error saving development:", error);
      alert(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.warn("Erros de validação no formulário:", errors);
    }
  }, [errors]);

  if (fetching) return <div className="p-8 text-on-surface/50 font-body">{t('common.loading')}</div>;

  const getButtonLabel = () => {
    if (loading) return "Processando...";
    if (isEditing) {
      if (parentId) return "Atualizar Unidade";
      if (isStandaloneProperty) return "Atualizar Imóvel";
      return "Atualizar Empreendimento";
    }
    if (parentId) return "Salvar Unidade";
    if (isStandaloneProperty) return "Salvar Imóvel";
    return "Salvar Empreendimento";
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="font-headline text-3xl font-bold text-on-surface mb-2 tracking-tight">
        {parentId 
          ? (isEditing ? "Editar Unidade" : "Nova Unidade") 
          : (isStandaloneProperty ? (isEditing ? "Editar Imóvel" : "Novo Imóvel") : (isEditing ? "Editar Empreendimento" : "Novo Empreendimento"))
        }
      </h1>
      <p className="font-body text-on-surface-variant mb-8 text-lg">
        {parentId 
          ? "Ajuste os detalhes específicos deste apartamento ou sala." 
          : (isStandaloneProperty ? "Cadastre um imóvel pronto ou avulso com todos os detalhes." : "Configure as informações gerais do projeto arquitetônico.")
        }
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="bg-surface-container-lowest rounded-xl p-8 sunken-shadow space-y-6">
          <h3 className="font-headline text-xl font-bold text-primary border-b border-surface-container-high pb-4">
            {parentId ? "Informações da Unidade" : (isStandaloneProperty ? "Informações do Imóvel" : "Informações do Empreendimento")}
          </h3>
          
          <div className="space-y-8">
            <MediaUpload 
              label={parentId || isStandaloneProperty ? "Imagem de Capa (Principal)" : "Imagem de Capa do Empreendimento"}
              onUpload={(url) => setValue("hero_image_url", Array.isArray(url) ? url[0] : url, { shouldValidate: true })}
              previewUrl={heroImageUrl || undefined}
              accept="image"
            />
            {errors.hero_image_url && <p className="text-xs text-error font-medium">{errors.hero_image_url.message}</p>}

            <div className="grid grid-cols-1 gap-6">
              {!parentId && !isStandaloneProperty && (
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block font-label text-sm font-medium text-on-surface">Status</label>
                  <select
                    {...register("status")}
                    className="w-full bg-surface-container-high border-0 rounded py-3 px-4 text-on-surface focus:ring-2 focus:ring-surface-tint/20 transition-colors appearance-none"
                  >
                    <option value="available">Disponível</option>
                    {!parentId && !isStandaloneProperty ? (
                      <option value="unavailable">Indisponível</option>
                    ) : (
                      <>
                        <option value="reserved">Reservado</option>
                        <option value="sold">Vendido</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block font-label text-sm font-medium text-on-surface">Tipo de Imóvel</label>
                  <select
                    {...register("type")}
                    className="w-full bg-surface-container-high border-0 rounded py-3 px-4 text-on-surface focus:ring-2 focus:ring-surface-tint/20 transition-colors appearance-none"
                  >
                    <option value="">Selecione o tipo...</option>
                    <option value="residential_center">{t('consultancy.types.residential_center')}</option>
                    <option value="commercial_center">{t('consultancy.types.commercial_center')}</option>
                    <option value="mixed">{t('consultancy.types.mixed')}</option>
                    <option value="land">{t('consultancy.types.land')}</option>
                    <option value="dormitory">Apartamento</option>
                    <option value="commercial">Comercial</option>
                    <option value="studio">Studio</option>
                    <option value="house">Casa</option>
                  </select>
                </div>
              </div>

              <InputField 
                label={parentId || isStandaloneProperty ? "Nome ou Identificação (Ex: Apto 101, Casa da Praia)" : "Nome do Empreendimento"}
                {...register("title")}
                error={errors.title?.message}
                placeholder={parentId || isStandaloneProperty ? "Ex: Apto 101" : "Ex: Edifício Harmony"}
              />

              {!parentId ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-6">
                    <InputField 
                      label="Rua / Bairro"
                      {...register("street")}
                      error={errors.street?.message}
                      placeholder="Ex: Rua das Flores, Centro"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <InputField 
                      label="Cidade"
                      {...register("city")}
                      error={errors.city?.message}
                      placeholder="Ex: Balneário Camboriú"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <InputField 
                      label="Estado"
                      {...register("state")}
                      error={errors.state?.message}
                      placeholder="Ex: SC"
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="block font-label text-sm font-medium text-on-surface">
                  Descrição e Observações
                </label>
                <textarea
                  {...register("description")}
                  rows={4}
                  className="w-full bg-surface-container-high border-0 rounded py-3 px-4 text-on-surface focus:ring-2 focus:ring-surface-tint/20 transition-colors"
                  placeholder={parentId || isStandaloneProperty ? "Descreva os diferenciais, acabamentos e detalhes deste imóvel específico..." : "Descreva os diferenciais do condomínio, áreas comuns e infraestrutura..."}
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        {(parentId || isStandaloneProperty) && (
          <div className="bg-surface-container-lowest rounded-xl p-8 sunken-shadow space-y-8">
            <h3 className="font-headline text-xl font-bold text-primary border-b border-surface-container-high pb-4">
              Diferenciais do Imóvel
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-3 p-4 bg-surface-container-high rounded-lg cursor-pointer hover:bg-surface-container-highest transition-colors">
                <input type="checkbox" {...register("is_penthouse")} className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" />
                <span className="text-sm font-medium text-on-surface">Cobertura</span>
              </label>
              <label className="flex items-center gap-3 p-4 bg-surface-container-high rounded-lg cursor-pointer hover:bg-surface-container-highest transition-colors">
                <input type="checkbox" {...register("near_beach")} className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" />
                <span className="text-sm font-medium text-on-surface">Perto da Praia</span>
              </label>
              <label className="flex items-center gap-3 p-4 bg-surface-container-high rounded-lg cursor-pointer hover:bg-surface-container-highest transition-colors">
                <input type="checkbox" {...register("has_garage")} className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" />
                <span className="text-sm font-medium text-on-surface">Garagem</span>
              </label>
              <label className="flex items-center gap-3 p-4 bg-surface-container-high rounded-lg cursor-pointer hover:bg-surface-container-highest transition-colors">
                <input type="checkbox" {...register("has_balcony_grill")} className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" />
                <span className="text-sm font-medium text-on-surface">Sacada com Churrasqueira</span>
              </label>
              <label className="flex items-center gap-3 p-4 bg-surface-container-high rounded-lg cursor-pointer hover:bg-surface-container-highest transition-colors">
                <input type="checkbox" {...register("is_furnished")} className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" />
                <span className="text-sm font-medium text-on-surface">Mobiliado</span>
              </label>
              <label className="flex items-center gap-3 p-4 bg-surface-container-high rounded-lg cursor-pointer hover:bg-surface-container-highest transition-colors">
                <input type="checkbox" {...register("has_sea_view")} className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" />
                <span className="text-sm font-medium text-on-surface">Vista para o Mar</span>
              </label>
              <label className="flex items-center gap-3 p-4 bg-surface-container-high rounded-lg cursor-pointer hover:bg-surface-container-highest transition-colors">
                <input type="checkbox" {...register("is_pet_friendly")} className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" />
                <span className="text-sm font-medium text-on-surface">Pet Friendly</span>
              </label>
              <label className="flex items-center gap-3 p-4 bg-surface-container-high rounded-lg cursor-pointer hover:bg-surface-container-highest transition-colors">
                <input type="checkbox" {...register("has_complete_leisure")} className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" />
                <span className="text-sm font-medium text-on-surface">Lazer Completo</span>
              </label>
            </div>
          </div>
        )}

        {(parentId || isStandaloneProperty) && (
          <div className="bg-surface-container-lowest rounded-xl p-8 sunken-shadow space-y-8">
            <h3 className="font-headline text-xl font-bold text-primary border-b border-surface-container-high pb-4">
              Valores e Plano de Pagamento
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <InputField 
                label="Valor Total (R$)"
                type="number"
                step="0.01"
                {...register("price_starting_at")}
                placeholder="Ex: 550000"
              />
              <InputField 
                label="Área Privativa (m²)"
                type="number"
                step="0.01"
                {...register("sq_ft")}
                placeholder="Ex: 75.50"
              />
              <InputField 
                label="Qtd Dormitórios"
                type="number"
                {...register("bedrooms")}
                placeholder="Ex: 2"
              />
              <InputField 
                label="Qtd Banheiros"
                type="number"
                {...register("bathrooms")}
                placeholder="Ex: 1"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-outline-variant/10">
              <InputField label="Valor de Entrada (R$)" type="number" step="0.01" {...register("payment_entry")} placeholder="Ex: 100000" />
              {!isStandaloneProperty && (
                <InputField label="Saldo Pós-Obra / Financiamento (R$)" type="number" step="0.01" {...register("payment_post_construction")} placeholder="Ex: 300000" />
              )}
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

              {!isStandaloneProperty && (
                <div className="space-y-4">
                  <h4 className="font-bold text-primary flex items-center gap-2 text-sm uppercase tracking-wider">
                    <span className="material-symbols-outlined text-sm">event_repeat</span> Reforços / Balões
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Valor (R$)" type="number" step="0.01" {...register("payment_reinforcement_value")} />
                    <InputField label="Quantidade" type="number" {...register("payment_reinforcement_count")} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-surface-container-lowest rounded-xl p-8 sunken-shadow space-y-8">
          <h3 className="font-headline text-xl font-bold text-primary border-b border-surface-container-high pb-4">
            {isStandaloneProperty ? "Galeria e Mídias do Imóvel" : "Materiais do Empreendimento"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <MediaUpload 
              label={isStandaloneProperty ? "Vídeo do Imóvel (MP4)" : "Vídeos de Apresentação"}
              accept="video"
              multiple
              previewUrl={videoUrls}
              onUpload={(urls) => setVideoUrls(urls as string[])}
            />

            <MediaUpload 
              label={isStandaloneProperty ? "Documentos (IPTU, Escritura, etc)" : "Documentos / E-books"}
              accept="pdf"
              multiple
              previewUrl={ebooks}
              onUpload={(urls) => setEbooks(urls as string[])}
            />

            <MediaUpload 
              label={isStandaloneProperty ? "Imagens do Imóvel (Fotos)" : "Plantas Baixas"}
              accept="image"
              multiple
              previewUrl={floorPlans}
              onUpload={(urls) => setFloorPlans(urls as string[])}
            />

            {!isStandaloneProperty && (
              <MediaUpload 
                label="Layouts / Pavimentos"
                accept="image"
                multiple
                previewUrl={floorLayouts}
                onUpload={(urls) => setFloorLayouts(urls as string[])}
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-4">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={loading}>
            {getButtonLabel()}
          </Button>
        </div>
      </form>
    </div>
  );
};
