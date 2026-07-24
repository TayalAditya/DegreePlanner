/**
 * Add IK-591_E26 "Sanskrit Grammar" to the Course catalog.
 * 1-credit (L-T-P-C 1-0-0-1) even-semester course. Because its code matches
 * /^IK\d/ after normalization (IK-591_E26 → IK591E26), the credit calculator
 * automatically counts it toward the combined HSS+IKS basket (see
 * lib/creditCalculator.ts isIkCourse) — no calc change needed.
 *
 * Note: IK-591 already exists as "Selected topics on Vedic Thoughts and Cultural
 * Behaviour", so this uses IK-591_E26 (E=Even sem, 26=AY 2026) to avoid collision.
 *
 * Run:  npx tsx scripts/add-ik591-sanskrit-grammar.ts          (dry run)
 *       npx tsx scripts/add-ik591-sanskrit-grammar.ts --apply  (write)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const COURSE = {
  code: "IK-591_E26",
  name: "Sanskrit Grammar",
  credits: 1,
  department: "IK",
  level: 500,
  ltpc: "1-0-0-1",
  isPassFailEligible: false,
} as const;

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  const existing = await prisma.course.findFirst({ where: { code: COURSE.code } });
  if (existing) {
    console.log(`SKIP  ${COURSE.code} already in catalog`);
    console.log("\nNothing to do.");
    return;
  }

  console.log(
    `ADD   ${COURSE.code.padEnd(9)} ${COURSE.name}  ` +
      `[${COURSE.credits}cr, ${COURSE.department}, L${COURSE.level}, LTPC ${COURSE.ltpc}, even sem]`
  );

  if (APPLY) {
    await prisma.course.create({
      data: {
        code: COURSE.code,
        name: COURSE.name,
        credits: COURSE.credits,
        department: COURSE.department,
        level: COURSE.level,
        ltpc: COURSE.ltpc,
        isPassFailEligible: COURSE.isPassFailEligible,
        offeredInSpring: true, // even semester = spring
        isActive: true,
      },
    });
  }

  console.log(`\n${APPLY ? "Done — written." : "Dry run. Re-run with --apply to write."}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
