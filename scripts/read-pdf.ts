import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function readPDF() {
  const pdfPath = path.join(process.cwd(), 'docs', 'Aditya Tayal UG Batch 2023.pdf');
  const dataBuffer = fs.readFileSync(pdfPath);
  
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(dataBuffer) });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }
  
  console.log('PDF Text Content:');
  console.log('='.repeat(80));
  console.log(fullText);
  console.log('='.repeat(80));
  console.log(`\nTotal Pages: ${pdf.numPages}`);
}

readPDF().catch(console.error);
