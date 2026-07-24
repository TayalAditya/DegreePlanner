import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
const p = new PrismaClient();
const norm = (c?: string|null) => c ? c.toUpperCase().replace(/[\s\-.]/g,'') : '';
const DRY = !process.argv.includes('--apply');
(async () => {
  const cat: Record<string,string> = JSON.parse(fs.readFileSync('scripts/_ltpc_from_catalog.json','utf8'));
  // malformed = ltpc set but not a proper 4-part L-T-P-C
  const all = await p.course.findMany({ where:{ ltpc:{ not:null } }, select:{id:true,code:true,ltpc:true,credits:true} });
  const malformed = all.filter(c => (c.ltpc||'').split('-').length !== 4);
  console.log('Malformed ltpc entries:', malformed.length);

  const fix: {id:string,code:string,old:string,neu:string}[] = [];
  const mism: string[] = [];
  let noCat=0;
  for (const m of malformed) {
    const v = cat[norm(m.code)];
    if (!v) { noCat++; continue; }
    const lc = Number(v.split('-')[3]);
    if (m.credits!=null && !isNaN(lc) && Math.abs(lc-m.credits)>0.5) { mism.push(`${m.code}: cat ${v} vs DB cr ${m.credits}`); continue; }
    fix.push({id:m.id, code:m.code, old:m.ltpc!, neu:v});
  }
  console.log(`Fixable from catalog (credit-valid): ${fix.length}`);
  console.log(`Credit-mismatch (skip): ${mism.length}`);
  console.log(`No catalog entry: ${noCat}`);
  if (DRY) { console.log('\n[DRY] sample:', fix.slice(0,8).map(f=>`${f.code}:${f.old}->${f.neu}`)); await p.$disconnect(); return; }
  let n=0; for (const f of fix) { await p.course.update({ where:{id:f.id}, data:{ltpc:f.neu} }); n++; }
  console.log(`\nFixed ${n} malformed LTPC entries.`);
  await p.$disconnect();
})();
