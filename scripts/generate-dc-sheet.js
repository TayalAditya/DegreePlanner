// generate-dc-sheet.js
// Creates an Excel workbook with one tab per branch showing DC courses
// Columns: Course Code | Course Name | Credits | B23 (Sem) | B24 (Sem) | B25 (Sem)
const { PrismaClient } = require("@prisma/client");
const XLSX = require("xlsx");
const path = require("path");
const prisma = new PrismaClient();

const NORM = {
  BIO: "BE", CS: "CSE", DS: "DSAI", DSE: "DSAI",
  BS: "BSCS", CH: "BSCS", MS: "MSE", VL: "MEVLSI",
  VLSI: "MEVLSI", GERAI: "GE-ROBO", GECE: "GE-COMM", GEMECH: "GE-MECH",
};

const BRANCHES = [
  "CSE", "DSAI", "EE", "ME", "CE", "EP", "BE", "MNC",
  "GE-ROBO", "GE-MECH", "GE-COMM", "GE-OPEN", "GE-FIN",
  "MSE", "BSCS", "MEVLSI",
];

// B23→sem 7, B24→sem 5, B25→sem 3 (as of pre-reg June/July 2026)
const BATCH_CURRENT_SEM = { 2023: 7, 2024: 5, 2025: 3 };

function normBranch(b) {
  const u = String(b || "").trim().toUpperCase();
  if (NORM[u]) return NORM[u];
  if (u === "BSCS B23/B24/B25") return "BSCS";
  return u;
}

async function main() {
  const mappings = await prisma.courseBranchMapping.findMany({
    where: { courseCategory: "DC" },
    include: { course: { select: { code: true, name: true, credits: true } } },
  });

  // Build per-branch data: courseCode -> { name, credits, semesters (default), batchSemesters }
  const data = {};
  for (const b of BRANCHES) data[b] = {};

  for (const m of mappings) {
    const branch = normBranch(m.branch);
    if (!BRANCHES.includes(branch)) continue;

    const key = m.course.code;
    if (!data[branch][key]) {
      data[branch][key] = {
        code: m.course.code,
        name: m.course.name,
        credits: m.course.credits,
        defaultSem: null,
        batchSem: {},
      };
    }

    if (m.semester != null) {
      if (m.batch && m.batch !== "" && m.batch !== "ALL") {
        data[branch][key].batchSem[m.batch] = m.semester;
      } else {
        data[branch][key].defaultSem = m.semester;
      }
    }
  }

  const wb = XLSX.utils.book_new();

  for (const branch of BRANCHES) {
    const courses = Object.values(data[branch]);
    if (courses.length === 0) continue;

    // Sort by earliest semester, then course code
    courses.sort((a, b) => {
      const semA = a.defaultSem || Math.min(...Object.values(a.batchSem), 99);
      const semB = b.defaultSem || Math.min(...Object.values(b.batchSem), 99);
      if (semA !== semB) return semA - semB;
      return a.code.localeCompare(b.code);
    });

    // Build rows
    const rows = [];
    // Header
    rows.push(["Course Code", "Course Name", "Credits", "B23 (Sem)", "B24 (Sem)", "B25 (Sem)"]);

    for (const c of courses) {
      const getSem = (batchYear) => {
        // batch-specific override first, then default
        if (c.batchSem[String(batchYear)] != null) return c.batchSem[String(batchYear)];
        if (c.defaultSem != null) return c.defaultSem;
        return "-";
      };

      rows.push([
        c.code,
        c.name,
        c.credits,
        getSem(2023),
        getSem(2024),
        getSem(2025),
      ]);
    }

    // Add totals row
    const totalCredits = courses.reduce((s, c) => s + c.credits, 0);
    rows.push([]);
    rows.push(["", "Total DC Credits", totalCredits, "", "", ""]);

    // Per-batch semester credit breakdown
    rows.push([]);
    rows.push(["", "", "", "B23 Credits", "B24 Credits", "B25 Credits"]);

    // Collect semesters 1-8
    for (let sem = 1; sem <= 8; sem++) {
      let b23cr = 0, b24cr = 0, b25cr = 0;
      for (const c of courses) {
        const s23 = c.batchSem["2023"] ?? c.defaultSem;
        const s24 = c.batchSem["2024"] ?? c.defaultSem;
        const s25 = c.batchSem["2025"] ?? c.defaultSem;
        if (s23 === sem) b23cr += c.credits;
        if (s24 === sem) b24cr += c.credits;
        if (s25 === sem) b25cr += c.credits;
      }
      if (b23cr || b24cr || b25cr) {
        rows.push(["", `Sem ${sem}`, "", b23cr || "-", b24cr || "-", b25cr || "-"]);
      }
    }

    // Unassigned
    let b23un = 0, b24un = 0, b25un = 0;
    for (const c of courses) {
      const s23 = c.batchSem["2023"] ?? c.defaultSem;
      const s24 = c.batchSem["2024"] ?? c.defaultSem;
      const s25 = c.batchSem["2025"] ?? c.defaultSem;
      if (s23 == null) b23un += c.credits;
      if (s24 == null) b24un += c.credits;
      if (s25 == null) b25un += c.credits;
    }
    if (b23un || b24un || b25un) {
      rows.push(["", "Unassigned", "", b23un || "-", b24un || "-", b25un || "-"]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    ws["!cols"] = [
      { wch: 14 },  // Course Code
      { wch: 50 },  // Course Name
      { wch: 8 },   // Credits
      { wch: 12 },  // B23
      { wch: 12 },  // B24
      { wch: 12 },  // B25
    ];

    // Sheet name max 31 chars
    const sheetName = branch.length > 31 ? branch.slice(0, 31) : branch;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const outPath = path.join(__dirname, "..", "DC_Courses_All_Branches.xlsx");
  XLSX.writeFile(wb, outPath);
  console.log("Written to:", outPath);
  console.log("Sheets:", wb.SheetNames.join(", "));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
