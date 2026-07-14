/**
 * Add bidirectional course equivalencies from the DC IIT Mandi PDF.
 * Courses listed as "XX-YYY / XX-ZZZ" in the PDF are equivalent —
 * if a student completed one, the other should be treated as done.
 *
 * Pairs where one course doesn't exist in DB yet are skipped automatically.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PAIRS: [string, string][] = [
  // MNC: MA ↔ CS
  ["MA-313", "CS-304"],   // Formal Languages & Automata Theory
  ["MA-312", "CS-212"],   // Design of Algorithms
  // MNC: CS-214 / CS-201 (Computer Organisation)
  ["CS-214", "CS-201"],
  // EE: EE-212 / EE-210 (Digital System Design) — already exists but idempotent
  ["EE-212", "EE-210"],
  // EE: EE-205 / EE-202 (Electromagnetics & Wave Propagation)
  ["EE-205", "EE-202"],
  // EE: EE-316 / EE-304 (Communication Systems) — already exists
  ["EE-316", "EE-304"],
  // CE: CE-301 / CE-310 (Strength of Materials and Structures)
  ["CE-301", "CE-310"],
  // CE: CE-301P / CE-310P (Strength of Materials Lab)
  ["CE-301P", "CE-310P"],
  // CE: CE-302 / CE-311 (Geotechnical Engineering)
  ["CE-302", "CE-311"],
  // CE: CE-302P / CE-311P (Geotechnical Engineering Lab)
  ["CE-302P", "CE-311P"],
  // CE: CE-203P / CE-354P (Building/Construction Materials Lab)
  ["CE-203P", "CE-354P"],
  // ME: ME-308 / ME-215 (Manufacturing Engineering 1)
  ["ME-308", "ME-215"],
  // VLSI: EE-311 / VL-201 (Device Electronics / Semiconductor Device for ICs)
  ["EE-311", "VL-201"],
  // CS/DSAI: CS-669 / DS-413 (Pattern Recognition ≡ Introduction to Statistical Learning)
  ["CS-669", "DS-413"],
  // CS: CS-515 / CS-213 (Advanced Computer Science Practicum ≡ Reverse Engineering)
  ["CS-515", "CS-213"],
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
