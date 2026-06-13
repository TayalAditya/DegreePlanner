import prisma from "@/lib/prisma";

const CODES = [
  "PH-613","MA-513","MA-511","MA-512","EE-621","CS-241","ME-210","ME-603",
  "DS-404","CS-672","EE-203","CS-511","EE-511","EE-519P","EE-524","PH-530",
  "PH-625","PH-627","QT-406","QT-407",
];

async function main() {
  let added = 0, skipped = 0;
  for (const code of CODES) {
    const course = await prisma.course.findFirst({ where: { code }, select: { id: true } });
    if (!course) { console.log("NOT FOUND:", code); skipped++; continue; }
    // upsert to handle unique constraint (courseId, branch, batch)
    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "EP", batch: "" } },
      update: { courseCategory: "DE" },
      create: { courseId: course.id, branch: "EP", courseCategory: "DE", batch: "" },
    });
    added++;
    console.log("Added EP→DE:", code);
  }
  console.log(`\nDone. Added: ${added} | Skipped/missing: ${skipped}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
