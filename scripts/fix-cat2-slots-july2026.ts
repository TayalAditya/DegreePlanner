import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
const prisma = new PrismaClient();

const SEM = 7, YEAR = 2026;

// Slot fixes (Samarth = source of truth). null => NO SLOT (store null).
// Free-slot numbers preserved. instructor: only set when Samarth has a better value.
type Fix = { code: string; slot: string | null; instructor?: string; instructorEmail?: string };

const FIXES: Fix[] = [
  // ── IC (compulsory) ──
  { code: "IC-152", slot: "E" },
  { code: "IC-182", slot: "F" },
  { code: "IC-140", slot: "B" },
  { code: "IC-230", slot: "A" },
  { code: "IC-202P", slot: null },            // NO SLOT
  { code: "IC-131", slot: "A" },              // was "Basket 1" placeholder
  { code: "IC-112", slot: "C" },              // was "Shared in IC Timetable"
  { code: "IC-114", slot: "D" },              // was "Shared in IC Timetable"
  // ── BE ──
  { code: "BE-201", slot: "G" },
  { code: "BE-306", slot: "E" },
  { code: "BE-308", slot: "F" },
  // ── HSS ──
  { code: "HS-112", slot: "G" },              // keep instructor "Chair SHSS, TBD"
  { code: "HS-342", slot: "G" },
  { code: "HS-344", slot: "H" },
  { code: "HS-213", slot: null },             // keep instructor "Chair SHSS, TBD"
  { code: "HS-310", slot: null },             // keep instructor "Chair SHSS, TBD"
  { code: "HS-600", slot: null },             // NO SLOT (was Free Slot)
  { code: "HS-608", slot: "FS1", instructor: "Chair SHSS" },
  // ── Free-slot number preservation (FS1/FS2/FS3 = recognized as flexible by isFlexibleSlot) ──
  { code: "GE-502", slot: "FS1" },
  { code: "ME-511", slot: "FS2" },
  { code: "MA-571", slot: "FS3" },
  // ── AR ──
  { code: "AR-521", slot: null },             // NO SLOT (was C)
];

// EE-594: not in DB → create as a new DE offering
const NEW_OFFERING = {
  code: "EE-594",
  name: "Modelling of Dynamical Systems and Identification",
  slot: "D",
  instructor: "Bijnan Bandyopadhyay",
  credits: 3,
  ltpc: "3-0-0-3",
  branch: "EE",
};

async function main() {
  let updated = 0;
  for (const f of FIXES) {
    const res = await prisma.courseOffering.updateMany({
      where: { offeringSemester: SEM, offeringYear: YEAR, courseCode: f.code },
      data: {
        slots: f.slot,
        ...(f.instructor ? { instructor: f.instructor } : {}),
        ...(f.instructorEmail ? { instructorEmail: f.instructorEmail } : {}),
      },
    });
    if (res.count === 0) console.log(`  ⚠️  ${f.code}: no offering matched!`);
    else { updated += res.count; console.log(`  ✓ ${f.code.padEnd(9)} slot -> ${f.slot ?? "NO SLOT"}${f.instructor ? `  | instr -> ${f.instructor}` : ""}`); }
  }
  console.log(`\nUpdated ${updated} offerings.`);

  // ── EE-594 create ──
  const exists = await prisma.courseOffering.findFirst({
    where: { offeringSemester: SEM, offeringYear: YEAR, courseCode: NEW_OFFERING.code },
    select: { id: true },
  });
  if (exists) {
    console.log(`\nEE-594 already exists (${exists.id}) — skipping create.`);
  } else {
    const course = await prisma.course.findFirst({ where: { code: NEW_OFFERING.code }, select: { id: true } });
    const created = await prisma.courseOffering.create({
      data: {
        id: randomUUID(),
        courseCode: NEW_OFFERING.code,
        courseId: course?.id ?? null,
        courseName: NEW_OFFERING.name,
        instructor: NEW_OFFERING.instructor,
        slots: NEW_OFFERING.slot,
        ltpc: NEW_OFFERING.ltpc,
        credits: NEW_OFFERING.credits,
        branches: [NEW_OFFERING.branch],
        eligibleSems: [5, 7],
        compulsorySem: null,
        offeringSemester: SEM,
        offeringYear: YEAR,
        isActive: true,
      },
    });
    console.log(`\n✓ Created EE-594 offering (${created.id})${course ? "" : "  ⚠️ no matching Course row (courseId=null)"}`);
  }
  console.log("\n✓ Done!");
}
main().catch(e=>{console.error(e);process.exit(1);}).finally(()=>prisma.$disconnect());
