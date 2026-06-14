import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface MediaUploadProps {
  onUpload: (urls: string | string[]) => void;
  label?: string;
  className?: string;
  previewUrl?: string | string[];
  accept?: 'image' | 'video' | 'pdf' | 'both' | 'all';
  multiple?: boolean;
}

export const MediaUpload = ({ onUpload, label, className, previewUrl, accept = 'both', multiple = false }: MediaUploadProps) => {
  const [uploading, setUploading] = useState(false);

  const uploadMedia = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      const files = event.target.files;
      if (!files || files.length === 0) {
        throw new Error('You must select at least one file to upload.');
      }

      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('assets')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('assets')
          .getPublicUrl(filePath);

        return data.publicUrl;
      });

      const newUrls = await Promise.all(uploadPromises);
      
      if (multiple) {
        const currentUrls = Array.isArray(previewUrl) ? previewUrl : (previewUrl ? [previewUrl] : []);
        onUpload([...currentUrls, ...newUrls]);
      } else {
        onUpload(newUrls[0]);
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = (index: number) => {
    if (multiple && Array.isArray(previewUrl)) {
      const newUrls = [...previewUrl];
      newUrls.splice(index, 1);
      onUpload(newUrls);
    } else {
      onUpload("");
    }
  };

  const previews = Array.isArray(previewUrl) ? previewUrl : (previewUrl ? [previewUrl] : []);
  const acceptedTypes = 
    accept === 'image' ? 'image/*' : 
    accept === 'video' ? 'video/*' : 
    accept === 'pdf' ? 'application/pdf' : 
    accept === 'both' ? 'image/*,video/*' : 
    '*/*';

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="block font-label text-sm font-medium text-on-surface">{label}</label>}
      
      <div className="flex flex-wrap gap-4">
        {previews.map((url, index) => {
          const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i);
          const isPdf = url.match(/\.pdf$/i);

          return (
            <div key={index} className="relative w-32 h-32 rounded-xl overflow-hidden bg-surface-container-low border-2 border-surface-container-highest group">
              {isVideo ? (
                <video src={url} className="w-full h-full object-cover" muted />
              ) : isPdf ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-primary bg-primary/5">
                  <span className="material-symbols-outlined text-4xl">picture_as_pdf</span>
                  <span className="text-[10px] font-bold mt-1 uppercase">PDF</span>
                </div>
              ) : (
                <img src={url} alt="Preview" className="w-full h-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeMedia(index)}
                className="absolute top-1 right-1 bg-error text-on-error rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          );
        })}

        {(multiple || previews.length === 0) && (
          <label className={cn(
            "w-32 h-32 flex flex-col items-center justify-center border-2 border-dashed border-surface-container-highest rounded-xl cursor-pointer transition-colors bg-surface-container-low hover:bg-surface-container-high relative overflow-hidden",
            uploading && "animate-pulse border-primary"
          )}>
            <span className="material-symbols-outlined text-3xl text-on-surface/50 mb-1">
              {uploading ? 'sync' : 'add_circle'}
            </span>
            <span className="text-[10px] font-bold text-on-surface/50 uppercase tracking-widest text-center px-2">
              {uploading ? 'Enviando...' : (multiple ? 'Adicionar' : 'Upload')}
            </span>
            <input
              type="file"
              accept={acceptedTypes}
              onChange={uploadMedia}
              disabled={uploading}
              multiple={multiple}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
        )}
      </div>
    </div>
  );
};
