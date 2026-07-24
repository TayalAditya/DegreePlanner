// pre-reg-ic-dc.js — print IC and DC compulsory courses for all 36 branch/batch combos
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalizeBranchCode(branch) {
  const b = String(branch || '').trim().toUpperCase();
  if (!b) return '';
  if (b === 'BIOE') return 'BE';
  if (b === 'GERAI') return 'GE-ROBO';
  if (b === 'GECE') return 'GE-COMM';
  if (b === 'GEMECH') return 'GE-MECH';
  if (b === 'GEFIN' || b === 'GEFINTECH') return 'GE-FIN';
  return b;
}

// Offering branch tokens are messy: "GE B23/B24/B25", "MNC B23",
// "MSE B23/B24/B25; counts as ICB only if ...". Strip the batch suffix and any
// trailing prose, then normalize, so eligibility matching sees a clean code.
function normOfferingToken(tok) {
  let t = String(tok || '').split(';')[0].trim();   // drop "; counts as ..."
  t = t.replace(/\s+B\d.*$/i, '').trim();            // drop " B23/B24/B25"
  return normalizeBranchCode(t);
}

function getBranchCandidates(branch) {
  const b = normalizeBranchCode(branch);
  if (!b) return ['COMMON'];
  const candidates = [b];
  if (b === 'CSE') candidates.push('CS');
  if (b === 'CS') candidates.push('CSE');
  if (b === 'DSE' || b === 'DSAI') candidates.push('DS', 'DSE', 'DSAI');
  if (b === 'DS') candidates.push('DSE', 'DSAI');
  if (b === 'MSE') candidates.push('MS');
  if (b === 'MS') candidates.push('MSE');
  if (b === 'BSCS') candidates.push('BS', 'CH');
  if (b === 'BS') candidates.push('BSCS', 'CH');
  if (b === 'BE') candidates.push('BIO');
  if (b === 'BIO') candidates.push('BE');
  if (b.startsWith('GE-')) candidates.push('GE');
  candidates.push('COMMON');
  return [...new Set(candidates.filter(Boolean))];
}

function pickCategory(branchMappings, branch, batch) {
  if (!branchMappings || branchMappings.length === 0) return undefined;
  const candidates = getBranchCandidates(branch);
  const order = new Map(candidates.map((b, i) => [normalizeBranchCode(b), i]));
  const batchStr = batch ? String(batch) : '';
  let best, bestScore = Infinity;
  for (const m of branchMappings) {
    const idx = order.get(normalizeBranchCode(m.branch));
    if (idx === undefined) continue;
    const batchPenalty = m.batch && m.batch !== '' ? (m.batch === batchStr ? 0 : 1000) : 0.5;
    const score = idx + batchPenalty;
    if (score < bestScore) { best = m; bestScore = score; }
  }
  return best?.courseCategory;
}

function inferSem(batchYear) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now);
  const month = Number(parts.find(p => p.type === 'month').value);
  const year  = Number(parts.find(p => p.type === 'year').value);
  const day   = Number(parts.find(p => p.type === 'day').value);
  const clamp = s => Math.min(8, Math.max(1, Math.trunc(s)));
  const ye = year - batchYear;
  if (month >= 1 && (month < 5 || (month === 5 && day < 30))) return clamp(ye * 2);
  if ((month === 5 && day >= 30) || month === 6 || month === 7) return clamp(ye * 2 + 1);
  return clamp(ye * 2 + 1);
}

async function main() {
  const offerings = await prisma.courseOffering.findMany({
    where: { offeringYear: 2026, isActive: true },
    include: {
      course: {
        select: {
          branchMappings: { select: { courseCategory: true, branch: true, batch: true, semester: true } },
        },
      },
    },
    orderBy: { courseCode: 'asc' },
  });

  // Real branch/batch combos (from the students table):
  //   DSE only exists in B23/B24; DSAI only in B25. MEVLSI (VLSI) is in all.
  //   GE is split into its specializations (ROBO/COMM/MECH/FIN) — shown separately.
  const GE_SUBS = ['GE-ROBO', 'GE-COMM', 'GE-MECH', 'GE-FIN'];
  const CORE = ['CSE', 'EE', 'ME', 'CE', 'EP', 'BE', 'MNC', 'MSE', 'MEVLSI', 'BSCS'];
  const BRANCHES_BY_BATCH = {
    2023: [...CORE, 'DSE', ...GE_SUBS],
    2024: [...CORE, 'DSE', ...GE_SUBS],
    2025: [...CORE, 'DSAI', ...GE_SUBS],
  };
  const dpOptBranches = new Set(['CE', 'BE', 'EP', 'BSCS']);

  for (const batchYear of [2025, 2024, 2023]) {
    const sem = inferSem(batchYear);

    for (const branchRaw of BRANCHES_BY_BATCH[batchYear]) {
      const nb = normalizeBranchCode(branchRaw);
      // Candidate codes for eligibility fallback (e.g. GE-ROBO → GE → COMMON),
      // so sub-branches also pick up courses tagged with the umbrella branch.
      const candSet = new Set(getBranchCandidates(nb).map(normalizeBranchCode));

      // filter eligible offerings
      const filtered = offerings.filter(o => {
        const nc = o.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        // IC202P optional for CE/BE/EP/BSCS B24+
        if (nc === 'IC202P' && dpOptBranches.has(nb) && batchYear >= 2024) return true;
        const eligible = o.branches.includes('ALL')
          || o.branches.some(b => candSet.has(normOfferingToken(b)));
        if (!eligible) return false;
        if (o.eligibleSems.length > 0 && !o.eligibleSems.includes(sem)) return false;
        return true;
      });

      const ic = [];
      const dc = [];

      for (const o of filtered) {
        const nc = o.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const raw = o.courseCode.toUpperCase();

        // HSS override — skip entirely for this report
        if (raw.startsWith('HS') || /^IK\d/.test(nc) || nc === 'IC181' || (nc === 'IC182' && batchYear >= 2024)) continue;

        // IC202P → FE for dpOpt branches
        if (nc === 'IC202P' && dpOptBranches.has(nb) && batchYear >= 2024) continue;
        // IC272 → FE for BSCS
        if (nc === 'IC272' && nb === 'BSCS') continue;

        const mappingCat = o.course ? pickCategory(o.course.branchMappings, nb, batchYear) : undefined;
        const cat = mappingCat ?? o.categoryOverride ?? 'FE';

        if (!['IC', 'IC_BASKET', 'DC', 'IKS'].includes(cat)) continue;

        // resolve effective compulsory semester
        let branchSem = null;
        if (o.course && o.course.branchMappings) {
          const cands = getBranchCandidates(nb);
          const ord = new Map(cands.map((b, i) => [normalizeBranchCode(b), i]));
          const bs = String(batchYear);
          let best, bestScore = Infinity;
          for (const m of o.course.branchMappings) {
            const idx = ord.get(normalizeBranchCode(m.branch));
            if (idx === undefined) continue;
            const bp = m.batch && m.batch !== '' ? (m.batch === bs ? 0 : 1000) : 0.5;
            const sc = idx + bp;
            if (sc < bestScore) { best = m; bestScore = sc; }
          }
          branchSem = (best && best.semester != null) ? best.semester : null;
        }
        const effSem = branchSem !== null ? branchSem : (o.compulsorySem != null ? o.compulsorySem : null);
        const semMatch = effSem === null || effSem === sem;
        const isBacklog = effSem !== null && effSem < sem;
        if (!semMatch && !isBacklog) continue;

        const entry = o.courseCode + ' ' + o.courseName;
        if (cat === 'DC') {
          dc.push(entry);
        } else {
          // IC, IC_BASKET, IKS
          ic.push(entry);
        }
      }

      ic.sort();
      dc.sort();

      console.log('B' + String(batchYear).slice(2) + ' ' + branchRaw + ' (sem ' + sem + '):');
      if (ic.length) {
        console.log('  IC:');
        ic.forEach(c => console.log('    ' + c));
      } else {
        console.log('  IC: (none)');
      }
      if (dc.length) {
        console.log('  DC:');
        dc.forEach(c => console.log('    ' + c));
      } else {
        console.log('  DC: (none)');
      }
      console.log('');
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
