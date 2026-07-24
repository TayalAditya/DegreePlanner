/**
 * Exports the DE mappings that are outside a programme's parent school.
 *
 * Parent-school courses are accepted automatically by the DC synchroniser.
 * This report deliberately does not decide the remaining cross-school cases:
 * each needs owner confirmation before it is retained as a DE mapping.
 */
import fs from "fs";
import path from "path";
import { PrismaClient, CourseCategoryType } from "@prisma/client";

const prisma = new PrismaClient();

const PARENT_SCHOOL: Record<string, string> = {
  CSE: "SCEE", DSE: "SCEE", DSAI: "SCEE", EE: "SCEE", MEVLSI: "SCEE",
  MNC: "SMSS", ME: "SMME", MSE: "SMME",
  "GE-ROBO": "SMME", "GE-MECH": "SMME", "GE-COMM": "SMME",
  "GE-OPEN": "SMME", "GE-FIN": "SMME", GE: "SMME",
  CE: "SCENE", EP: "SPS", BE: "SBE", BSCS: "SCS",
};

function courseSchool(code: string) {
  const prefix = String(code).toUpperCase().split("-")[0];
  if (["CS", "DS", "EE", "VL"].includes(prefix)) return "SCEE";
  if (prefix === "MA") return "SMSS";
  if (["ME", "MT", "AR"].includes(prefix)) return "SMME";
  if (prefix === "CE") return "SCENE";
  if (["BE", "BY"].includes(prefix)) return "SBE";
  if (["EP", "PH", "QT", "QS"].includes(prefix)) return "SPS";
  if (["CY", "CH"].includes(prefix)) return "SCS";
  return "OTHER";
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function main() {
  const branches = Object.keys(PARENT_SCHOOL);
  const mappings = await prisma.courseBranchMapping.findMany({
    where: { branch: { in: branches }, courseCategory: CourseCategoryType.DE },
    include: { course: { select: { code: true, name: true, credits: true, department: true } } },
    orderBy: [{ branch: "asc" }, { course: { code: "asc" } }],
  });

  const rows = mappings
    .filter((mapping) => /^[A-Z]{2,4}-\d{3}P?$/i.test(mapping.course.code))
    .filter((mapping) => courseSchool(mapping.course.code) !== PARENT_SCHOOL[mapping.branch])
    .map((mapping) => [
      mapping.branch,
      mapping.batch || "all",
      mapping.course.code,
      mapping.course.name,
      mapping.course.credits,
      PARENT_SCHOOL[mapping.branch],
      courseSchool(mapping.course.code),
      mapping.course.department,
      "PENDING_OWNER_CONFIRMATION",
      "",
    ]);

  const header = [
    "Programme", "Mapping batch", "Course code", "Course name", "Credits",
    "Parent school", "Course school", "Catalogue department", "Status", "Owner decision (DE / not DE)",
  ];
  const output = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
  const destination = path.join(process.cwd(), "docs", "curricula", "DE_external_mapping_review.csv");
  fs.writeFileSync(destination, output, "utf8");

  const summary = new Map<string, number>();
  for (const row of rows) summary.set(String(row[0]), (summary.get(String(row[0])) ?? 0) + 1);
  console.log(`Wrote ${rows.length} external DE mappings to ${destination}`);
  for (const [branch, count] of [...summary].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${branch}: ${count}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
