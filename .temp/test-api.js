import fs from 'fs';
const iptu = "32300510676001400";
const url = "https://geofloripa.pmf.sc.gov.br/urbano/relatorios/consulta_viabilidade_para_construcao";

async function testApi() {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ inscricao_imobiliaria: iptu })
    });
    const text = await res.text();
    fs.writeFileSync('.temp/response.html', text);
    console.log("Saved response.html. Size:", text.length);
  } catch (e) {
    console.error("POST failed", e.message);
  }
}
testApi();
