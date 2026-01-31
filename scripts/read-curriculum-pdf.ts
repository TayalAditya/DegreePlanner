import * as fs from 'fs';
import pdf from 'pdf-parse';

async function readPDF() {
  const dataBuffer = fs.readFileSync('docs/Aditya Tayal UG Batch 2023.pdf');
  const data = await pdf(dataBuffer);
  
  console.log('PDF Text Content:\n');
  console.log(data.text);
}

readPDF().catch(console.error);
