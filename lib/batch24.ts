import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";

export type Batch24Student = {
  enrollmentId: string;
  name: string;
  branch: string;
  department: string | null;
  /** Batch-24 ICB-1 (Sem 1) assigned course (IC131/IC136/IC230) */
  icb1Course: string | null;
};

const B24_ALLOWED_BRANCHES = new Set(["CSE", "DSE", "EE", "MEVLSI", "MSE"]);

const departmentForBranch = (branch: string) => {
  switch (branch) {
    case "CSE":
    case "DSE":
    case "EE":
    case "MEVLSI":
      return "School of Computing & Electrical Engineering";
    case "MSE":
      return "School of Mechanical and Materials Engineering";
    default:
      return null;
  }
};

const inferBranchFromProgram = (program: string) => {
  const normalized = program.toLowerCase();
  if (normalized.includes("computer science")) return "CSE";
  if (normalized.includes("data science")) return "DSE";
  if (normalized.includes("electrical")) return "EE";
  if (normalized.includes("microelectronics") || normalized.includes("vlsi"))
    return "MEVLSI";
  if (normalized.includes("materials science")) return "MSE";
  return null;
};

const extractIcb1Course = (text: string): string | null => {
  const match = /\bIC\s*-?\s*(131|136|230)\b/i.exec(text);
  if (!match) return null;
  return `IC${match[1]}`;
};

let batch24IndexPromise: Promise<Map<string, Batch24Student>> | null = null;

const loadBatch24Index = async () => {
  if (!batch24IndexPromise) {
    batch24IndexPromise = (async () => {
      try {
        const pdfPath = path.join(process.cwd(), "docs", "batch24.pdf");
        const buffer = await fs.readFile(pdfPath);
        const data = await pdfParse(buffer);
        const text = String(data?.text ?? "");

        const matches: Array<{ enrollmentId: string; index: number }> = [];
        const rollRe = /B24\d{3,}/gi;
        let m: RegExpExecArray | null;
        while ((m = rollRe.exec(text)) !== null) {
          matches.push({ enrollmentId: m[0].toUpperCase(), index: m.index });
        }

        const index = new Map<string, Batch24Student>();
        for (let i = 0; i < matches.length; i++) {
          const { enrollmentId, index: start } = matches[i];
          const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
          const raw = text.slice(start + enrollmentId.length, end);
          const normalized = raw.replace(/\s+/g, " ").trim();

          const programStart = normalized.search(/B\.?\s*Tech|B\.S\./i);
          if (programStart < 0) continue;

          const name = normalized.slice(0, programStart).trim();
          const programAndAfter = normalized.slice(programStart).trim();
          const closingParen = programAndAfter.indexOf(")");
          const program =
            closingParen >= 0
              ? programAndAfter.slice(0, closingParen + 1).trim()
              : programAndAfter;

          const branch = inferBranchFromProgram(program);
          if (!branch || !B24_ALLOWED_BRANCHES.has(branch)) continue;

          const icb1Course = extractIcb1Course(normalized);
          const existing = index.get(enrollmentId);
          if (existing) {
            if (!existing.icb1Course && icb1Course) existing.icb1Course = icb1Course;
            if (!existing.name && name) existing.name = name;
            continue;
          }

          index.set(enrollmentId, {
            enrollmentId,
            name,
            branch,
            department: departmentForBranch(branch),
            icb1Course,
          });
        }

        return index;
      } catch (err) {
        console.warn("Failed to load batch24 index:", err);
        return new Map<string, Batch24Student>();
      }
    })();
  }

  return batch24IndexPromise;
};

export const getBatch24Entry = async (enrollmentId: string) => {
  const normalized = (enrollmentId || "").toUpperCase();
  if (!/^B24\d+$/i.test(normalized)) return null;
  const index = await loadBatch24Index();
  return index.get(normalized) ?? null;
};

export const getBatch24Icb1Course = async (enrollmentId: string) => {
  const entry = await getBatch24Entry(enrollmentId);
  return entry?.icb1Course ?? null;
};

