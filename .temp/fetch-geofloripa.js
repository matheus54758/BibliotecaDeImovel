async function run() {
  try {
    const mainScript = "https://geoportal.pmf.sc.gov.br/static/js/main.274d9ce1.chunk.js";
    const res = await fetch(mainScript);
    const text = await res.text();
    
    // look for URLs in the code
    const urlRegex = /https?:\/\/[^"'\\]+/gi;
    let match;
    const urls = new Set();
    while ((match = urlRegex.exec(text)) !== null) {
      if (match[0].includes('pmf.sc.gov.br')) {
        urls.add(match[0]);
      }
    }
    
    console.log("URLs found in main script:");
    urls.forEach(u => console.log(u));
    
  } catch (e) {
    console.error("Error:", e.message);
  }
}
run();
