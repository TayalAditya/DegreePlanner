// One-shot end-of-Spring-2026 transition.
//
// For every user with a known batch year, mark every IN_PROGRESS enrollment with
// semester ≤ their current Spring semester as COMPLETED ("pass" the courses they
// were enrolled in this term). Future-sem IN_PROGRESS rows (pre-registrations
// for Fall) are left alone.
//
// Current Spring sem = clamp(1..8, (2026 - batchYear) * 2)
//   B22 → 8  (caps, stays 8 after Aug per min(8, current+1))
//   B23 → 6  (→ 7 in Fall)
//   B24 → 4  (→ 5 in Fall)
//   B25 → 2  (→ 3 in Fall)
// The displayed "current semester" auto-advances when academicCalendar enters
// PRE_REGISTRATION (Jun 15) / FALL (Aug) — no code change needed for that.

import { PrismaClient, EnrollmentStatus } from "@prisma/client";
import { inferBatchYear } from "@/lib/academicCalendar";

const prisma = new PrismaClient();

const NOW = new Date();

const clampSem = (s: number) => Math.min(8, Math.max(1, Math.trunc(s)));

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, enrollmentId: true, batch: true, branch: true, name: true },
  });

  console.log(`Processing ${users.length} users (now = ${NOW.toISOString()})...`);

  const stats: Record<
    string,
    { users: number; updated: number; springSem: number }
  > = {};
  let totalUpdated = 0;
  let skippedNoBatch = 0;

  for (const u of users) {
    const batchYear = inferBatchYear(u.batch, u.enrollmentId);
    if (!batchYear) {
      skippedNoBatch++;
      continue;
    }

    const yearsElapsed = NOW.getFullYear() - batchYear;
    const currentSpringSem = clampSem(yearsElapsed * 2);

    const result = await prisma.courseEnrollment.updateMany({
      where: {
        userId: u.id,
        status: EnrollmentStatus.IN_PROGRESS,
        semester: { lte: currentSpringSem },
      },
      data: { status: EnrollmentStatus.COMPLETED },
    });

    const key = `B${String(batchYear).slice(-2)}`;
    if (!stats[key]) stats[key] = { users: 0, updated: 0, springSem: currentSpringSem };
    stats[key].users++;
    stats[key].updated += result.count;
    totalUpdated += result.count;
  }

  console.log("\nPer-batch breakdown:");
  for (const k of Object.keys(stats).sort()) {
    const s = stats[k];
    const nextSem = Math.min(8, s.springSem + 1);
    console.log(
      `  ${k}: ${s.users.toString().padStart(3)} users | sem ${s.springSem} → ${nextSem} (next) | ${s.updated} enrollments COMPLETED`
    );
  }
  console.log(`\nTotal IN_PROGRESS → COMPLETED: ${totalUpdated}`);
  if (skippedNoBatch > 0) {
    console.log(`Skipped (no batch info): ${skippedNoBatch}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
