import prisma from "@/lib/prisma";

async function main() {
  // Get all EP DE course codes
  const epDe = await prisma.courseBranchMapping.findMany({
    where: { branch: "EP", courseCategory: "DE" },
    include: { course: { select: { code: true } } },
  });
  const epCodes = epDe.map((m) => m.course.code);
  console.log("Total EP DE courses:", epCodes.length);

  // Find active offerings for these courses
  const offerings = await prisma.courseOffering.findMany({
    where: { isActive: true, courseCode: { in: epCodes } },
    select: { id: true, courseCode: true, branches: true },
  });
  console.log("Active offerings found:", offerings.length);

  // Add EP to branches where missing
  let fixed = 0;
  for (const o of offerings) {
    if (!o.branches.includes("ALL") && !o.branches.includes("EP")) {
      await prisma.courseOffering.update({
        where: { id: o.id },
        data: { branches: [...o.branches, "EP"] },
      });
      console.log("Added EP to", o.courseCode);
      fixed++;
    }
  }

  const noOffering = epCodes.filter(c => !offerings.some(o => o.courseCode === c));
  console.log(`\nFixed: ${fixed} offerings`);
  console.log(`EP DE courses with NO active offering (${noOffering.length}):`, noOffering.slice(0, 20).join(", "));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
