import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
const p = new PrismaClient();
const norm = (c?: string|null) => c ? c.toUpperCase().replace(/[\s\-.]/g,'') : '';
const DRY = !process.argv.includes('--apply');
(async () => {
  const cat: Record<string,string> = JSON.parse(fs.readFileSync('scripts/_ltpc_from_catalog.json','utf8'));
  const missing = await p.course.findMany({ where:{ltpc:null}, select:{id:true,code:true,name:true,credits:true} });
  const safe: {id:string,code:string,ltpc:string}[] = [];
  const mism: {code:string,name:string,catalog:string,dbCr:number|null}[] = [];
  for (const m of missing) {
    const v = cat[norm(m.code)]; if(!v) continue;
    const lc = Number(v.split('-')[3]);
    if (m.credits!=null && !isNaN(lc) && Math.abs(lc-m.credits)>0.5) {
      mism.push({code:m.code, name:m.name, catalog:v, dbCr:m.credits}); continue;
    }
    safe.push({id:m.id, code:m.code, ltpc:v});
  }
  console.log(`Safe (credit-valid) updates: ${safe.length}`);
  console.log(`Credit-mismatch (needs manual review): ${mism.length}`);
  // write mismatch report
  let rep = '# LTPC Credit Mismatches (catalog vs DB) — manual review\n\n';
  rep += '| Code | Course | Catalog LTPC | Catalog Cr | DB Cr |\n|---|---|---|---|---|\n';
  for (const m of mism) rep += `| ${m.code} | ${m.name.slice(0,40)} | ${m.catalog} | ${m.catalog.split('-')[3]} | ${m.dbCr} |\n`;
  fs.writeFileSync('docs/LTPC_MISMATCHES.md', rep);
  console.log('Wrote docs/LTPC_MISMATCHES.md');
  if (DRY) { console.log('\n[DRY RUN] --apply to write safe updates.'); await p.$disconnect(); return; }
  let n=0; for (const s of safe) { await p.course.update({ where:{id:s.id}, data:{ltpc:s.ltpc} }); n++; }
  console.log(`\nApplied ${n} safe LTPC updates.`);
  await p.$disconnect();
})();
