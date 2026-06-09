import { CourseCategoryType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getMtpCourseCode, MTP_COMPONENT_CREDITS } from "@/lib/mtpConfig";

const COURSE_BRANCHES: Array<{ curriculumBranch: string; mappingBranches: string[]; department: string }> = [
  { curriculumBranch: "CSE", mappingBranches: ["CSE"], department: "CSE" },
  { curriculumBranch: "DSE", mappingBranches: ["DSE", "DSAI"], department: "SCEE" },
  { curriculumBranch: "EE", mappingBranches: ["EE"], department: "SCEE" },
  { curriculumBranch: "MEVLSI", mappingBranches: ["MEVLSI"], department: "SCEE" },
  { curriculumBranch: "MNC", mappingBranches: ["MNC"], department: "SMSS" },
  { curriculumBranch: "ME", mappingBranches: ["ME"], department: "SMME" },
  { curriculumBranch: "EP", mappingBranches: ["EP"], department: "SPS" },
  { curriculumBranch: "GE", mappingBranches: ["GE"], department: "SCEE" },
  { curriculumBranch: "MSE", mappingBranches: ["MSE"], department: "SMME" },
  { curriculumBranch: "CE", mappingBranches: ["CE"], department: "SCENE" },
  { curriculumBranch: "BE", mappingBranches: ["BE"], department: "SBB" },
  { curriculumBranch: "BSCS", mappingBranches: ["BSCS"], department: "SCS" },
];

async function upsertCourse(
  code: string,
  name: string,
  semester: number,
  department: string,
  requiredBranches: string[],
) {
  return prisma.course.upsert({
    where: { code },
    update: {
      name,
      credits: MTP_COMPONENT_CREDITS,
      department,
      level: 400,
      description: `${name} in the student's parent discipline.`,
      offeredInFall: semester === 7,
      offeredInSpring: semester === 8,
      isBranchSpecific: true,
      requiredBranches,
      requiredSemester: semester,
      isActive: true,
    },
    create: {
      code,
      name,
      credits: MTP_COMPONENT_CREDITS,
      department,
      level: 400,
      description: `${name} in the student's parent discipline.`,
      offeredInFall: semester === 7,
      offeredInSpring: semester === 8,
      offeredInSummer: false,
      isPassFailEligible: false,
      isBranchSpecific: true,
      requiredBranches,
      requiredSemester: semester,
      isActive: true,
    },
  });
}

async function upsertMtpMapping(
  courseId: string,
  branch: string,
  batch: string,
  semester: number,
  isRequired: boolean,
) {
  await prisma.courseBranchMapping.upsert({
    where: {
      courseId_branch_batch: {
        courseId,
        branch,
        batch,
      },
    },
    update: {
      courseCategory: CourseCategoryType.MTP,
      isRequired,
      semester,
      splitCategory: null,
      splitAmount: null,
    },
    create: {
      courseId,
      branch,
      batch,
      courseCategory: CourseCategoryType.MTP,
      isRequired,
      semester,
    },
  });
}

async function main() {
  let courseCount = 0;
  let mappingCount = 0;

  await prisma.program.updateMany({
    where: { code: "BSCS" },
    data: {
      minCreditsForMtp: 90,
      minSemesterForMtp: 7,
    },
  });

  for (const config of COURSE_BRANCHES) {
    for (const component of [1, 2] as const) {
      const semester = component === 1 ? 7 : 8;
      const code = getMtpCourseCode(config.curriculumBranch, component);
      const name = `Major Technical Project - ${component === 1 ? "I" : "II"}`;
      const course = await upsertCourse(code, name, semester, config.department, config.mappingBranches);
      courseCount++;

      for (const branch of config.mappingBranches) {
        const batch = branch === "DSAI" ? "2025" : "2023";
        // Keep the all-batches mapping correct for UI paths that do not carry
        // batch metadata, then add the cohort-specific required mapping.
        await upsertMtpMapping(course.id, branch, "", semester, false);
        await upsertMtpMapping(course.id, branch, batch, semester, true);
        mappingCount += 2;
      }
    }
  }

  for (const component of [1, 2] as const) {
    const semester = component === 1 ? 7 : 8;
    const code = `DP-${component === 1 ? "498P" : "499P"}`;
    await upsertCourse(
      code,
      `Major Technical Project - ${component === 1 ? "I" : "II"}`,
      semester,
      "COMMON",
      [],
    );
  }

  console.log(JSON.stringify({ courseCount, mappingCount, creditsPerComponent: MTP_COMPONENT_CREDITS }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
