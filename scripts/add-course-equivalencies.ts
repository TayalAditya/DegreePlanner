/**
 * Add course equivalencies:
 *   MA-313 ↔ CS-304  (Formal Languages & Automata Theory)
 *   MA-312 ↔ CS-212  (Design of Algorithms / Design & Analysis of Algorithms)
 *
 * B23 CSE students did CS-304 and CS-212.
 * B24 onwards MNC students get MA-313 and MA-312.
 * These are equivalent — pre-reg should treat either as done.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PAIRS: [string, string][] = [
  ["MA-313", "CS-304"],
  ["MA-312", "CS-212"],
];

async function main() {
  let created = 0;

  for (const [codeA, codeB] of PAIRS) {
    const courseA = await prisma.course.findFirst({ where: { code: codeA } });
    const courseB = await prisma.course.findFirst({ where: { code: codeB } });

    if (!courseA) {
      console.log(`  SKIP  ${codeA} — course not found in DB`);
      continue;
    }
    if (!courseB) {
      console.log(`  SKIP  ${codeB} — course not found in DB`);
      continue;
    }

    // Bidirectional: A→B and B→A
    for (const [aId, bId, label] of [
      [courseA.id, courseB.id, `${codeA} → ${codeB}`],
      [courseB.id, courseA.id, `${codeB} → ${codeA}`],
    ] as [string, string, string][]) {
      const exists = await prisma.courseEquivalent.findFirst({
        where: { courseId: aId, equivalentId: bId },
      });
      if (!exists) {
        await prisma.courseEquivalent.create({
          data: { courseId: aId, equivalentId: bId },
        });
        console.log(`  CREATED  ${label}`);
        created++;
      } else {
        console.log(`  OK       ${label} already exists`);
      }
    }
  }

  console.log(`\nDone. Created ${created} new equivalency record(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
