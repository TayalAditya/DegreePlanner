import prisma from "@/lib/prisma";

async function main() {
  const codes = ["CS-683", "DS-411", "DS-413", "CS-671"];
  const courses = await prisma.course.findMany({
    where: { code: { in: codes } },
    select: { code: true, name: true, branchMappings: { select: { courseCategory: true, branch: true, batch: true }, orderBy: { branch: "asc" } } },
  });

  if (courses.length === 0) {
    console.log("None of these courses found in DB!");
    // Try case-insensitive search
    const all = await prisma.course.findMany({
      where: { code: { in: ["cs683","ds411","ds413","cs671","CS-683","DS-411","DS-413","CS-671"] } },
      select: { code: true }
    });
    console.log("Case-insensitive search:", all.map(c => c.code));
  } else {
    courses.forEach(c => {
      console.log(`\n${c.code} - ${c.name}`);
      if (c.branchMappings.length === 0) console.log("  NO MAPPINGS");
      c.branchMappings.forEach(m => console.log(`  ${m.branch.padEnd(12)} cat:${m.courseCategory} batch:${m.batch || "all"}`));
    });
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
