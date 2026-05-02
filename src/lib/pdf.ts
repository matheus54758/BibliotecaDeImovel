import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './utils';

export const generatePropertyPDF = async (property: any, amenities: any[], gallery: any[]) => {
  console.log("Iniciando geração de PDF para:", property.title);
  
  // Create a loading overlay
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'fixed inset-0 z-[200] bg-black/50 flex items-center justify-center';
  loadingDiv.innerHTML = '<div class="bg-white p-6 rounded-lg shadow-xl flex items-center gap-4"><div class="animate-spin h-8 w-8 border-4 border-[#D4AF37] border-t-transparent rounded-full"></div><span class="font-bold">Gerando PDF, aguarde...</span></div>';
  document.body.appendChild(loadingDiv);

  try {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
    });

    const gold = [212, 175, 55]; // #D4AF37
    const black = [0, 0, 0];

    // Helper to add images and handle errors
    const addImageToPDF = (url: string, x: number, y: number, w: number, h: number): Promise<void> => {
      console.log("Tentando carregar imagem:", url);
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        
        const timeout = setTimeout(() => {
          console.warn("Timeout ao carregar imagem:", url);
          resolve();
        }, 10000);

        img.onload = () => {
          clearTimeout(timeout);
          try {
            console.log("Imagem carregada com sucesso:", url);
            doc.addImage(img, 'JPEG', x, y, w, h);
          } catch (e) {
            console.error("Erro ao adicionar imagem ao PDF:", e);
          }
          resolve();
        };
        img.onerror = (err) => {
          clearTimeout(timeout);
          console.error("Falha ao carregar imagem para o PDF:", url, err);
          resolve();
        };
        img.src = url;
      });
    };

    console.log("Desenhando cabeçalho...");
    doc.setFillColor(...black);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(...gold);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text("Lumis - Inteligência Imobiliária", 15, 20);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text("Exclusividade e Performance no Mercado Imobiliário", 15, 28);

    // Hero Image
    if (property.hero_image_url) {
      await addImageToPDF(property.hero_image_url, 15, 45, 180, 100);
    }

    console.log("Adicionando informações básicas...");
    doc.setTextColor(...black);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(property.title || "Imóvel", 15, 160);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(property.location || "", 15, 168);
    doc.setTextColor(...gold);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    const priceLabel = property.price_starting_at ? formatCurrency(property.price_starting_at) : "Sob Consulta";
    doc.text(`Valor: ${priceLabel}`, 15, 180);
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(15, 185, 195, 185);

    // Stats Table
    console.log("Gerando tabela de atributos...");
    const stats = [
      [
        { content: 'Área', styles: { fontStyle: 'bold' } }, 
        { content: 'Quartos', styles: { fontStyle: 'bold' } }, 
        { content: 'Banheiros', styles: { fontStyle: 'bold' } }, 
        { content: 'Vagas', styles: { fontStyle: 'bold' } }
      ],
      [
        `${property.sq_ft}m²`,
        `${property.bedrooms || 'N/A'}`,
        `${property.bathrooms || 'N/A'}`,
        `${property.parking_spaces || 'N/A'}`
      ]
    ];

    autoTable(doc, {
      startY: 190,
      margin: { left: 15, right: 15 },
      body: stats,
      theme: 'plain',
      styles: { fontSize: 11, cellPadding: 3, textColor: black as [number, number, number] },
    });

    // Description
    console.log("Adicionando descrição...");
    doc.setTextColor(...black);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Descrição", 15, (doc as any).lastAutoTable.finalY + 10);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    const splitDescription = doc.splitTextToSize(property.description || "", 180);
    doc.text(splitDescription, 15, (doc as any).lastAutoTable.finalY + 18);

    // New Page for Amenities and Gallery
    if (amenities.length > 0 || gallery.length > 0) {
      console.log("Criando segunda página...");
      doc.addPage();
      doc.setFillColor(...black);
      doc.rect(0, 0, 210, 20, 'F');
      doc.setTextColor(...gold);
      doc.setFontSize(16);
      doc.text(property.title || "Imóvel", 15, 13);
      let currentY = 35;
      if (amenities.length > 0) {
        doc.setTextColor(...black);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("Diferenciais", 15, currentY);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const amenityNames = amenities.map(a => a.name).join(' • ');
        const splitAmenities = doc.splitTextToSize(amenityNames, 180);
        doc.text(splitAmenities, 15, currentY + 8);
        currentY += (splitAmenities.length * 5) + 20;
      }
      if (gallery.length > 0) {
        doc.setTextColor(...black);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("Galeria", 15, currentY);
        const images = gallery.filter(item => item.type === 'image').slice(0, 4);
        for (let i = 0; i < images.length; i++) {
          const row = Math.floor(i / 2);
          const col = i % 2;
          const x = 15 + (col * 95);
          const y = currentY + 10 + (row * 70);
          await addImageToPDF(images[i].url, x, y, 85, 60);
        }
      }
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(...gold);
      doc.rect(0, 287, 210, 10, 'F');
      doc.setTextColor(...black);
      doc.setFontSize(8);
      doc.text(`Gerado em ${new Date().toLocaleDateString()} | Lumis - Inteligência Imobiliária`, 15, 292);
      doc.text(`Página ${i} de ${pageCount}`, 180, 292);
    }

    const filename = `${(property.title || 'Imovel').replace(/\s+/g, '_')}_Lumis.pdf`;
    doc.save(filename);
    console.log("PDF gerado com sucesso.");
  } catch (error) {
    console.error("ERRO NA GERAÇÃO DO PDF:", error);
    alert("Erro ao gerar PDF. Verifique o console para mais detalhes.");
  } finally {
    document.body.removeChild(loadingDiv);
  }
};
