const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const dataBuffer = fs.readFileSync('docs/Aditya Tayal UG Batch 2023.pdf');
const parser = new PDFParse();

parser.parse(dataBuffer).then(function(data) {
  console.log('=== CURRICULUM DATA ===\n');
  console.log(data.text);
}).catch(err => console.error(err));
