import fs from 'fs';

const html = fs.readFileSync('.temp/response.html', 'utf8');

// Strip all script, style, and html tags to just leave text
let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
text = text.replace(/<[^>]+>/g, ' ');

// Replace multiple spaces and newlines with a single space/newline
text = text.replace(/\s+/g, ' ').trim();

console.log("Extracted text snippet:");
console.log(text.substring(0, 1000));

if (text.toLowerCase().includes('zoneamento')) {
  const idx = text.toLowerCase().indexOf('zoneamento');
  console.log("\nContext around 'zoneamento':");
  console.log(text.substring(Math.max(0, idx - 100), idx + 300));
}

if (text.toLowerCase().includes('inscricao')) {
    const idx = text.toLowerCase().indexOf('inscricao');
    console.log("\nContext around 'inscricao':");
    console.log(text.substring(Math.max(0, idx - 100), idx + 300));
}
