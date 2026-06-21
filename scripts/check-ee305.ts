import prisma from "@/lib/prisma";

async function main() {
  // Fix EE-305 branchMapping for EE: DE → DC (it's a B23/B22 discipline core)
  const course = await prisma.course.findFirst({ where: { code: "EE-305" } });
  if (!course) { console.error("EE-305 not found"); process.exit(1); }

  const result = await prisma.courseBranchMapping.updateMany({
    where: { courseId: course.id, branch: "EE", courseCategory: "DE" },
    data: { courseCategory: "DC" },
  });
  console.log(`✅ EE-305 EE mapping: DE → DC (updated ${result.count} row(s))`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
