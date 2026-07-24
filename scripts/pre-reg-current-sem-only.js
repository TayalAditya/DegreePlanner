// pre-reg-current-sem-only.js
// Show only IC/DC courses whose effectiveCompulsorySem === offeringSemester OR is null
// (null = always-on IC/DC with no semester restriction)
// No backlogs.
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

function pickBestMapping(branchMappings, nb, batchYear) {
  if (!branchMappings || branchMappings.length === 0) return undefined;
  const candidates = getBranchCandidates(nb);
  const order = new Map(candidates.map((b, i) => [normalizeBranchCode(b), i]));
  const batchStr = batchYear ? String(batchYear) : '';
  let best, bestScore = Infinity;
  for (const m of branchMappings) {
    const idx = order.get(normalizeBranchCode(m.branch));
    if (idx === undefined) continue;
    const bp = m.batch && m.batch !== '' ? (m.batch === batchStr ? 0 : 1000) : 0.5;
    const score = idx + bp;
    if (score < bestScore) { best = m; bestScore = score; }
  }
  return best;
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

  const batches = [2025];
  const branches = ['CSE', 'DSAI', 'EE', 'ME', 'CE', 'EP', 'BE', 'MNC', 'GE-ROBO', 'GE-MECH', 'GE-COMM', 'GE-OPEN', 'MSE', 'BSCS', 'MEVLSI'];
  const dpOptBranches = new Set(['CE', 'BE', 'EP', 'BSCS']);

  for (const batchYear of batches) {
    const sem = inferSem(batchYear);

    for (const branchRaw of branches) {
      const nb = normalizeBranchCode(branchRaw);

      // Step 1: filter branch/sem eligible offerings
      const filtered = offerings.filter(o => {
        const nc = o.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (nc === 'IC202P' && dpOptBranches.has(nb) && batchYear >= 2024) return true;
        const candidates = getBranchCandidates(nb);
        const eligible = o.branches.includes('ALL') || o.branches.some(b => candidates.includes(normalizeBranchCode(b)));
        if (!eligible) return false;
        if (o.eligibleSems.length > 0 && !o.eligibleSems.includes(sem)) return false;
        return true;
      });

      const ic = [], dc = [];

      for (const o of filtered) {
        const nc = o.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const raw = o.courseCode.toUpperCase();

        // HSS override — skip
        if (raw.startsWith('HS') || /^IK\d/.test(nc) || nc === 'IC181' || (nc === 'IC182' && batchYear >= 2024)) continue;

        // IC202P → FE for dpOpt branches B24+
        if (nc === 'IC202P' && dpOptBranches.has(nb) && batchYear >= 2024) continue;
        // IC272 → FE for BSCS
        if (nc === 'IC272' && nb === 'BSCS') continue;

        const bestMapping = o.course ? pickBestMapping(o.course.branchMappings, nb, batchYear) : undefined;
        const cat = bestMapping?.courseCategory ?? o.categoryOverride ?? 'FE';

        if (!['IC', 'IC_BASKET', 'DC', 'IKS'].includes(cat)) continue;

        // effectiveCompulsorySem: prefer branchMapping.semester over offering.compulsorySem
        const effSem = (bestMapping && bestMapping.semester != null)
          ? bestMapping.semester
          : (o.compulsorySem != null ? o.compulsorySem : null);

        // KEY FILTER: only include if effSem is null (always-on) OR equals current sem
        // Exclude backlogs (effSem < sem) and future (effSem > sem)
        if (effSem !== null && effSem !== sem) continue;

        const entry = o.courseCode + ' ' + o.courseName;
        if (cat === 'DC') dc.push(entry);
        else ic.push(entry); // IC, IC_BASKET, IKS
      }

      ic.sort();
      dc.sort();

      console.log('B' + String(batchYear).slice(2) + ' ' + branchRaw + ' (sem ' + sem + '):');
      console.log('  IC: ' + (ic.length ? '\n' + ic.map(c => '    ' + c).join('\n') : ' (none)'));
      console.log('  DC: ' + (dc.length ? '\n' + dc.map(c => '    ' + c).join('\n') : ' (none)'));
      console.log('');
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
