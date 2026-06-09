/**
 * Fix ltpc values in CourseOffering:
 *   "X | L-T-P-C"  →  "L-T-P-C"   (extract proper part)
 *   "3", "4" etc.  →  null         (plain numbers are credits, not LTPC)
 *   "L-T-P-C"      →  unchanged    (already correct)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const offerings = await prisma.courseOffering.findMany({
    select: { id: true, courseCode: true, ltpc: true },
  });

  let fixed = 0;
  let cleared = 0;
  let kept = 0;

  for (const o of offerings) {
    const raw = o.ltpc?.trim() ?? "";

    // Already proper L-T-P-C format like "3-1-0-4"
    if (/^\d+-\d+-\d+-\d+$/.test(raw)) {
      kept++;
      continue;
    }

    // "X | L-T-P-C" format → extract the L-T-P-C part
    const pipeMatch = raw.match(/\|\s*(\d+-\d+-\d+-\d+)/);
    if (pipeMatch) {
      await prisma.courseOffering.update({
        where: { id: o.id },
        data: { ltpc: pipeMatch[1] },
      });
      console.log(`FIXED  ${o.courseCode}: "${raw}" → "${pipeMatch[1]}"`);
      fixed++;
      continue;
    }

    // Plain number or anything else without proper L-T-P-C → null
    if (raw !== "") {
      await prisma.courseOffering.update({
        where: { id: o.id },
        data: { ltpc: null },
      });
      console.log(`CLEAR  ${o.courseCode}: "${raw}" → null`);
      cleared++;
    }
  }

  console.log(`\nDone. Fixed: ${fixed} | Cleared: ${cleared} | Already correct: ${kept}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
