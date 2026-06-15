import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './utils';

export const generatePropertyPDF = async (property: any, amenities: any[], gallery: any[], subUnits: any[] = []) => {
  console.log("Iniciando geração de PDF para:", property.title);
  
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

    const gold: [number, number, number] = [212, 175, 55]; 
    const black: [number, number, number] = [0, 0, 0];
    const isProject = property.parent_id === null && property.builder_id !== null;

    const addImageToPDF = (url: string, x: number, y: number, w: number, h: number): Promise<void> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        const timeout = setTimeout(() => resolve(), 10000);
        img.onload = () => {
          clearTimeout(timeout);
          try { doc.addImage(img, 'JPEG', x, y, w, h); } catch (e) {}
          resolve();
        };
        img.onerror = () => { clearTimeout(timeout); resolve(); };
        img.src = url;
      });
    };

    // Header
    doc.setFillColor(black[0], black[1], black[2]);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text("Lumis - Inteligência Imobiliária", 15, 20);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text("Exclusividade e Performance no Mercado Imobiliário", 15, 28);

    // Hero
    if (property.hero_image_url) {
      await addImageToPDF(property.hero_image_url, 15, 45, 180, 100);
    }

    // Title & Info
    doc.setTextColor(black[0], black[1], black[2]);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(property.title || "Imóvel", 15, 160);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    // Construct full address
    let fullAddress = "";
    if (property.street || property.city || property.state) {
      const parts = [];
      if (property.street) parts.push(property.street);
      if (property.city) parts.push(property.city);
      
      fullAddress = parts.join(", ");
      if (property.state) {
        fullAddress += fullAddress ? ` - ${property.state}` : property.state;
      }
    } else {
      fullAddress = property.location || "";
    }

    doc.text(fullAddress, 15, 168);

    if (property.price_starting_at > 0 && !isProject) {
      doc.setTextColor(gold[0], gold[1], gold[2]);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(`Valor: ${formatCurrency(property.price_starting_at)}`, 15, 180);
    }
    
    doc.setDrawColor(gold[0], gold[1], gold[2]);
    doc.setLineWidth(0.5);
    doc.line(15, 185, 195, 185);

    // Stats
    let currentYAfterHeader = 185;
    if (!isProject) {
      const statsHeader = ['Área', 'Dormitórios', 'Banheiros'];
      const statsRow = [`${property.sq_ft}m²`, `${property.bedrooms || '0'}`, `${property.bathrooms || '0'}`];
      autoTable(doc, {
        startY: 190,
        margin: { left: 15, right: 15 },
        body: [statsHeader.map(h => ({ content: h, styles: { fontStyle: 'bold' } })), statsRow],
        theme: 'plain',
        styles: { fontSize: 11, cellPadding: 3, textColor: [0, 0, 0] },
      });
      currentYAfterHeader = (doc as any).lastAutoTable.finalY;
    }

    // Description (Multi-page)
    let finalY = currentYAfterHeader + 10;
    doc.setTextColor(black[0], black[1], black[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Descrição", 15, finalY);
    finalY += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    const splitDescription = doc.splitTextToSize(property.description || "", 180);
    const pageHeight = doc.internal.pageSize.getHeight();
    for (let line of splitDescription) {
      if (finalY > pageHeight - 25) { doc.addPage(); finalY = 20; }
      doc.text(line, 15, finalY);
      finalY += 5;
    }

    // Units Table
    if (isProject && subUnits.length > 0) {
      if (finalY > pageHeight - 60) { doc.addPage(); finalY = 20; } else { finalY += 15; }
      doc.setFillColor(black[0], black[1], black[2]);
      doc.rect(0, finalY - 5, 210, 15, 'F');
      doc.setTextColor(gold[0], gold[1], gold[2]);
      doc.setFontSize(12);
      doc.text("Tabela de Unidades - " + property.title, 15, finalY + 5);
      const unitsBody = subUnits.map(u => [u.title, u.unit_type || 'Apto', `${u.sq_ft}m²`, `${u.bedrooms || 0}D`, formatCurrency(u.price_starting_at), u.status === 'sold' ? 'Vendido' : u.status === 'reserved' ? 'Reservado' : 'Disponível']);
      autoTable(doc, {
        startY: finalY + 15,
        head: [['Unidade', 'Tipo', 'Área', 'Dorm.', 'Valor', 'Status']],
        body: unitsBody,
        theme: 'striped',
        headStyles: { fillColor: black, textColor: gold },
        styles: { fontSize: 9 },
        margin: { left: 15, right: 15 }
      });
      finalY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Merge all image sources
    let allPhotos: string[] = [];
    // From gallery table
    if (gallery && gallery.length > 0) {
      allPhotos = [...gallery.filter(item => item.type === 'image').map(item => item.url)];
    }
    // From property direct columns (units/standalone usually have these)
    if (property.floor_plan_url && Array.isArray(property.floor_plan_url)) {
      allPhotos = [...allPhotos, ...property.floor_plan_url];
    }
    if (property.floor_layout_url && Array.isArray(property.floor_layout_url)) {
      allPhotos = [...allPhotos, ...property.floor_layout_url];
    }
    
    // Remove duplicates and hero image if already used
    allPhotos = [...new Set(allPhotos)].filter(url => url !== property.hero_image_url);

    // Amenities & Gallery
    if (amenities.length > 0 || allPhotos.length > 0) {
      doc.addPage();
      doc.setFillColor(black[0], black[1], black[2]);
      doc.rect(0, 0, 210, 20, 'F');
      doc.setTextColor(gold[0], gold[1], gold[2]);
      doc.setFontSize(16);
      doc.text(property.title || "Imóvel", 15, 13);
      let currentY = 35;
      
      if (amenities.length > 0) {
        doc.setTextColor(black[0], black[1], black[2]);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("Diferenciais", 15, currentY);
        const amenityNames = amenities.map(a => a.name).join(' • ');
        const splitAmenities = doc.splitTextToSize(amenityNames, 180);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(splitAmenities, 15, currentY + 8);
        currentY += (splitAmenities.length * 5) + 20;
      }
      
      if (allPhotos.length > 0) {
        if (currentY > pageHeight - 60) { doc.addPage(); currentY = 20; }
        doc.setTextColor(black[0], black[1], black[2]);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("Galeria de Fotos", 15, currentY);
        
        const imagesToDisplay = allPhotos.slice(0, 12); // Increased to 12 images
        for (let i = 0; i < imagesToDisplay.length; i++) {
          const rowOnPage = Math.floor((i % 6) / 2);
          const col = i % 2;
          const x = 15 + (col * 95);
          
          if (i > 0 && i % 6 === 0) {
            doc.addPage();
            doc.setFillColor(black[0], black[1], black[2]);
            doc.rect(0, 0, 210, 15, 'F');
            doc.setTextColor(gold[0], gold[1], gold[2]);
            doc.text("Galeria (cont.)", 15, 10);
            currentY = 20;
          }
          
          const yPos = (i % 6 === 0 && i !== 0 ? 25 : currentY + 10) + (rowOnPage * 70);
          await addImageToPDF(imagesToDisplay[i], x, yPos, 85, 60);
        }
      }
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(gold[0], gold[1], gold[2]);
      doc.rect(0, 287, 210, 10, 'F');
      doc.setTextColor(black[0], black[1], black[2]);
      doc.setFontSize(8);
      doc.text(`Gerado em ${new Date().toLocaleDateString()} | Lumis - Inteligência Imobiliária`, 15, 292);
      doc.text(`Página ${i} de ${pageCount}`, 180, 292);
    }

    doc.save(`${(property.title || 'Imovel').replace(/\s+/g, '_')}_Lumis.pdf`);
  } catch (error) {
    console.error("ERRO PDF:", error);
    alert("Erro ao gerar PDF.");
  } finally {
    document.body.removeChild(loadingDiv);
  }
};
