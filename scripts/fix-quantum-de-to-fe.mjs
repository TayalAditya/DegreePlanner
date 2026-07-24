/**
 * Quantum (QT-/QS-) courses rule:
 *   - EP branch  → DE (discipline elective for Engineering Physics)
 *   - all other branches → FE (free elective)
 * This flips any non-EP DE mapping to FE. Runs as dry-run unless APPLY=1.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.env.APPLY === "1";

const courses = await prisma.course.findMany({
  where: { OR: [{ code: { startsWith: "QT-" } }, { code: { startsWith: "QS-" } }] },
  select: { id: true, code: true },
});

let toFix = 0;
for (const c of courses) {
  const maps = await prisma.courseBranchMapping.findMany({
    where: { courseId: c.id, branch: { not: "EP" }, courseCategory: "DE" },
    select: { id: true, branch: true, batch: true },
  });
  for (const m of maps) {
    console.log(`${APPLY ? "FIX " : "WOULD FIX "}${c.code}  ${m.branch}${m.batch ? "/" + m.batch : ""}  DE → FE`);
    toFix++;
    if (APPLY) {
      await prisma.courseBranchMapping.update({
        where: { id: m.id },
        data: { courseCategory: "FE" },
      });
    }
  }
}

console.log(`\n${APPLY ? "Applied" : "Dry-run"} — ${toFix} mapping(s) ${APPLY ? "changed" : "to change"}.`);
if (!APPLY) console.log("Re-run with APPLY=1 to persist.");
await prisma.$disconnect();
