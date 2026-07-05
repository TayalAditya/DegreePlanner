/**
 * Backfill missing detail on pre-reg CourseOfferings (sem 7 / 2026):
 *   1. ltpc  — copied from the linked Course row, but ONLY when the ltpc's
 *              credit component (last number) matches the offering credits.
 *              Skips stale ltpc strings that would contradict credits.
 *   2. instructor / instructorEmail / slots — from the official CL xlsx, for
 *              offerings that currently have none.
 *
 * Slots equal to NS / "not required" are treated as "no slot" (project /
 * practicum courses) and left null, matching the seed's normalizeSlot.
 *
 * Run:  npx tsx scripts/backfill-prereg-details.ts          (dry run)
 *       npx tsx scripts/backfill-prereg-details.ts --apply  (write)
 */
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const OFFERING_SEMESTER = 7;
const OFFERING_YEAR = 2026;
const CL_PATH = "docs/CL 2026-27 Odd/Final CL Odd Sem AY 2026-27.xlsx";

function normCode(c: string): string {
  return String(c || "").replace(/_new$/i, "").replace(/[\s\-_]/g, "").toUpperCase().trim();
}

// last numeric component of an L-T-P-C string, e.g. "3-0-2-4" -> 4
function ltpcCredits(ltpc: string | null): number | null {
  if (!ltpc) return null;
  const parts = String(ltpc).split(/[-\s]+/).map((x) => parseFloat(x)).filter((x) => !isNaN(x));
  return parts.length ? parts[parts.length - 1] : null;
}

function normalizeSlot(raw: string): string | null {
  const s = String(raw || "").trim();
  if (!s || /not required|^ns$/i.test(s)) return null;
  if (/free slot/i.test(s)) return "Free Slot";
  return s;
}

function readClInstructors() {
  const wb = XLSX.readFile(CL_PATH);
  const s1 = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets["Sheet1"], { defval: "" });
  const map = new Map<string, { instructor: string; email: string; slot: string | null }>();
  for (const r of s1) {
    const code = normCode(r["CourseCode"]);
    if (!code || map.has(code)) continue;
    const instructor = String(r["Employee Name"] || "").trim();
    const email = String(r["Employee email id"] || "").trim();
    const slot = normalizeSlot(String(r["Slot"] || ""));
    map.set(code, { instructor, email, slot });
  }
  return map;
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);
  const cl = readClInstructors();

  const offs = await prisma.courseOffering.findMany({
    where: { offeringSemester: OFFERING_SEMESTER, offeringYear: OFFERING_YEAR },
    select: {
      id: true, courseCode: true, ltpc: true, credits: true,
      instructor: true, instructorEmail: true, slots: true,
      course: { select: { ltpc: true } },
    },
  });

  let ltpcFilled = 0, ltpcSkipped = 0, instrFilled = 0, slotFilled = 0;

  for (const o of offs) {
    const data: Record<string, any> = {};

    // 1. ltpc from Course — only if it doesn't contradict credits
    if ((!o.ltpc || !o.ltpc.trim()) && o.course?.ltpc) {
      const c = ltpcCredits(o.course.ltpc);
      if (c == null || Math.abs(c - o.credits) < 0.01) {
        data.ltpc = o.course.ltpc;
        ltpcFilled++;
      } else {
        ltpcSkipped++;
        console.log(`  ltpc SKIP  ${o.courseCode.padEnd(9)} course.ltpc=${o.course.ltpc} (C=${c}) != credits=${o.credits}`);
      }
    }

    // 2. instructor / email / slot from CL
    const clRow = cl.get(normCode(o.courseCode));
    if (clRow) {
      if ((!o.instructor || !o.instructor.trim()) && clRow.instructor) {
        data.instructor = clRow.instructor;
        if (clRow.email) data.instructorEmail = clRow.email;
        instrFilled++;
      }
      if ((!o.slots || !o.slots.trim()) && clRow.slot) {
        data.slots = clRow.slot;
        slotFilled++;
      }
    }

    if (Object.keys(data).length > 0) {
      const changes = Object.entries(data).map(([k, v]) => `${k}=${v}`).join("  ");
      console.log(`  FILL ${o.courseCode.padEnd(9)} ${changes}`);
      if (APPLY) {
        await prisma.courseOffering.update({ where: { id: o.id }, data });
      }
    }
  }

  console.log("\n── Summary ─────────────────────────");
  console.log(`ltpc filled:      ${ltpcFilled}`);
  console.log(`ltpc skipped:     ${ltpcSkipped} (stale — contradicts credits)`);
  console.log(`instructor filled:${instrFilled}`);
  console.log(`slot filled:      ${slotFilled}`);
  console.log(`\n${APPLY ? "Done — written." : "Dry run. Re-run with --apply to write."}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
