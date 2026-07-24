import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
const p = new PrismaClient();
const norm = (c?: string|null) => c ? c.toUpperCase().replace(/[\s\-.]/g,'') : '';
const DRY = !process.argv.includes('--apply');

function ltpcCredit(ltpc: string): number | null {
  const parts = ltpc.split('-').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  return parts[3];
}

(async () => {
  const ug: Record<string,string> = JSON.parse(fs.readFileSync('scripts/_ltpc_from_ugpdf.json','utf8'));
  const sheets: Record<string,string> = JSON.parse(fs.readFileSync('scripts/_ltpc_from_sheets.json','utf8'));
  const off = new Map<string,string>();
  for (const o of await p.courseOffering.findMany({ where:{ltpc:{not:null}}, select:{courseCode:true,ltpc:true}})) off.set(norm(o.courseCode), o.ltpc!);

  const missing = await p.course.findMany({ where:{ltpc:null}, select:{id:true,code:true,name:true,credits:true} });
  const updates: {id:string,code:string,ltpc:string,src:string}[] = [];
  const mismatches: string[] = [];

  for (const m of missing) {
    const k = norm(m.code);
    let ltpc: string | undefined, src = '';
    if (ug[k]) { ltpc = ug[k]; src='UG-PDF'; }
    else if (off.has(k)) { ltpc = off.get(k); src='Offering'; }
    else if (sheets[k]) { ltpc = sheets[k]; src='Sheet'; }
    if (!ltpc) continue;
    const lc = ltpcCredit(ltpc);
    // credit sanity: LTPC credit should match DB credits (allow 0.5 tolerance)
    if (lc !== null && m.credits != null && Math.abs(lc - m.credits) > 0.5) {
      mismatches.push(`${m.code}: LTPC=${ltpc} (cr ${lc}) vs DB credits ${m.credits}  [${src}]`);
      continue; // skip mismatches — don't corrupt data
    }
    updates.push({id:m.id, code:m.code, ltpc, src});
  }

  console.log(`Missing: ${missing.length}`);
  console.log(`Safe updates (credit matches): ${updates.length}`);
  console.log(`Skipped credit-mismatches: ${mismatches.length}`);
  if (mismatches.length) { console.log('--- mismatches ---'); mismatches.slice(0,20).forEach(x=>console.log('  ',x)); }
  const bySrc: Record<string,number> = {};
  updates.forEach(u=>bySrc[u.src]=(bySrc[u.src]||0)+1);
  console.log('By source:', bySrc);

  if (DRY) { console.log('\n[DRY RUN] --apply to write.'); await p.$disconnect(); return; }
  let done=0;
  for (const u of updates) { await p.course.update({ where:{id:u.id}, data:{ltpc:u.ltpc} }); done++; }
  console.log(`\nApplied ${done} LTPC updates.`);
  await p.$disconnect();
})();
