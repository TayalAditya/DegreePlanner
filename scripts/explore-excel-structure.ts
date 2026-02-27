import XLSX from 'xlsx';

const files = [
  'docs/Course List semester wise.xlsx',
  'docs/DC_Courses_Batch_2023.xlsx'
];

files.forEach(file => {
  try {
    const workbook = XLSX.readFile(file);
    console.log(`\n📁 File: ${file}`);
    console.log(`📋 Worksheets (${workbook.SheetNames.length}):`);
    
    workbook.SheetNames.forEach(name => {
      const ws = workbook.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const headers = (rows[0] as any[]) || [];
      
      // Find semester columns
      const semesters = headers
        .map((h: any, i: number) => {
          const str = h?.toString().toLowerCase() || '';
          const match = str.match(/(\d)(?:st|nd|rd|th)\s+sem/);
          return match ? `${match[1]} (col ${i})` : null;
        })
        .filter(Boolean);
      
      console.log(`  - ${name}: ${rows.length} rows, semesters: [${semesters.join(', ') || 'none'}]`);
    });
  } catch (e) {
    console.log(`  ❌ Error reading ${file}`);
  }
});
