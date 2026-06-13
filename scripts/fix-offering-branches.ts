import prisma from "@/lib/prisma";

const BRANCH_CODES: Record<string, string[]> = {
  BE: ["AR-506","CE-521","CE-559","CS-309","CS-606","CS-671","CY-344","CY-550","CY-642","CY-643","CY-644","CY-670","DS-303","DS-313","EE-305","EE-314","EE-516","EE-574","EE-608","IK-502","IK-507","IK-510","IK-511","MA-621","MA-650","ME-527","ME-612","ME-622","MT-506"],
  DSE: ["AR-507","AR-509","AR-516","AR-517","BE-303","BE-304","BE-502","BE-505","EE-203","EE-304","EE-305","EE-511","EE-522","EE-530","EE-531","EE-534","EE-541","EE-543","EE-574","EE-575","EE-608","EE-620","IK-502","IK-542","IK-548","IK-570","MA-530","MA-605","ME-522","ME-526","PH-302","PH-522","EP-301"],
  "GE-MECH": ["ME-210","EE-231","ME-452","CS-313","EE-536","EE-314","CS-305","EE-529","ME-212","IC-241","ME-213","AR-502","AR-505","ME-510","AR-510","AR-511","EE-311","AR-522","DS-201","ME-100","AR-519","AR-521","ME-215","ME-504","ME-527","ME-630","DS-313"],
  "GE-COMM": ["EE-608","EE-641","EE-536","DS-313","EE-517","EE-553","EE-503","CS-549","EE-518","DS-201","EE-541","EE-211","EE-533","EE-530","EE-607","IC-241","ME-212"],
  "GE-ROBO": ["EE-604","AR-526","EE-529","CE-251","AR-505","CS-514","ME-510","CS-212","AR-508","EE-260","AR-502","AR-510","AR-511","EE-211","ME-212","AR-522","ME-100","AR-513","ME-213","ME-210","AR-514","IC-241","EE-203","DS-313","AR-524","AR-525"],
  "GE-FIN": ["MA-546","MA-552","MA-604","HS-307"],
};

async function main() {
  // Create ME-527 if missing
  const me527 = await prisma.course.upsert({
    where: { code: "ME-527" },
    update: {},
    create: { code: "ME-527", name: "Biofluid Dynamics", credits: 3, department: "School of Mechanical and Materials Engineering", level: 500, offeredInFall: true, offeredInSpring: true, offeredInSummer: false },
  });
  for (const branch of ["BE", "GE-MECH"]) {
    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: me527.id, branch, batch: "" } },
      update: { courseCategory: "DE" },
      create: { courseId: me527.id, branch, courseCategory: "DE", batch: "" },
    });
  }
  console.log("Created ME-527");

  let fixed = 0;
  for (const [branch, codes] of Object.entries(BRANCH_CODES)) {
    const offerings = await prisma.courseOffering.findMany({
      where: { isActive: true, courseCode: { in: codes } },
      select: { id: true, courseCode: true, branches: true },
    });
    for (const o of offerings) {
      if (!o.branches.includes("ALL") && !o.branches.includes(branch)) {
        await prisma.courseOffering.update({ where: { id: o.id }, data: { branches: [...o.branches, branch] } });
        fixed++;
        console.log(`  Added ${branch} → ${o.courseCode}`);
      }
    }
  }
  console.log(`\nFixed ${fixed} offerings`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
