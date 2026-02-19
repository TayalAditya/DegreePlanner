import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const BRANCH_MAP: Record<string, string> = {
  "Computer Science and Engineering (4 Years, Bachelor of Technology)": "CSE",
  "Data Science and Engineering (4 Years, Bachelor of Technology)": "DSE",
  "Electrical Engineering (4 Years, Bachelor of Technology)": "EE",
  "B.Tech in Microelectronics & VLSI (4 Years, Bachelor of Technology)": "MEVLSI",
  "B.Tech in Mathematics and Computing (4 Years, Bachelor of Technology)": "MNC",
  "Civil Engineering (4 Years, Bachelor of Technology)": "CE",
  "Bio Engineering (4 Years, Bachelor of Technology)": "BE",
  "Engineering Physics (4 Years, Bachelor of Technology)": "EP",
  "B.Tech in General Engineering (4 Years, Bachelor of Technology)": "GE",
  "Mechanical Engineering (4 Years, Bachelor of Technology)": "ME",
  "B.Tech in Materials Science and Engineering (4 Years, Bachelor of Technology)": "MSE",
  "BS in Chemical Sciences (4 Years, Bachelor of Science)": "BSCS",
};

async function main() {
  const csvPath = path.join(process.cwd(), "public", "data", "approved-students.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n").filter(Boolean);

  // Skip header rows (first 2 lines)
  const dataLines = lines.slice(2);

  let added = 0;
  let skipped = 0;

  for (const line of dataLines) {
    // Parse CSV: rollNo,name,"branch name",
    // Format: B23003,ADITYA BAGYAN,"BS in Chemical Sciences (4 Years, Bachelor of Science)",
    const match = line.match(/^([^,]+),([^,]+),"([^"]+)"/);
    if (!match) continue;

    const rollNo = match[1].trim();
    const name = match[2].trim();
    const branchFull = match[3].trim();

    if (!rollNo.match(/^B23\d+/i)) continue;

    const branchCode = BRANCH_MAP[branchFull] || "CSE";
    const enrollmentId = rollNo.toUpperCase();

    try {
      await prisma.approvedUser.upsert({
        where: { enrollmentId },
        update: { name, branch: branchCode },
        create: {
          email: `${enrollmentId.toLowerCase()}@students.iitmandi.ac.in`,
          enrollmentId,
          name,
          branch: branchCode,
          batch: 2023,
          allowedPrograms: [branchCode],
        },
      });
      added++;
    } catch {
      skipped++;
    }
  }

  console.log(`✅ Done: ${added} students imported, ${skipped} skipped`);
  console.log(`\nNOTE: Email format used: <rollno>@students.iitmandi.ac.in`);
  console.log(`You need to also add your ACTUAL Google email separately.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
