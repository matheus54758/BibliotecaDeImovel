const html = "Zoneamento : Área do Lote conforme Cadastro: 1152.0 m² Áreas do lote que sobrepõe a zona: * ARP-2.3 - 100,00% Número do Projeto";

const areaMatch = html.match(/Área do Lote conforme Cadastro.*?([\d.,]+)\s*m²/is);
console.log("Area:", areaMatch ? areaMatch[1] : "not found");

const zoneMatch = html.match(/Áreas do lote que sobrepõe a zona:[\s\S]*?\*\s*([A-Z0-9.-]+)/i);
console.log("Zone:", zoneMatch ? zoneMatch[1] : "not found");

function formatIPTU(iptu) {
  // 32.30.051.0676.001-400
  // 32 30 051 0676 001 400
  const clean = iptu.replace(/\D/g, '');
  if (clean.length === 17) {
    return `${clean.substring(0,2)}.${clean.substring(2,4)}.${clean.substring(4,7)}.${clean.substring(7,11)}.${clean.substring(11,14)}-${clean.substring(14)}`;
  }
  return iptu;
}
console.log("Format:", formatIPTU("32300510676001400"));
