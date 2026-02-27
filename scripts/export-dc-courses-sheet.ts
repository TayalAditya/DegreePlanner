import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import * as XLSX from "xlsx";

type DcSection = {
  heading: string;
  sheetName: string;
};

type ParsedCourse = {
  sectionHeading: string;
  courseCodePdf: string;
  courseCode: string;
  courseName: string;
  creditsText: string;
  credits: number | null;
};

const PDF_PATH = path.join(process.cwd(), "docs", "Aditya Tayal UG Batch 2023.pdf");
const OUTPUT_PATH = path.join(process.cwd(), "docs", "DC_Courses_Batch_2023.xlsx");

const DC_SECTIONS: DcSection[] = [
  { heading: "B.S. in Chemical Sciences", sheetName: "BSCS (Chem Sci)" },
  { heading: "BioEngineering", sheetName: "BE (BioEngg)" },
  { heading: "Civil Engineering", sheetName: "CE (Civil)" },
  { heading: "Computer Science Engineering", sheetName: "CSE" },
  { heading: "Data Science Engineering", sheetName: "DSE" },
  { heading: "Electrical Engineering", sheetName: "EE" },
  { heading: "Engineering Physics", sheetName: "EP" },
  { heading: "General Engineering (Robotics and AI)", sheetName: "GE (Robotics&AI)" },
  { heading: "General Engineering (Communication Engineering)", sheetName: "GE (Comm Engg)" },
  { heading: "General Engineering (Mechatronics)", sheetName: "GE (Mechatronics)" },
  { heading: "Material Science and Engineering", sheetName: "MSE" },
  { heading: "Mathematics and Computing", sheetName: "MNC" },
  { heading: "Mechanical Engineering", sheetName: "ME" },
  { heading: "Microelectronics and VLSI", sheetName: "MEVLSI" },
];

const SECTION_HEADINGS = new Set(DC_SECTIONS.map((s) => s.heading));

const courseCodeRegex = /\b[A-Z]{2,4}(?:-\d{3}|\d{3}|XXX)(?:P)?\b/;
const ltpCreditRegex = /\b\d+(?:\.\d+)?-\d+(?:\.\d+)?-\d+(?:\.\d+)?-\d+(?:\.\d+)?\*?\b/g;
const numericCreditAtLineEndRegex = /\b\d+(?:\.\d+)?\*?\b\s*$/;

function escapeRegExp(s: string) {
  // eslint-disable-next-line no-useless-escape
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLineForMatch(line: string) {
  return line.replace(/\f/g, "").trim();
}

function normalizeCourseCode(codePdf: string) {
  return codePdf.replace(/-/g, "");
}

function extractCreditsNumeric(creditsText: string): number | null {
  const clean = creditsText.replace(/\*/g, "");
  if (clean.includes("-")) {
    const parts = clean.split("-");
    const last = parts[parts.length - 1];
    const n = Number(last);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function findNumericCreditsText(rawLines: string[], courseCodePdf: string) {
  const isValidCredit = (token: string) => {
    const n = Number(token.replace(/\*/g, ""));
    return Number.isFinite(n) && n <= 10;
  };

  for (const line of rawLines) {
    if (!line.includes(courseCodePdf)) continue;
    const m = line.trimEnd().match(numericCreditAtLineEndRegex);
    const token = m?.[0]?.trim() ?? "";
    if (token && isValidCredit(token)) return token;
  }

  for (const line of rawLines) {
    const m = line.trimEnd().match(numericCreditAtLineEndRegex);
    const token = m?.[0]?.trim() ?? "";
    if (token && isValidCredit(token)) return token;
  }

  return "";
}

function parseCourseFromColumnBlock(columnText: string): Omit<ParsedCourse, "sectionHeading"> | null {
  const raw = columnText.replace(/\r\n/g, "\n");
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;

  const codeMatch = collapsed.match(courseCodeRegex);
  if (!codeMatch) return null;

  const courseCodePdf = codeMatch[0] ?? "";
  const courseCode = normalizeCourseCode(courseCodePdf);

  let remaining = raw.replace(courseCodePdf, "");

  ltpCreditRegex.lastIndex = 0;
  const ltpMatches = Array.from(remaining.matchAll(ltpCreditRegex));
  let creditsText = "";

  if (ltpMatches.length > 0) {
    creditsText = ltpMatches[ltpMatches.length - 1]?.[0] ?? "";
    if (creditsText) remaining = remaining.replace(creditsText, "").trim();
  } else {
    const rawLines = raw.split("\n");
    creditsText = findNumericCreditsText(rawLines, courseCodePdf);
    if (creditsText) {
      const re = new RegExp(`\\b${escapeRegExp(creditsText)}\\b`);
      remaining = remaining.replace(re, "").trim();
    }
  }

  const courseName = remaining.replace(/\s+/g, " ").trim();
  const credits = creditsText ? extractCreditsNumeric(creditsText) : null;

  return {
    courseCodePdf,
    courseCode,
    courseName,
    creditsText,
    credits,
  };
}

function findHeaderAndSplitIndex(sectionLines: string[]) {
  const headerIdx = sectionLines.findIndex((l) => l.includes("Course Code") && l.includes("Credits"));
  if (headerIdx === -1) return { headerIdx: -1, rightColStart: null as number | null };

  const headerLine = sectionLines[headerIdx] ?? "";
  const first = headerLine.indexOf("Course Code");
  const second = headerLine.indexOf("Course Code", first + 1);
  const rightColStart = second === -1 ? null : second;
  return { headerIdx, rightColStart };
}

function splitIntoBlocks(lines: string[]) {
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
      continue;
    }
    current.push(line);
  }

  if (current.length > 0) blocks.push(current);
  return blocks;
}

function parseSectionCourses(sectionHeading: string, sectionLines: string[]): ParsedCourse[] {
  const { headerIdx, rightColStart } = findHeaderAndSplitIndex(sectionLines);
  if (headerIdx === -1 || rightColStart == null) return [];

  const bodyLines = sectionLines.slice(headerIdx + 1);
  const blocks = splitIntoBlocks(bodyLines);

  const courses: ParsedCourse[] = [];

  for (const block of blocks) {
    const leftBlock = block.map((l) => l.slice(0, rightColStart)).join("\n");
    const rightBlock = block.map((l) => l.slice(rightColStart)).join("\n");

    const leftCourse = parseCourseFromColumnBlock(leftBlock);
    if (leftCourse) courses.push({ sectionHeading, ...leftCourse });

    const rightCourse = parseCourseFromColumnBlock(rightBlock);
    if (rightCourse) courses.push({ sectionHeading, ...rightCourse });
  }

  const seen = new Set<string>();
  return courses.filter((c) => {
    const key = `${c.sectionHeading}|${c.courseCodePdf}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractDcTextFromPdf(pdfPath: string) {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found at: ${pdfPath}`);
  }

  const tmpTxt = path.join(os.tmpdir(), `degreeplanner_dc_${Date.now()}.txt`);
  execFileSync("pdftotext", ["-layout", pdfPath, tmpTxt], { stdio: "ignore" });

  const content = fs.readFileSync(tmpTxt, "utf8");
  try {
    fs.unlinkSync(tmpTxt);
  } catch {
    // ignore
  }

  return content;
}

function extractSections(allLines: string[]) {
  const startIdx = allLines.findIndex((l) => normalizeLineForMatch(l) === DC_SECTIONS[0]?.heading);
  if (startIdx === -1) throw new Error("Could not find DC sections start (B.S. in Chemical Sciences).");

  const endIdx = allLines.findIndex((l, idx) => idx > startIdx && normalizeLineForMatch(l) === "Free Electives");
  const sliceEnd = endIdx === -1 ? allLines.length : endIdx;

  const relevant = allLines.slice(startIdx, sliceEnd);

  const sections: Array<{ heading: string; lines: string[] }> = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const line of relevant) {
    const normalized = normalizeLineForMatch(line);

    if (SECTION_HEADINGS.has(normalized)) {
      if (current) sections.push(current);
      current = { heading: normalized, lines: [line] };
      continue;
    }

    if (current) current.lines.push(line);
  }

  if (current) sections.push(current);

  return sections;
}

function buildWorkbook(courses: ParsedCourse[]) {
  const wb = XLSX.utils.book_new();

  const allRows = courses
    .slice()
    .sort((a, b) => {
      const s = a.sectionHeading.localeCompare(b.sectionHeading);
      if (s !== 0) return s;
      return a.courseCode.localeCompare(b.courseCode);
    })
    .map((c) => ({
      Branch: c.sectionHeading,
      "Course Code": c.courseCode,
      "Course Code (PDF)": c.courseCodePdf,
      "Course Name": c.courseName,
      Credits: c.credits ?? "",
      Semester: "",
    }));

  const allSheet = XLSX.utils.json_to_sheet(allRows, {
    header: ["Branch", "Course Code", "Course Code (PDF)", "Course Name", "Credits", "Semester"],
  });
  allSheet["!cols"] = [
    { wch: 34 },
    { wch: 16 },
    { wch: 18 },
    { wch: 54 },
    { wch: 10 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, allSheet, "All DC");

  for (const section of DC_SECTIONS) {
    const sectionCourses = courses
      .filter((c) => c.sectionHeading === section.heading)
      .sort((a, b) => a.courseCode.localeCompare(b.courseCode));

    const rows = sectionCourses.map((c) => ({
      "Course Code": c.courseCode,
      "Course Code (PDF)": c.courseCodePdf,
      "Course Name": c.courseName,
      Credits: c.credits ?? "",
      Semester: "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ["Course Code", "Course Code (PDF)", "Course Name", "Credits", "Semester"],
    });
    ws["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 54 }, { wch: 10 }, { wch: 10 }];

    XLSX.utils.book_append_sheet(wb, ws, section.sheetName);
  }

  return wb;
}

async function main() {
  const pdfText = extractDcTextFromPdf(PDF_PATH);
  const lines = pdfText.split(/\r?\n/);

  const sections = extractSections(lines);

  const parsed: ParsedCourse[] = [];
  for (const sec of sections) {
    parsed.push(...parseSectionCourses(sec.heading, sec.lines));
  }

  const wb = buildWorkbook(parsed);
  XLSX.writeFile(wb, OUTPUT_PATH);

  const counts = DC_SECTIONS.map((s) => {
    const n = parsed.filter((c) => c.sectionHeading === s.heading).length;
    return `${s.sheetName}: ${n}`;
  }).join(", ");

  // eslint-disable-next-line no-console
  console.log(`Wrote: ${OUTPUT_PATH}`);
  // eslint-disable-next-line no-console
  console.log(`Tabs: All DC + ${DC_SECTIONS.length} branches`);
  // eslint-disable-next-line no-console
  console.log(`Counts: ${counts}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
