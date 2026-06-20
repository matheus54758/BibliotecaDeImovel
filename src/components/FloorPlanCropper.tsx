import React, { useState, useEffect, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Cropper, type ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { Button } from './Button';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Setup worker
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface FloorPlanCropperProps {
  pdfUrl: string;
  initialPage?: number;
  onComplete: (images: string[]) => void;
  onCancel: () => void;
}

export const FloorPlanCropper: React.FC<FloorPlanCropperProps> = ({ pdfUrl, initialPage = 1, onComplete, onCancel }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [croppedImages, setCroppedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const cropperRef = useRef<ReactCropperElement>(null);

  useEffect(() => {
    loadPdf();
  }, [pdfUrl]);

  useEffect(() => {
    renderPage(currentPage);
  }, [currentPage]);

  async function loadPdf() {
    setLoading(true);
    try {
      const loadingTask = pdfjs.getDocument({ url: pdfUrl });
      const pdf = await loadingTask.promise;
      setNumPages(pdf.numPages);
      await renderPage(1);
    } catch (error) {
      console.error("Error loading PDF:", error);
    } finally {
      setLoading(false);
    }
  }

  async function renderPage(pageNumber: number) {
    try {
      const loadingTask = pdfjs.getDocument({ url: pdfUrl });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(pageNumber);
      
      const viewport = page.getViewport({ scale: 2.0 }); // High scale for better crop quality
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        await page.render({ canvasContext: context, viewport, canvas: canvas as any }).promise;
        setPageImage(canvas.toDataURL('image/png'));
      }
    } catch (error) {
      console.error("Error rendering page:", error);
    }
  }

  const handleCrop = async () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      const croppedCanvas = cropper.getCroppedCanvas({
        maxWidth: 2000,
        maxHeight: 2000,
        fillColor: '#fff',
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });
      
      const dataUrl = croppedCanvas.toDataURL('image/jpeg', 0.9);
      setCroppedImages(prev => [...prev, dataUrl]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col p-4 md:p-8 overflow-hidden">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-white text-2xl font-headline font-bold">Recortador de Plantas</h2>
          <p className="text-white/60 text-sm">Desenhe o retângulo sobre a planta e clique em "Recortar"</p>
        </div>
        <div className="flex gap-4">
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onComplete(croppedImages)} disabled={croppedImages.length === 0}>
            Finalizar ({croppedImages.length})
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
        {/* Main Cropper Area */}
        <div className="flex-1 bg-surface-container-lowest rounded-3xl overflow-hidden relative border border-white/10">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : pageImage && (
            <Cropper
              src={pageImage}
              style={{ height: '100%', width: '100%' }}
              initialAspectRatio={undefined}
              guides={true}
              ref={cropperRef}
              viewMode={1}
              dragMode="move"
              background={false}
              responsive={true}
              autoCropArea={0.5}
              checkOrientation={false}
            />
          )}
        </div>

        {/* Sidebar Controls */}
        <div className="w-full md:w-80 flex flex-col gap-6">
          <div className="bg-surface-container-high p-6 rounded-3xl space-y-4">
            <h3 className="text-white font-bold text-sm uppercase tracking-widest">Navegação</h3>
            <div className="flex items-center justify-between gap-4">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-full bg-white/5 text-white disabled:opacity-20 hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="text-white font-bold">Página {currentPage} de {numPages}</span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                disabled={currentPage === numPages}
                className="p-2 rounded-full bg-white/5 text-white disabled:opacity-20 hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
            
            <div className="pt-4">
              <Button onClick={handleCrop} className="w-full py-4 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">crop</span>
                Recortar Seleção
              </Button>
            </div>
          </div>

          {/* History of crops */}
          <div className="flex-1 bg-surface-container-high p-6 rounded-3xl space-y-4 overflow-hidden flex flex-col">
            <h3 className="text-white font-bold text-sm uppercase tracking-widest">Recortes ({croppedImages.length})</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {croppedImages.map((img, i) => (
                <div key={i} className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10 relative group">
                  <img src={img} className="w-full h-full object-contain" />
                  <button 
                    onClick={() => setCroppedImages(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                </div>
              ))}
              {croppedImages.length === 0 && (
                <div className="py-10 text-center text-white/20">
                  <span className="material-symbols-outlined text-4xl mb-2">image_not_supported</span>
                  <p className="text-xs">Nenhum recorte ainda</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
