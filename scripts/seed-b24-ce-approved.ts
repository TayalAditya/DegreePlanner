import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";
import { inferBranchFromProgram, getDepartmentForBranch } from "../lib/branchInfo";

const prisma = new PrismaClient();

async function main() {
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

  const ceStudents: Array<{ enrollmentId: string; name: string }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < matches.length; i++) {
    const { enrollmentId, index: start } = matches[i];
    if (seen.has(enrollmentId)) continue;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const raw = text.slice(start + enrollmentId.length, end);
    const normalized = raw.replace(/\s+/g, " ").trim();

    const programStart = normalized.search(/B\.?\s*Tech|B\.S\./i);
    if (programStart < 0) continue;

    const name = normalized.slice(0, programStart).trim();
    const programAndAfter = normalized.slice(programStart).trim();
    const closingParen = programAndAfter.indexOf(")");
    const program = closingParen >= 0 ? programAndAfter.slice(0, closingParen + 1).trim() : programAndAfter;

    const branch = inferBranchFromProgram(program);
    if (branch !== "CE") continue;

    seen.add(enrollmentId);
    ceStudents.push({ enrollmentId, name });
  }

  console.log(`Found ${ceStudents.length} B24 CE students in PDF.`);

  let created = 0;
  let updated = 0;
  for (const s of ceStudents) {
    const email = `${s.enrollmentId.toLowerCase()}@students.iitmandi.ac.in`;
    const existing = await prisma.approvedUser.findUnique({ where: { enrollmentId: s.enrollmentId } });
    await prisma.approvedUser.upsert({
      where: { enrollmentId: s.enrollmentId },
      update: {
        email,
        name: s.name,
        department: getDepartmentForBranch("CE"),
        branch: "CE",
        batch: 2024,
        allowedPrograms: ["CE"],
      },
      create: {
        email,
        enrollmentId: s.enrollmentId,
        name: s.name,
        department: getDepartmentForBranch("CE"),
        branch: "CE",
        batch: 2024,
        allowedPrograms: ["CE"],
      },
    });
    if (existing) updated++;
    else created++;
  }

  console.log(`✅ Done: ${created} created, ${updated} updated.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
