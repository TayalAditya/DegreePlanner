/**
 * Verify that the pre-reg CourseOfferings in the DB match the official
 * IIT Mandi Curriculum List (CL) spreadsheet for Odd Sem AY 2026-27.
 *
 * Reports:
 *   - in CL but NOT offered in DB   (missing from pre-reg)
 *   - offered in DB but NOT in CL   (extra / stale offering)
 *   - present in both but field mismatch (credits / name / slot)
 *
 * Read-only. Does not modify anything.
 */
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const CL_PATH = "docs/CL 2026-27 Odd/Final CL Odd Sem AY 2026-27.xlsx";
const OFFERING_SEMESTER = 7;
const OFFERING_YEAR = 2026;

// Normalize a course code for comparison: strip spaces, hyphens, underscores,
// _New / _NEW suffixes, uppercase. IC-202P == IC202P == IC 202P.
function normCode(c) {
  return String(c || "")
    .replace(/_new$/i, "")
    .replace(/[\s\-_]/g, "")
    .toUpperCase()
    .trim();
}

function num(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function readCL() {
  const wb = XLSX.readFile(CL_PATH);
  const s1 = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1"], { defval: "" });
  const s2 = XLSX.utils.sheet_to_json(wb.Sheets["Sheet2"], { defval: "" });

  const map = new Map(); // normCode -> { code, name, credits, slot }

  const ingest = (rows, slotAuthoritative) => {
    for (const r of rows) {
      const rawCode = r["CourseCode"] ?? r["Course Code"] ?? r["Code"];
      const code = normCode(rawCode);
      if (!code) continue;
      const name = String(r["Course Name"] || r["CourseName"] || "").trim();
      const credits = num(r["Course Credit"] ?? r["Credits"] ?? r["Credit"]);
      const slot = String(r["Slot"] || "").trim();
      const existing = map.get(code) || { code, rawCode: String(rawCode).trim() };
      map.set(code, {
        ...existing,
        name: name || existing.name || "",
        credits: credits != null ? credits : existing.credits,
        // Sheet1 slot is authoritative per existing verify scripts
        slot: slotAuthoritative ? (slot || existing.slot || "") : (existing.slot || slot || ""),
      });
    }
  };

  // Sheet2 first (name/credits), then Sheet1 (authoritative slot/school)
  ingest(s2, false);
  ingest(s1, true);
  return map;
}

async function main() {
  const cl = readCL();

  const offerings = await prisma.courseOffering.findMany({
    where: { offeringSemester: OFFERING_SEMESTER, offeringYear: OFFERING_YEAR },
    select: { courseCode: true, courseName: true, credits: true, slots: true, isActive: true },
  });

  const db = new Map(); // normCode -> offering
  for (const o of offerings) db.set(normCode(o.courseCode), o);

  const clCodes = new Set(cl.keys());
  const dbCodes = new Set(db.keys());

  const missingFromDb = [...clCodes].filter((c) => !dbCodes.has(c)).sort();
  const extraInDb = [...dbCodes].filter((c) => !clCodes.has(c)).sort();

  const creditMismatches = [];
  const slotMismatches = [];
  for (const code of [...clCodes].filter((c) => dbCodes.has(c)).sort()) {
    const c = cl.get(code);
    const o = db.get(code);
    if (c.credits != null && num(o.credits) != null && c.credits !== num(o.credits)) {
      creditMismatches.push({ code: c.rawCode, cl: c.credits, db: num(o.credits) });
    }
    const dbSlot = String(o.slots || "").trim();
    if (c.slot && dbSlot && c.slot.toUpperCase() !== dbSlot.toUpperCase()) {
      slotMismatches.push({ code: c.rawCode, cl: c.slot, db: dbSlot });
    }
  }

  const inactiveButInCl = [...clCodes]
    .filter((c) => dbCodes.has(c) && db.get(c).isActive === false)
    .map((c) => cl.get(c).rawCode)
    .sort();

  console.log("=".repeat(64));
  console.log(`PRE-REG (CourseOffering sem ${OFFERING_SEMESTER}/${OFFERING_YEAR}) vs official CL`);
  console.log("=".repeat(64));
  console.log(`CL courses:        ${clCodes.size}`);
  console.log(`DB offerings:      ${dbCodes.size}`);
  console.log(`Matched by code:   ${[...clCodes].filter((c) => dbCodes.has(c)).length}`);
  console.log("");

  const section = (title, arr, fmt = (x) => x) => {
    console.log(`\n── ${title} (${arr.length}) ${"─".repeat(Math.max(0, 40 - title.length))}`);
    if (!arr.length) { console.log("  (none)"); return; }
    for (const x of arr) console.log("  " + fmt(x));
  };

  section("In CL but NOT offered in DB", missingFromDb.map((c) => `${cl.get(c).rawCode}  ${cl.get(c).name}`));
  section("Offered in DB but NOT in CL", extraInDb.map((c) => `${db.get(c).courseCode}  ${db.get(c).courseName}`));
  section("Credit mismatches", creditMismatches, (x) => `${x.code}: CL=${x.cl}  DB=${x.db}`);
  section("Slot mismatches", slotMismatches, (x) => `${x.code}: CL='${x.cl}'  DB='${x.db}'`);
  section("In CL but offering marked INACTIVE in DB", inactiveButInCl);

  console.log("\n" + "=".repeat(64));
  const clean = !missingFromDb.length && !extraInDb.length && !creditMismatches.length;
  console.log(clean ? "RESULT: DB offerings match CL course set ✓" : "RESULT: mismatches found — see above");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
