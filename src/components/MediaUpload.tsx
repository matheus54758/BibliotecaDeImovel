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

  // Função para comprimir imagens direto no navegador antes de enviar
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1920;
          const MAX_HEIGHT = 1080;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Converte para WebP com 80% de qualidade (WebP é muito mais eficiente que JPEG)
          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".webp"), {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file); // fallback se der erro
            }
          }, 'image/webp', 0.80);
        };
        img.onerror = () => resolve(file); // fallback
      };
      reader.onerror = () => resolve(file); // fallback
    });
  };

  const uploadMedia = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      const files = event.target.files;
      if (!files || files.length === 0) {
        throw new Error('Você deve selecionar pelo menos um arquivo.');
      }

      // Validação de Tamanho e Tipo antes de iniciar o upload
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|ogg|mov)$/i);
        const isImage = file.type.startsWith('image/') && !file.name.match(/\.pdf$/i);
        const isPdf = file.type === 'application/pdf' || file.name.match(/\.pdf$/i);
        
        // Limites de tamanho amigáveis
        const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // Aumentado para 15MB já que vamos comprimir
        const MAX_VIDEO_SIZE = 250 * 1024 * 1024; // Aumentado para 250MB para acomodar vídeos originais pesados
        const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);

        if (isVideo && file.size > MAX_VIDEO_SIZE) {
          throw new Error(`O vídeo "${file.name}" é muito pesado (${fileSizeMB}MB). O limite de envio é 250MB.`);
        }
        if (isImage && file.size > MAX_IMAGE_SIZE) {
          throw new Error(`A imagem "${file.name}" é muito pesada (${fileSizeMB}MB). O limite é 15MB.`);
        }
        if (isPdf && file.size > MAX_PDF_SIZE) {
          throw new Error(`O PDF "${file.name}" está muito pesado (${fileSizeMB}MB). Para não deixar o sistema lento, o limite é 20MB. Dica: Acesse ilovepdf.com/pt/comprimir_pdf para diminuir o tamanho do arquivo gratuitamente antes de enviar!`);
        }
      }

      const uploadPromises = Array.from(files).map(async (file) => {
        let fileToUpload = file;
        
        // Aplica a compressão se for uma imagem
        const isImage = file.type.startsWith('image/') && !file.name.match(/\.pdf$/i);
        if (isImage) {
           fileToUpload = await compressImage(file);
        }

        const fileExt = fileToUpload.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('assets')
          .upload(filePath, fileToUpload);

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
      const msg = error.message.includes('Fetch') || error.message.includes('network') 
        ? "Sua conexão de internet caiu ou oscilou durante o envio. Tente novamente." 
        : error.message;
      alert(`Erro no upload: ${msg}`);
      if (event.target) event.target.value = '';
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
    accept === 'image' ? 'image/*,application/pdf' : 
    accept === 'video' ? 'video/*' : 
    accept === 'pdf' ? 'application/pdf' : 
    accept === 'both' ? 'image/*,video/*,application/pdf' : 
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
