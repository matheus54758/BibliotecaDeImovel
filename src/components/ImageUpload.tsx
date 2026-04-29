import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface ImageUploadProps {
  onUpload: (url: string) => void;
  label?: string;
  className?: string;
  previewUrl?: string;
}

export const ImageUpload = ({ onUpload, label, className, previewUrl }: ImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(previewUrl || "");

  const uploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      const url = data.publicUrl;
      setPreview(url);
      onUpload(url);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="block font-label text-sm font-medium text-on-surface">{label}</label>}
      <div className="flex flex-col items-center justify-center border-2 border-dashed border-surface-container-highest rounded-xl p-4 bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer relative overflow-hidden group min-h-[120px]">
        {preview ? (
          <>
            <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
               <span className="text-white text-sm font-medium">Change Image</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-on-surface/50">
            <span className="material-symbols-outlined text-4xl mb-2">add_a_photo</span>
            <span className="text-sm">{uploading ? 'Uploading...' : 'Click to upload'}</span>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={uploadImage}
          disabled={uploading}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
};
