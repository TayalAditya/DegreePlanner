import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";
import { getDepartmentForBranch } from "@/lib/branchInfo";
import { normalizeBatch26PreferenceCode } from "@/lib/batch26Preferences";

export type Batch26Student = {
  enrollmentId: string;
  name: string;
  branch: string;
  department: string | null;
  /** Exact first-semester choices supplied in the UG26 preference form. */
  selectedCourseCodes: string[];
};

const PROGRAM_BRANCHES: Array<[program: string, branch: string]> = [
  ["Agricultural Engineering with Data Analytics", "AG"],
  ["Bio Engineering", "BE"],
  ["Chemical Engineering with Data Analytics", "CHE"],
  ["Chemical Sciences", "BSCS"],
  ["Civil Engineering", "CE"],
  ["Computer Science and Engineering", "CSE"],
  ["Data Science and Artificial Intelligence", "DSAI"],
  ["Electrical Engineering", "EE"],
  ["Engineering Physics", "EP"],
  ["General Engineering", "GE"],
  ["Materials Science and Engineering", "MSE"],
  ["Mathematics and Computing", "MNC"],
  ["Mechanical Engineering", "ME"],
  ["Microelectronics & VLSI", "MEVLSI"],
  ["Quantum Science and Engineering", "QS"],
];

const EXPECTED_BRANCH_COUNTS: Record<string, number> = {
  AG: 27,
  BE: 23,
  CHE: 30,
  BSCS: 21,
  CE: 45,
  CSE: 87,
  DSAI: 59,
  EE: 64,
  EP: 25,
  GE: 30,
  MSE: 27,
  MNC: 37,
  ME: 58,
  MEVLSI: 27,
  QS: 27,
};

function parseBatch26PreferencePdf(text: string): Batch26Student[] {
  // pdf-parse joins the serial number to the roll number (for example
  // `1B26001`), so do not require a word boundary before B26 here.
  const rollMatches = Array.from(text.matchAll(/B26\d{3}/g));
  const entries = new Map<string, Batch26Student>();

  for (let index = 0; index < rollMatches.length; index += 1) {
    const match = rollMatches[index];
    const enrollmentId = match[0].toUpperCase();
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < rollMatches.length
      ? (rollMatches[index + 1].index ?? text.length)
      : text.length;
    const row = text.slice(start, end);
    const programEntry = PROGRAM_BRANCHES.find(([program]) => row.includes(program));
    if (!programEntry) continue;

    const [program, branch] = programEntry;
    const bachelorIndex = row.indexOf("Bachelor");
    const name = (bachelorIndex >= 0 ? row.slice(0, bachelorIndex) : "")
      .replace(/\s+/g, " ")
      .trim();
    const choiceTail = row.slice(row.indexOf(program) + program.length);
    const selectedCourseCodes = Array.from(
      new Set(
        Array.from(choiceTail.matchAll(/(?:IC|IK|HS|CED)-\d{3}P?(?:_\d+)?/g)).map((course) =>
          normalizeBatch26PreferenceCode(course[0])
        )
      )
    );

    entries.set(enrollmentId, {
      enrollmentId,
      name,
      branch,
      department: getDepartmentForBranch(branch),
      selectedCourseCodes,
    });
  }

  const parsed = Array.from(entries.values());
  const counts = parsed.reduce<Record<string, number>>((result, student) => {
    result[student.branch] = (result[student.branch] ?? 0) + 1;
    return result;
  }, {});
  const valid = Object.entries(EXPECTED_BRANCH_COUNTS).every(
    ([branch, expected]) => counts[branch] === expected
  );

  if (!valid || parsed.length !== 587) {
    throw new Error(
      `Unexpected B26 roster parse: ${parsed.length} entries; counts=${JSON.stringify(counts)}`
    );
  }

  return parsed;
}

let batch26EntriesPromise: Promise<Batch26Student[]> | null = null;

export async function getBatch26Entries(): Promise<Batch26Student[]> {
  if (!batch26EntriesPromise) {
    batch26EntriesPromise = (async () => {
      const pdfPath = path.join(process.cwd(), "docs", "batch26-course-preferences.pdf");
      const data = await pdfParse(await fs.readFile(pdfPath));
      return parseBatch26PreferencePdf(String(data.text ?? ""));
    })();
  }

  return batch26EntriesPromise;
}

export async function getBatch26Entry(enrollmentId: string | null | undefined) {
  const normalizedId = String(enrollmentId ?? "").toUpperCase();
  if (!/^B26\d+$/i.test(normalizedId)) return null;
  const entries = await getBatch26Entries();
  return entries.find((entry) => entry.enrollmentId === normalizedId) ?? null;
}
