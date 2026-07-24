// pre-reg-summary.js — compact summary table
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
  if (b === 'MEVLSI') candidates.push('VL', 'VLSI');
  if (b === 'VL') candidates.push('MEVLSI', 'VLSI');
  if (b === 'VLSI') candidates.push('VL', 'MEVLSI');
  if (b === 'BSCS') candidates.push('BS', 'CH');
  if (b === 'BS') candidates.push('BSCS', 'CH');
  if (b === 'CH') candidates.push('BSCS', 'BS');
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

function inferAcademicState(batchYear, now) {
  now = now || new Date();
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now);
  const month = Number(parts.find(p => p.type === 'month')?.value);
  const year  = Number(parts.find(p => p.type === 'year')?.value);
  const day   = Number(parts.find(p => p.type === 'day')?.value);
  const clamp = s => Math.min(8, Math.max(1, Math.trunc(s)));
  const yearsElapsed = year - batchYear;
  if (month >= 1 && (month < 5 || (month === 5 && day < 30))) {
    return { currentSemester: clamp(yearsElapsed * 2), phase: 'SPRING', upcomingSemester: null };
  }
  if ((month === 5 && day >= 30) || month === 6 || month === 7) {
    const upcomingFall = clamp(yearsElapsed * 2 + 1);
    return { currentSemester: upcomingFall, phase: 'PRE_REGISTRATION', upcomingSemester: upcomingFall };
  }
  return { currentSemester: clamp(yearsElapsed * 2 + 1), phase: 'FALL', upcomingSemester: null };
}

async function main() {
  const OFFERING_YEAR = 2026;
  const offerings = await prisma.courseOffering.findMany({
    where: { offeringYear: OFFERING_YEAR, isActive: true },
    include: {
      course: {
        select: {
          id: true, ltpc: true,
          branchMappings: { select: { courseCategory: true, branch: true, batch: true, semester: true } },
        },
      },
    },
    orderBy: { courseCode: 'asc' },
  });

  console.log(`Fetched ${offerings.length} active offerings for offeringYear ${OFFERING_YEAR}\n`);

  const batches = [2025, 2024, 2023];
  const branches = ['CSE', 'DSE', 'EE', 'ME', 'CE', 'EP', 'BE', 'MNC', 'GE', 'MSE', 'BSCS', 'DSAI'];
  const dpOptionalBranches = new Set(['CE', 'BE', 'EP', 'BSCS']);

  // header
  const COL = 8;
  const pad = (s, n) => String(s).padStart(n);

  console.log(pad('Batch/Branch', 16) + pad('sem', 4) + pad('Comp', COL) + pad('DE', COL) + pad('HSS', COL) + pad('FE/other', COL) + pad('TOTAL', COL));
  console.log('-'.repeat(16 + 4 + COL*4));

  // per-batch separator
  let lastBatch = null;

  for (const batchYear of batches) {
    const state = inferAcademicState(batchYear);
    const offeringSemester = state.upcomingSemester ?? state.currentSemester;

    if (lastBatch !== batchYear) {
      console.log('');
      lastBatch = batchYear;
    }

    for (const branchRaw of branches) {
      const normalizedBranch = normalizeBranchCode(branchRaw);

      const filtered = offerings.filter(o => {
        const nc = o.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const isOptionalDp = nc === 'IC202P' && dpOptionalBranches.has(normalizedBranch) && batchYear >= 2024;
        if (isOptionalDp) return true;
        const eligible = o.branches.includes('ALL') || o.branches.some(b => normalizeBranchCode(b) === normalizedBranch);
        if (!eligible) return false;
        if (o.eligibleSems.length > 0 && !o.eligibleSems.includes(offeringSemester)) return false;
        return true;
      });

      const mapped = filtered.map(o => {
        const nc = o.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const mappingCategory = o.course ? pickCategory(o.course.branchMappings, normalizedBranch, batchYear) : undefined;
        let resolvedCategory = mappingCategory ?? o.categoryOverride ?? 'FE';

        if (nc === 'IC202P' && dpOptionalBranches.has(normalizedBranch) && batchYear >= 2024) resolvedCategory = 'FE';
        if (nc === 'IC272' && normalizedBranch === 'BSCS') resolvedCategory = 'FE';

        const raw = o.courseCode.toUpperCase();
        if (raw.startsWith('HS-') || raw.startsWith('HS') || /^IK\d/.test(nc) || nc === 'IC181' || (nc === 'IC182' && batchYear >= 2024)) {
          resolvedCategory = 'HSS';
        }

        const isCompulsoryCategory = ['IC', 'IC_BASKET', 'DC', 'IKS'].includes(resolvedCategory);
        let branchMappingSem = null;
        if (o.course?.branchMappings) {
          const candidates = getBranchCandidates(normalizedBranch);
          const order = new Map(candidates.map((b, i) => [normalizeBranchCode(b), i]));
          const batchStr = String(batchYear);
          let best, bestScore = Infinity;
          for (const m of o.course.branchMappings) {
            const idx = order.get(normalizeBranchCode(m.branch));
            if (idx === undefined) continue;
            const batchPenalty = m.batch && m.batch !== '' ? (m.batch === batchStr ? 0 : 1000) : 0.5;
            const score = idx + batchPenalty;
            if (score < bestScore) { best = m; bestScore = score; }
          }
          branchMappingSem = best?.semester ?? null;
        }
        const effectiveCompulsorySem = branchMappingSem ?? o.compulsorySem ?? null;
        const semesterMatches = effectiveCompulsorySem == null || effectiveCompulsorySem === offeringSemester;
        const isBacklog = effectiveCompulsorySem != null && effectiveCompulsorySem < offeringSemester;
        const isCompulsory = isCompulsoryCategory && (semesterMatches || isBacklog);

        return { courseCode: o.courseCode, courseName: o.courseName, resolvedCategory, isCompulsory, effectiveCompulsorySem };
      });

      const compulsory = mapped.filter(c => c.isCompulsory);
      const de         = mapped.filter(c => !c.isCompulsory && c.resolvedCategory === 'DE');
      const hss        = mapped.filter(c => !c.isCompulsory && c.resolvedCategory === 'HSS');
      const fe         = mapped.filter(c => !c.isCompulsory && !['DE','HSS'].includes(c.resolvedCategory));

      const label = `B${String(batchYear).slice(2)} ${branchRaw}`;
      console.log(
        pad(label, 16) +
        pad(offeringSemester, 4) +
        pad(compulsory.length, COL) +
        pad(de.length, COL) +
        pad(hss.length, COL) +
        pad(fe.length, COL) +
        pad(mapped.length, COL)
      );
    }
  }

  // ── per-combo detail: compulsory list only ──────────────────────────────────
  console.log('\n\n=== COMPULSORY COURSES PER COMBO ===\n');
  for (const batchYear of batches) {
    const state = inferAcademicState(batchYear);
    const offeringSemester = state.upcomingSemester ?? state.currentSemester;
    for (const branchRaw of branches) {
      const normalizedBranch = normalizeBranchCode(branchRaw);
      const filtered = offerings.filter(o => {
        const nc = o.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const isOptionalDp = nc === 'IC202P' && dpOptionalBranches.has(normalizedBranch) && batchYear >= 2024;
        if (isOptionalDp) return true;
        const eligible = o.branches.includes('ALL') || o.branches.some(b => normalizeBranchCode(b) === normalizedBranch);
        if (!eligible) return false;
        if (o.eligibleSems.length > 0 && !o.eligibleSems.includes(offeringSemester)) return false;
        return true;
      });
      const mapped = filtered.map(o => {
        const nc = o.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const mappingCategory = o.course ? pickCategory(o.course.branchMappings, normalizedBranch, batchYear) : undefined;
        let resolvedCategory = mappingCategory ?? o.categoryOverride ?? 'FE';
        if (nc === 'IC202P' && dpOptionalBranches.has(normalizedBranch) && batchYear >= 2024) resolvedCategory = 'FE';
        if (nc === 'IC272' && normalizedBranch === 'BSCS') resolvedCategory = 'FE';
        const raw = o.courseCode.toUpperCase();
        if (raw.startsWith('HS-') || raw.startsWith('HS') || /^IK\d/.test(nc) || nc === 'IC181' || (nc === 'IC182' && batchYear >= 2024)) resolvedCategory = 'HSS';
        const isCompulsoryCategory = ['IC', 'IC_BASKET', 'DC', 'IKS'].includes(resolvedCategory);
        let branchMappingSem = null;
        if (o.course?.branchMappings) {
          const candidates = getBranchCandidates(normalizedBranch);
          const order = new Map(candidates.map((b, i) => [normalizeBranchCode(b), i]));
          const batchStr = String(batchYear);
          let best, bestScore = Infinity;
          for (const m of o.course.branchMappings) {
            const idx = order.get(normalizeBranchCode(m.branch));
            if (idx === undefined) continue;
            const batchPenalty = m.batch && m.batch !== '' ? (m.batch === batchStr ? 0 : 1000) : 0.5;
            const score = idx + batchPenalty;
            if (score < bestScore) { best = m; bestScore = score; }
          }
          branchMappingSem = best?.semester ?? null;
        }
        const effectiveCompulsorySem = branchMappingSem ?? o.compulsorySem ?? null;
        const semesterMatches = effectiveCompulsorySem == null || effectiveCompulsorySem === offeringSemester;
        const isBacklog = effectiveCompulsorySem != null && effectiveCompulsorySem < offeringSemester;
        const isCompulsory = isCompulsoryCategory && (semesterMatches || isBacklog);
        return { courseCode: o.courseCode, courseName: o.courseName, resolvedCategory, isCompulsory, effectiveCompulsorySem };
      });
      const compulsory = mapped.filter(c => c.isCompulsory).sort((a,b)=>a.courseCode.localeCompare(b.courseCode));
      const de = mapped.filter(c => !c.isCompulsory && c.resolvedCategory === 'DE').sort((a,b)=>a.courseCode.localeCompare(b.courseCode));
      console.log(`B${String(batchYear).slice(2)} ${branchRaw} sem${offeringSemester} | Compulsory: ${compulsory.map(c=>`${c.courseCode}[${c.resolvedCategory}${c.effectiveCompulsorySem?` s${c.effectiveCompulsorySem}`:''}]`).join(', ')} | DE count: ${de.length} | Total: ${mapped.length}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
