import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  const courses = await prisma.course.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { code: true, name: true, ltpc: true, credits: true, department: true },
  });

  const rows = [
    ["code", "name", "ltpc", "credits", "school_department"],
    ...courses.map((c) => [
      c.code,
      `"${c.name.replace(/"/g, '""')}"`,
      c.ltpc ?? "",
      c.credits,
      `"${c.department.replace(/"/g, '""')}"`,
    ]),
  ];

  const csv = rows.map((r) => r.join(",")).join("\n");
  const out = path.join(process.cwd(), "docs", "courses.csv");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, csv, "utf8");
  console.log(`Wrote ${courses.length} courses → ${out}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
