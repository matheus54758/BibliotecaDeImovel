import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { MediaUpload } from "../components/MediaUpload";
import { InputField } from "../components/InputField";
import { builderSchema, type BuilderInput } from "../lib/schemas";
import { useUserTier } from "../hooks/useUserTier";

export const RegisterBuilder = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { canAddBuilder } = useUserTier();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<BuilderInput>({
    resolver: zodResolver(builderSchema),
    defaultValues: {
      logo_url: "",
    }
  });

  const logoUrl = watch("logo_url");

  useEffect(() => {
    if (isEditing) {
      async function fetchBuilder() {
        setFetching(true);
        try {
          const { data, error } = await supabase
            .from('builders')
            .select('*')
            .eq('id', id)
            .single();
          
          if (error) throw error;
          
          // Filter data to only include fields expected by the form/schema
          const sanitizedData = {
            name: data.name || "",
            cnpj: data.cnpj || "",
            specialization: data.specialization || "",
            email: data.email || "",
            phone: data.phone || "",
            address: data.address || "",
            city: data.city || "",
            logo_url: data.logo_url || "",
          };
          reset(sanitizedData);
        } catch (error) {
          console.error("Error fetching builder:", error);
          alert(t('common.load_error'));
          navigate("/builders");
        } finally {
          setFetching(false);
        }
      }
      fetchBuilder();
    }
  }, [id, isEditing, reset, navigate, t]);

  const onSubmit = async (data: BuilderInput) => {
    if (!isEditing && !canAddBuilder) {
      alert(t('freemium.builder_limit_desc'));
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const builderData = {
        ...data,
        user_id: user.id
      };

      if (isEditing) {
        const { error } = await supabase
          .from('builders')
          .update(builderData)
          .eq('id', id);
        
        if (error) throw error;
        alert("Perfil atualizado com sucesso!");
      } else {
        const { error } = await supabase.from('builders').insert([{ ...builderData, status: 'active' }]);
        if (error) throw error;
      }

      navigate("/builders");
    } catch (error) {
      console.error("Error saving builder:", error);
      alert(isEditing ? "Failed to update builder." : "Failed to register builder.");
    } finally {
      setLoading(false);
    }
  };

  const onInvalid = (errors: any) => {
    console.error("Form validation failed:", errors);
    alert("Erro de validação: Verifique os campos preenchidos.");
  };

  if (fetching) return <div className="p-8 text-on-surface/50 font-body">{t('common.loading')}</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-4xl bg-surface rounded-3xl overflow-hidden sunken-shadow border border-outline-variant/10">
        <div className="w-full p-8 md:p-12">
          <div className="mb-10 text-center">
            <h1 className="font-headline text-3xl font-bold text-primary mb-2 tracking-tight">
              {isEditing ? t('builders.edit_title') : t('builders.register_title')}
            </h1>
            <p className="font-body text-on-surface-variant text-sm">
              {isEditing ? t('builders.edit_subtitle') : t('builders.register_subtitle')}
            </p>
          </div>

          <form className="space-y-8" onSubmit={handleSubmit(onSubmit, onInvalid)}>
            <div className="bg-surface-container-lowest rounded-lg p-6 sunken-shadow relative z-10 space-y-8">
              <h3 className="font-headline text-lg font-bold text-primary flex items-center border-b border-surface-container pb-4">
                <span className="material-symbols-outlined mr-2">business</span>
                {t('new_development.core_details')}
              </h3>
              
              <MediaUpload 
                label={t('builders.form.logo')}
                onUpload={(url) => setValue("logo_url", Array.isArray(url) ? url[0] : url, { shouldValidate: true })}
                previewUrl={logoUrl || undefined}
                accept="image"
              />
              {errors.logo_url && <p className="text-xs text-error font-medium">{errors.logo_url.message}</p>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label={t('builders.company_name')} {...register("name")} error={errors.name?.message} className="md:col-span-2" placeholder="e.g. Apex Construction Ltd." />
                <InputField label={t('builders.tax_id')} {...register("cnpj")} error={errors.cnpj?.message} placeholder="00.000.000/0000-00" />
                
                <div className="space-y-2">
                  <label className="block font-label text-sm font-medium text-on-surface">{t('builders.specialization_label')}</label>
                  <select
                    {...register("specialization")}
                    className="w-full bg-surface-container-high border-0 rounded py-3 px-4 text-on-surface focus:ring-2 focus:ring-surface-tint/20 transition-colors appearance-none"
                  >
                    <option value="">{t('new_development.select_partner')}</option>
                    <option value="Commercial Building">{t('specialization.commercial_complex')}</option>
                    <option value="Residential Development">{t('specialization.luxury_residential')}</option>
                    <option value="Infrastructure">{t('specialization.infrastructure')}</option>
                    <option value="Renovation & Restoration">{t('specialization.renovation')}</option>
                  </select>
                  {errors.specialization && <p className="text-xs text-error font-medium">{errors.specialization.message}</p>}
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-lg p-6 sunken-shadow relative z-10 space-y-6">
              <h3 className="font-headline text-lg font-bold text-primary flex items-center border-b border-surface-container pb-4">
                <span className="material-symbols-outlined mr-2">contact_mail</span>
                {t('builders.register_title')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label={t('builders.email')} type="email" {...register("email")} error={errors.email?.message} placeholder="contact@company.com" />
                <InputField label={t('builders.phone')} type="tel" {...register("phone")} error={errors.phone?.message} placeholder="+1 (555) 000-0000" />
                <InputField label={t('builders.address')} {...register("address")} error={errors.address?.message} className="md:col-span-2" placeholder="123 Builder Ave" />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-4 pt-4">
              <Button variant="secondary" type="button" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={loading}>
                {loading ? t('common.updating') : (isEditing ? t('builders.submit_update') : t('builders.submit_register'))}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
