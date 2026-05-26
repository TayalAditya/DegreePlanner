import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const updates: Array<{ code: string; note: string }> = [
  { code: "CE-310",  note: "Previously CE-301 till academic year 2024-25." },
  { code: "CE-310P", note: "Previously CE-301P till academic year 2024-25." },
  { code: "CE-311",  note: "Previously CE-302 till academic year 2024-25." },
  { code: "CE-311P", note: "Previously CE-302P till academic year 2024-25." },
  { code: "CE-203P", note: "Previously CE-354P (Construction Materials Lab) till academic year 2024-25." },
  { code: "CE-203",  note: "Previously named 'Construction Materials' till academic year 2024-25." },
];

async function main() {
  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const { code, note } of updates) {
    const course = await prisma.course.findUnique({ where: { code } });
    if (!course) {
      console.log(`⚠️  Missing: ${code} (not found in DB, skipping)`);
      missing++;
      continue;
    }

    if (course.description && course.description.includes(note)) {
      console.log(`⏭️  Skipped: ${code} (note already present)`);
      skipped++;
      continue;
    }

    const newDescription = course.description
      ? `${course.description}\n\n${note}`
      : note;

    await prisma.course.update({
      where: { code },
      data: { description: newDescription },
    });
    console.log(`✅ Updated: ${code}`);
    updated++;
  }

  console.log(`\nSummary: ${updated} updated, ${skipped} already had note, ${missing} missing.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
