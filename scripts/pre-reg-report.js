// pre-reg-report.js — IC + DC for upcoming sem (3/5/7) per branch/batch
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function norm(branch) {
  const b = String(branch || '').trim().toUpperCase();
  if (b === 'BIOE') return 'BE';
  if (b === 'GERAI') return 'GE-ROBO';
  if (b === 'GECE') return 'GE-COMM';
  if (b === 'GEMECH') return 'GE-MECH';
  if (b === 'GEFIN' || b === 'GEFINTECH') return 'GE-FIN';
  return b;
}

function normOfferingToken(tok) {
  let t = String(tok || '').split(';')[0].trim();
  t = t.replace(/\s+B\d.*$/i, '').trim();
  return norm(t);
}

function getCandidates(branch) {
  const b = norm(branch);
  if (!b) return ['COMMON'];
  const c = [b];
  if (b === 'CSE') c.push('CS');
  if (b === 'CS') c.push('CSE');
  if (b === 'DSE' || b === 'DSAI') c.push('DS', 'DSE', 'DSAI');
  if (b === 'DS') c.push('DSE', 'DSAI');
  if (b === 'MSE') c.push('MS');
  if (b === 'MS') c.push('MSE');
  if (b === 'MEVLSI') c.push('VL', 'VLSI');
  if (b === 'VL') c.push('MEVLSI', 'VLSI');
  if (b === 'VLSI') c.push('VL', 'MEVLSI');
  if (b === 'BSCS') c.push('BS', 'CH');
  if (b === 'BS') c.push('BSCS', 'CH');
  if (b === 'BE') c.push('BIO');
  if (b === 'BIO') c.push('BE');
  if (b.startsWith('GE-')) c.push('GE');
  c.push('COMMON');
  return [...new Set(c.filter(Boolean))];
}

function pickBestMapping(branchMappings, branch, batch) {
  if (!branchMappings || !branchMappings.length) return undefined;
  const cands = getCandidates(branch);
  const order = new Map(cands.map((b, i) => [norm(b), i]));
  const bs = batch ? String(batch) : '';
  let best, bestScore = Infinity;
  for (const m of branchMappings) {
    const idx = order.get(norm(m.branch));
    if (idx === undefined) continue;
    const bp = m.batch && m.batch !== '' ? (m.batch === bs ? 0 : 1000) : 0.5;
    const sc = idx + bp;
    if (sc < bestScore) { best = m; bestScore = sc; }
  }
  return best;
}

async function main() {
  const offerings = await prisma.courseOffering.findMany({
    where: { offeringYear: 2026, isActive: true },
    include: {
      course: {
        select: {
          code: true, credits: true,
          branchMappings: { select: { courseCategory: true, branch: true, batch: true, semester: true } },
        },
      },
    },
    orderBy: { courseCode: 'asc' },
  });

  const GE_SUBS = ['GE-ROBO', 'GE-COMM', 'GE-MECH', 'GE-OPEN', 'GE-FIN'];
  const CORE = ['CSE', 'EE', 'ME', 'CE', 'EP', 'BE', 'MNC', 'MSE', 'MEVLSI', 'BSCS'];
  const dpOptBranches = new Set(['CE', 'BE', 'EP', 'BSCS']);

  const combos = [
    { batch: 2025, sem: 3, branches: [...CORE, 'DSAI', ...GE_SUBS] },
    { batch: 2024, sem: 5, branches: [...CORE, 'DSE', ...GE_SUBS] },
    { batch: 2023, sem: 7, branches: [...CORE, 'DSE', ...GE_SUBS] },
  ];

  for (const { batch, sem, branches } of combos) {
    console.log(`\n${'#'.repeat(70)}`);
    console.log(`# B${String(batch).slice(2)} — Semester ${sem}`);
    console.log(`${'#'.repeat(70)}`);

    for (const branchRaw of branches) {
      const nb = norm(branchRaw);
      const candSet = new Set(getCandidates(nb).map(norm));

      const ic = [];
      const dc = [];

      for (const o of offerings) {
        const nc = o.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const raw = o.courseCode.toUpperCase();

        // Skip HSS/IKS for cleaner output
        if (raw.startsWith('HS') || /^IK\d/.test(nc) || nc === 'IC181' || (nc === 'IC182' && batch >= 2024)) continue;

        // IC202P optional for dpOpt branches
        if (nc === 'IC202P' && dpOptBranches.has(nb) && batch >= 2024) continue;
        // IC272 not for BSCS
        if (nc === 'IC272' && nb === 'BSCS') continue;

        // Check branch eligibility
        const eligible = o.branches.includes('ALL')
          || o.branches.some(b => candSet.has(normOfferingToken(b)));
        if (!eligible) continue;

        // Check semester eligibility from offering
        if (o.eligibleSems.length > 0 && !o.eligibleSems.includes(sem)) continue;

        // Get category from mapping
        const mapping = o.course ? pickBestMapping(o.course.branchMappings, nb, batch) : undefined;
        const cat = mapping?.courseCategory ?? o.categoryOverride ?? 'FE';

        if (!['IC', 'IC_BASKET', 'DC'].includes(cat)) continue;

        // Check semester from mapping — only show courses for THIS sem
        const mappingSem = mapping?.semester ?? null;
        const effSem = mappingSem !== null ? mappingSem : (o.compulsorySem != null ? o.compulsorySem : null);

        // Only include if: semester matches exactly, OR no semester assigned (compulsory any sem)
        if (effSem !== null && effSem !== sem) continue;

        const credits = o.course?.credits ?? o.credits ?? 0;
        const entry = { code: o.courseCode, name: o.courseName, credits };

        if (cat === 'DC') {
          dc.push(entry);
        } else {
          ic.push(entry);
        }
      }

      ic.sort((a, b) => a.code.localeCompare(b.code));
      dc.sort((a, b) => a.code.localeCompare(b.code));

      if (!ic.length && !dc.length) {
        console.log(`\n  ${branchRaw}: (no IC/DC this sem)`);
        continue;
      }

      const totalIC = ic.reduce((s, c) => s + c.credits, 0);
      const totalDC = dc.reduce((s, c) => s + c.credits, 0);

      console.log(`\n  ${branchRaw} [IC=${totalIC}cr, DC=${totalDC}cr]`);

      if (ic.length) {
        console.log('    IC:');
        for (const c of ic) {
          console.log(`      ${c.code.padEnd(14)} ${String(c.credits).padStart(2)}cr  ${c.name}`);
        }
      }
      if (dc.length) {
        console.log('    DC:');
        for (const c of dc) {
          console.log(`      ${c.code.padEnd(14)} ${String(c.credits).padStart(2)}cr  ${c.name}`);
        }
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
