import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { ImageUpload } from "../components/ImageUpload";
import { InputField } from "../components/InputField";
import { developmentSchema, type DevelopmentInput } from "../lib/schemas";

export const NewDevelopment = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  
  const [builders, setBuilders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  
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
    }
  });

  const heroImageUrl = watch("hero_image_url");

  useEffect(() => {
    async function fetchData() {
      if (isEditing) setFetching(true);
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        // Fetch builders for the current user
        const { data: buildersData } = await supabase
          .from('builders')
          .select('id, name')
          .eq('user_id', user.id);
        
        setBuilders(buildersData || []);

        if (isEditing) {
          // Fetch property
          const { data: propData, error: propError } = await supabase
            .from('developments')
            .select('*')
            .eq('id', id)
            .single();
          
          if (propError) throw propError;
          reset(propData);

          // Fetch gallery
          const { data: galleryData } = await supabase
            .from('development_images')
            .select('url')
            .eq('development_id', id)
            .order('display_order', { ascending: true });
          
          if (galleryData) {
            setGalleryImages(galleryData.map(img => img.url));
          }
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

  const handleAddGalleryImage = (url: string) => {
    setGalleryImages([...galleryImages, url]);
  };

  const handleRemoveGalleryImage = (index: number) => {
    setGalleryImages(galleryImages.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: DevelopmentInput) => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const developmentData = {
        ...data,
        user_id: user.id
      };

      if (isEditing) {
        // Update main development
        const { error: devError } = await supabase
          .from('developments')
          .update(developmentData)
          .eq('id', id);
        
        if (devError) throw devError;

        // Refresh gallery: delete all and re-insert
        // (Simplest way to handle re-ordering and deletions)
        await supabase.from('development_images').delete().eq('development_id', id);
        
        if (galleryImages.length > 0) {
          const imageObjects = galleryImages.map((url, index) => ({
            development_id: id,
            url: url,
            display_order: index
          }));
          await supabase.from('development_images').insert(imageObjects);
        }
      } else {
        // Create new
        const { data: devData, error: devError } = await supabase.from('developments').insert([developmentData]).select().single();
        if (devError) throw devError;

        if (galleryImages.length > 0) {
          const imageObjects = galleryImages.map((url, index) => ({
            development_id: devData.id,
            url: url,
            display_order: index
          }));
          await supabase.from('development_images').insert(imageObjects);
        }
      }

      navigate("/developments");
    } catch (error) {
      console.error("Error saving development:", error);
      alert(isEditing ? "Failed to update development." : "Failed to create development.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-8 text-on-surface/50 font-body">{t('common.loading')}</div>;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="font-headline text-3xl font-bold text-on-surface mb-2 tracking-tight">
        {isEditing ? t('new_development.edit_title') : t('new_development.title')}
      </h1>
      <p className="font-body text-on-surface-variant mb-8 text-lg">
        {isEditing ? t('new_development.edit_subtitle') : t('new_development.subtitle')}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="bg-surface-container-lowest rounded-xl p-8 sunken-shadow space-y-6">
          <h3 className="font-headline text-xl font-bold text-primary border-b border-surface-container-high pb-4">{t('new_development.core_details')}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="block font-label text-sm font-medium text-on-surface">{t('new_development.partner')}</label>
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

            <InputField 
              label={t('new_development.project_title')}
              {...register("title")}
              error={errors.title?.message}
              placeholder="e.g. Skyline Residencies"
              className="md:col-span-2"
            />

            <InputField 
              label={t('new_development.location')}
              {...register("location")}
              error={errors.location?.message}
              placeholder="City, District"
            />

            <InputField 
              label={t('new_development.price')}
              type="number"
              {...register("price_starting_at")}
              error={errors.price_starting_at?.message}
              placeholder="0"
            />

            <div className="space-y-2">
              <label className="block font-label text-sm font-medium text-on-surface">{t('new_development.status')}</label>
              <select
                {...register("status")}
                className="w-full bg-surface-container-high border-0 rounded py-3 px-4 text-on-surface focus:ring-2 focus:ring-surface-tint/20 transition-colors appearance-none"
              >
                <option value="available">{t('status.available')}</option>
                <option value="pre_launch">{t('status.pre_launch')}</option>
                <option value="under_construction">{t('status.under_construction')}</option>
                <option value="unavailable">{t('status.unavailable')}</option>
              </select>
              {errors.status && <p className="text-xs text-error font-medium">{errors.status.message}</p>}
            </div>

            <InputField 
              label={t('new_development.area')}
              type="number"
              {...register("sq_ft")}
              error={errors.sq_ft?.message}
            />

            <div className="grid grid-cols-3 gap-4 col-span-1 md:col-span-2">
              <InputField label={t('new_development.beds')} type="number" {...register("bedrooms")} error={errors.bedrooms?.message} />
              <InputField label={t('new_development.baths')} type="number" {...register("bathrooms")} error={errors.bathrooms?.message} />
              <InputField label={t('new_development.parking')} type="number" {...register("parking_spaces")} error={errors.parking_spaces?.message} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 col-span-1 md:col-span-2 pt-2">
              <label className="flex items-center space-x-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  {...register("has_garage")} 
                  className="w-5 h-5 rounded border-surface-container-highest text-primary focus:ring-primary/20 bg-surface-container-high transition-colors"
                />
                <span className="font-body text-sm text-on-surface group-hover:text-primary transition-colors">{t('new_development.has_garage')}</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  {...register("near_beach")} 
                  className="w-5 h-5 rounded border-surface-container-highest text-primary focus:ring-primary/20 bg-surface-container-high transition-colors"
                />
                <span className="font-body text-sm text-on-surface group-hover:text-primary transition-colors">{t('new_development.near_beach')}</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  {...register("has_deed")} 
                  className="w-5 h-5 rounded border-surface-container-highest text-primary focus:ring-primary/20 bg-surface-container-high transition-colors"
                />
                <span className="font-body text-sm text-on-surface group-hover:text-primary transition-colors">{t('new_development.has_deed')}</span>
              </label>
            </div>

            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="block font-label text-sm font-medium text-on-surface">{t('new_development.description')}</label>
              <textarea
                {...register("description")}
                rows={4}
                className="w-full bg-surface-container-high border-0 rounded py-3 px-4 text-on-surface focus:ring-2 focus:ring-surface-tint/20 transition-colors resize-none"
                placeholder={t('new_development.description_placeholder')}
              />
              {errors.description && <p className="text-xs text-error font-medium">{errors.description.message}</p>}
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-8 sunken-shadow space-y-6">
          <h3 className="font-headline text-xl font-bold text-primary border-b border-surface-container-high pb-4">{t('new_development.media_gallery')}</h3>
          
          <div className="space-y-8">
            <ImageUpload 
              label={t('new_development.primary_image')}
              onUpload={(url) => setValue("hero_image_url", url, { shouldValidate: true })}
              previewUrl={heroImageUrl}
            />
            {errors.hero_image_url && <p className="text-xs text-error font-medium">{errors.hero_image_url.message}</p>}

            <div className="space-y-4">
              <label className="block font-label text-sm font-medium text-on-surface">{t('new_development.additional_images')}</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {galleryImages.map((url, index) => (
                  <div key={index} className="relative aspect-video rounded-lg overflow-hidden group">
                    <img src={url} alt={`Gallery ${index}`} className="w-full h-full object-cover" />
                    <button 
                      type="button" 
                      onClick={() => handleRemoveGalleryImage(index)}
                      className="absolute top-2 right-2 p-1 bg-error text-on-error rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ))}
                <ImageUpload 
                  onUpload={handleAddGalleryImage}
                  className="aspect-video"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={loading}>
            {loading ? t('common.updating') : (isEditing ? t('common.update') : t('common.launch'))}
          </Button>
        </div>
      </form>
    </div>
  );
};
