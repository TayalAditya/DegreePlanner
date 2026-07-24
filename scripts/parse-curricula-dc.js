// parse-curricula-dc.js
// Parses all curricula .tex files to extract DC courses with semester assignments
// Then compares with DB and generates the corrected Excel sheet

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const XLSX = require("xlsx");
const prisma = new PrismaClient();

const BASE = path.join(__dirname, "..", "docs", "curricula");

// Map tex filenames to canonical branch codes
function branchFromFilename(filename) {
  const name = path.basename(filename, ".tex"); // e.g. "CSE_B25", "GE-ROBO_B24"
  const branch = name.replace(/_B\d\d$/, "");
  // Normalize underscored GE variants
  if (branch === "GE_ROBO") return "GE-ROBO";
  if (branch === "GE_MECH") return "GE-MECH";
  if (branch === "GE_COMM") return "GE-COMM";
  if (branch === "GE_OPEN") return "GE-OPEN";
  if (branch === "GE_FIN") return "GE-FIN";
  return branch;
}

function batchFromFilename(filename) {
  const m = path.basename(filename, ".tex").match(/_B(\d\d)$/);
  return m ? 2000 + parseInt(m[1]) : null;
}

// Normalize a course code: remove extra dashes/spaces, ensure single hyphen
function normCode(raw) {
  return raw
    .replace(/\s+/g, "")
    .replace(/-+/g, "-") // collapse double dashes
    .replace(/^([A-Z]{2,4})(\d)/, "$1-$2"); // ensure hyphen: CS208 -> CS-208
}

// Parse a .tex file to extract:
// 1. DC course list from "Discipline Core Courses" section
// 2. Semester-wise distribution (which DC courses in which semester)
function parseTex(filepath) {
  const content = fs.readFileSync(filepath, "utf-8");

  // Extract DC course list
  const dcCourses = [];
  const dcSectionMatch = content.match(
    /Discipline Core Courses.*?\n([\s\S]*?)\\end\{tabular\}/
  );
  if (dcSectionMatch) {
    // Match rows like: CS208 & Mathematical Foundations... & 4
    const rowRe =
      /([A-Z]{2,4}[-\s]*\d{3,4}P?)\s*&\s*([^&]+?)\s*&\s*(\d+)\s*\\\\/g;
    let m;
    while ((m = rowRe.exec(dcSectionMatch[1]))) {
      dcCourses.push({
        code: normCode(m[1]),
        name: m[2].trim().replace(/\\textit\{[^}]*\}/g, "").trim(),
        credits: parseInt(m[3]),
      });
    }
  }

  // Extract semester-wise distribution
  const semesterCourses = {}; // { semNum: [{ code, name, credits }] }

  // Find each semester section
  const semRe =
    /(\d+)\s*\\textsuperscript\{(?:st|nd|rd|th)\}\s*Semester\}([\s\S]*?)\\textit\{Total Credits/g;
  let sm;
  while ((sm = semRe.exec(content))) {
    const semNum = parseInt(sm[1]);
    const semContent = sm[2];
    semesterCourses[semNum] = [];

    // Match course rows — LTPC columns can be numbers, dashes, or ---
    const courseRe =
      /\d+\s*&\s*([A-Z]{2,4}[-\s]*\d{2,4}P?)\s*&\s*([^&]+?)\s*&\s*[-\d.]+\s*&\s*[-\d.]+\s*&\s*[-\d.]+\s*&\s*(\d+)/g;
    let cm;
    while ((cm = courseRe.exec(semContent))) {
      semesterCourses[semNum].push({
        code: normCode(cm[1]),
        name: cm[2].trim(),
        credits: parseInt(cm[3]),
      });
    }
  }

  // Map DC courses to their semesters using normalized code comparison
  const dcWithSem = [];

  for (const dc of dcCourses) {
    let foundSem = null;
    for (const [sem, courses] of Object.entries(semesterCourses)) {
      if (courses.some((c) => c.code === dc.code)) {
        foundSem = parseInt(sem);
        break;
      }
    }
    dcWithSem.push({ ...dc, semester: foundSem });
  }

  return { dcCourses: dcWithSem, semesterCourses };
}

async function main() {
  const batches = ["B23", "B24", "B25"];
  const allData = {}; // { branch: { batch: [{ code, name, credits, semester }] } }

  for (const batch of batches) {
    const texDir = path.join(BASE, batch, "tex");
    if (!fs.existsSync(texDir)) {
      console.log("No tex dir for", batch);
      continue;
    }

    const files = fs.readdirSync(texDir).filter((f) => {
      if (!f.endsWith(".tex")) return false;
      // Skip duplicate underscore GE files if hyphenated version exists
      if (/^GE_/.test(f)) return false;
      return true;
    });
    for (const file of files) {
      const branch = branchFromFilename(file);
      const batchYear = batchFromFilename(file);
      const filepath = path.join(texDir, file);

      try {
        const parsed = parseTex(filepath);
        if (!allData[branch]) allData[branch] = {};
        allData[branch][batchYear] = parsed.dcCourses;

        // Summary
        const total = parsed.dcCourses.reduce((s, c) => s + c.credits, 0);
        const assigned = parsed.dcCourses.filter((c) => c.semester != null);
        console.log(
          `${branch} B${String(batchYear).slice(2)}: ${parsed.dcCourses.length} DC courses (${total}cr), ${assigned.length} with semester`
        );
        for (const dc of parsed.dcCourses) {
          console.log(
            `    ${dc.code} (${dc.credits}cr) sem=${dc.semester ?? "?"}`
          );
        }
      } catch (e) {
        console.error(`Error parsing ${filepath}: ${e.message}`);
      }
    }
  }

  // Now generate the Excel sheet
  const BRANCHES = [
    "CSE",
    "DSAI",
    "DSE",
    "EE",
    "ME",
    "CE",
    "EP",
    "BE",
    "MNC",
    "GE-ROBO",
    "GE-MECH",
    "GE-COMM",
    "GE-OPEN",
    "GE-FIN",
    "MSE",
    "BSCS",
    "MEVLSI",
  ];

  const wb = XLSX.utils.book_new();

  for (const branch of BRANCHES) {
    const bd = allData[branch];
    if (!bd) {
      console.log("No curriculum data for", branch);
      continue;
    }

    // Collect all unique courses across B23/B24/B25
    const allCourses = new Map(); // code -> { name, credits }
    for (const batch of [2023, 2024, 2025]) {
      const courses = bd[batch] || [];
      for (const c of courses) {
        if (!allCourses.has(c.code)) {
          allCourses.set(c.code, { name: c.name, credits: c.credits });
        }
      }
    }

    // Build semester lookup per batch
    const getSem = (code, batchYear) => {
      const courses = bd[batchYear] || [];
      const found = courses.find((c) => c.code === code);
      if (!found) return "N/A"; // not in this batch's curriculum
      return found.semester ?? "?";
    };

    // Sort by earliest known semester
    const courseList = [...allCourses.entries()].map(([code, info]) => {
      const sems = [2023, 2024, 2025]
        .map((b) => getSem(code, b))
        .filter((s) => typeof s === "number");
      const minSem = sems.length ? Math.min(...sems) : 99;
      return { code, ...info, minSem };
    });
    courseList.sort(
      (a, b) => a.minSem - b.minSem || a.code.localeCompare(b.code)
    );

    // Build rows
    const rows = [];
    rows.push([
      "Course Code",
      "Course Name",
      "Credits",
      "B23 (Sem)",
      "B24 (Sem)",
      "B25 (Sem)",
    ]);

    for (const c of courseList) {
      rows.push([
        c.code,
        c.name,
        c.credits,
        getSem(c.code, 2023),
        getSem(c.code, 2024),
        getSem(c.code, 2025),
      ]);
    }

    // Totals
    const totalByBatch = (batchYear) => {
      const courses = bd[batchYear] || [];
      return courses.reduce((s, c) => s + c.credits, 0);
    };
    rows.push([]);
    rows.push([
      "",
      "Total DC Credits",
      "",
      totalByBatch(2023) || "N/A",
      totalByBatch(2024) || "N/A",
      totalByBatch(2025) || "N/A",
    ]);

    // Per-semester breakdown
    rows.push([]);
    rows.push(["", "", "", "B23 Credits", "B24 Credits", "B25 Credits"]);
    for (let sem = 1; sem <= 8; sem++) {
      const semCr = (batchYear) => {
        const courses = bd[batchYear] || [];
        return courses
          .filter((c) => c.semester === sem)
          .reduce((s, c) => s + c.credits, 0);
      };
      const b23 = semCr(2023);
      const b24 = semCr(2024);
      const b25 = semCr(2025);
      if (b23 || b24 || b25) {
        rows.push([
          "",
          `Sem ${sem}`,
          "",
          b23 || "-",
          b24 || "-",
          b25 || "-",
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 14 },
      { wch: 55 },
      { wch: 8 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
    ];

    const sheetName = branch.length > 31 ? branch.slice(0, 31) : branch;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const outPath = path.join(
    __dirname,
    "..",
    "DC_Courses_All_Branches.xlsx"
  );
  XLSX.writeFile(wb, outPath);
  console.log("\n=== Written to:", outPath);
  console.log("Sheets:", wb.SheetNames.join(", "));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
