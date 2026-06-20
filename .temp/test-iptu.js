const iptu = "32300510676001400";
console.log("IPTU to test:", iptu);

async function testEndpoints() {
  const endpointsToTest = [
    'https://geoportal.pmf.sc.gov.br/geoserver/wfs?request=GetCapabilities',
    'https://geoportal.pmf.sc.gov.br/server/rest/services?f=json',
    'https://geoportal.pmf.sc.gov.br/arcgis/rest/services?f=json'
  ];

  for (const url of endpointsToTest) {
    console.log(`\nTesting ${url}...`);
    try {
      const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json, text/xml' }});
      console.log(`Status: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.log(`Response start: ${text.substring(0, 100)}`);
    } catch (e) {
      console.error(`Error fetching ${url}: ${e.message}`);
    }
  }
}

testEndpoints();
