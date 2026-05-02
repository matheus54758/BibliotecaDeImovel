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

export const RegisterBuilder = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

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
          reset(data);
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

  if (fetching) return <div className="p-8 text-on-surface/50 font-body">{t('common.loading')}</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl bg-surface-container-low rounded-xl flex flex-col md:flex-row overflow-hidden sunken-shadow relative">
        <div className="hidden md:flex md:w-1/3 bg-primary relative overflow-hidden flex-col justify-between p-10">
          <div className="absolute inset-0 opacity-20">
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuARRebqbHieEmiIJRBFPnMXkkoEbkex5xyW5aVBcy5UewncPNXRsHBA3nSAoLzhQ-PSdsf8pHpuT2gjPSGWrID-ns_vQewv5g8h7mN7qrZd8FGI8HHJ15UKyjBOPBcnGMVpbrjU8W60zye5wOE9Pfllhm4Ra72A-D22fIJInkfMaqupqYeHHnLMqVUgo1of9DvbIh-jrINcvADGUAICPpzzgluR_cO6prPkTd8pZESeKPqN6wqBKAgCT9fSQJGhRaCx58OqHw042aWD" alt="Construction" className="w-full h-full object-cover" />
          </div>
          <div className="relative z-10">
            <h2 className="font-headline text-3xl font-bold text-on-primary mb-4 tracking-tight">Partnering for the Future.</h2>
            <p className="font-body text-primary-fixed-dim text-sm leading-relaxed">Join our network of premium construction partners. Complete your profile to access exclusive consultancy projects.</p>
          </div>
        </div>

        <div className="w-full md:w-2/3 p-8 md:p-12 bg-surface">
          <div className="mb-10">
            <h1 className="font-headline text-2xl font-bold text-primary mb-2 tracking-tight">
              {isEditing ? t('builders.edit_title') : t('builders.register_title')}
            </h1>
            <p className="font-body text-on-surface-variant text-sm">
              {isEditing ? t('builders.edit_subtitle') : t('builders.register_subtitle')}
            </p>
          </div>

          <form className="space-y-8" onSubmit={handleSubmit(onSubmit)}>
            <div className="bg-surface-container-lowest rounded-lg p-6 sunken-shadow relative z-10 space-y-8">
              <h3 className="font-headline text-lg font-bold text-primary flex items-center border-b border-surface-container pb-4">
                <span className="material-symbols-outlined mr-2">business</span>
                {t('new_development.core_details')}
              </h3>
              
              <MediaUpload 
                label={t('builders.form.logo')}
                onUpload={(url) => setValue("logo_url", url, { shouldValidate: true })}
                previewUrl={logoUrl}
                accept="image"
              />

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
