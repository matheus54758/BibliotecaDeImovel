import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface MediaUploadProps {
  onUpload: (url: string, type: 'image' | 'video') => void;
  label?: string;
  className?: string;
  previewUrl?: string;
  accept?: 'image' | 'video' | 'both';
}

export const MediaUpload = ({ onUpload, label, className, previewUrl, accept = 'both' }: MediaUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(previewUrl || "");
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(
    previewUrl?.match(/\.(mp4|webm|ogg)$/i) ? 'video' : (previewUrl ? 'image' : null)
  );

  const uploadMedia = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select a file to upload.');
      }

      const file = event.target.files[0];
      const isVideo = file.type.startsWith('video/');
      const type = isVideo ? 'video' : 'image';
      
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
      setMediaType(type);
      onUpload(url, type);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const acceptedTypes = accept === 'image' ? 'image/*' : accept === 'video' ? 'video/*' : 'image/*,video/*';
  const icon = accept === 'video' ? 'movie' : 'add_a_photo';

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="block font-label text-sm font-medium text-on-surface">{label}</label>}
      <div className="flex flex-col items-center justify-center border-2 border-dashed border-surface-container-highest rounded-xl p-4 bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer relative overflow-hidden group min-h-[120px]">
        {preview ? (
          <>
            {mediaType === 'video' ? (
              <video src={preview} className="absolute inset-0 w-full h-full object-cover" muted />
            ) : (
              <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
               <span className="text-white text-sm font-medium">Change Media</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-on-surface/50">
            <span className="material-symbols-outlined text-4xl mb-2">{icon}</span>
            <span className="text-sm">{uploading ? 'Uploading...' : 'Click to upload'}</span>
          </div>
        )}
        <input
          type="file"
          accept={acceptedTypes}
          onChange={uploadMedia}
          disabled={uploading}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
};
