import fs from 'fs';

const url = "https://geofloripa.pmf.sc.gov.br/urbano/relatorios/consulta_viabilidade_para_construcao";

async function run() {
  try {
    const res = await fetch(url, {
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "x-user-login": "geoportal",
        "x-user-token": "30ac2251814ad72af037e2ec217c7bfc",
        "Referer": "https://geo.pmf.sc.gov.br/"
      },
      body: "{\"inscricao\":\"32.30.051.0676.001-400\",\"usos_construcao\":[4]}",
      method: "POST"
    });
    
    const data = await res.json();
    if (data.success && data.report_response && data.report_response.html) {
      fs.writeFileSync('.temp/report.html', data.report_response.html);
      console.log("Saved report.html. Parsing data...");
      
      const html = data.report_response.html;
      // Let's do some quick and dirty regex to find data
      let text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      
      const idx = text.indexOf('Zoneamento');
      if (idx !== -1) {
         console.log("Found Zoneamento:", text.substring(idx, idx + 200));
      }
      
      const idx2 = text.indexOf('Área do lote');
      if (idx2 !== -1) {
         console.log("Found Area:", text.substring(idx2, idx2 + 100));
      }
      
    } else {
      console.log("No HTML returned.");
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}
run();
