/**
 * Add the Autumn 2026 registration offering IK-592_7.
 *
 * Keep it distinct from the existing IK-592 catalog course: the suffix
 * identifies this particular two-credit topic. Instructor information has not
 * been published, so the registration card deliberately shows only "TBD" for
 * the slot rather than inventing a faculty member or timetable slot.
 *
 * Run: npx tsx scripts/add-ik592-contemplative-psychology-registration.ts --apply
 */
import { CourseCategoryType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const COURSE = {
  code: "IK-592_7",
  name: "Contemplative Psychology",
  description: "Autumn 2026 special registration offering. Counts in the shared HSS + IKS basket.",
  credits: 2,
  department: "IK",
  level: 500,
  ltpc: "2-0-0-2",
  offeredInFall: true,
  offeredInSpring: false,
  offeredInSummer: false,
  isPassFailEligible: false,
  isActive: true,
} as const;

const ALL_BRANCHES = [
  "CSE", "DSE", "DSAI", "EE", "ME", "CE", "BE", "EP", "MSE", "MNC",
  "MEVLSI", "GE", "GE-MECH", "GE-COMM", "GE-ROBO", "BSCS", "COMMON",
];

const OFFERING = {
  courseCode: COURSE.code,
  courseName: COURSE.name,
  instructor: null,
  school: null,
  branches: ["ALL"],
  eligibleSems: [3, 5, 7],
  // The course is open for registration but the official slot is not published
  // yet. The planner treats "TBD" as non-clashing.
  slots: "TBD",
  ltpc: COURSE.ltpc,
  credits: COURSE.credits,
  categoryOverride: CourseCategoryType.IKS,
  curriculumLink: null,
  offeringSemester: 7,
  offeringYear: 2026,
  isActive: true,
  instructorEmail: null,
  compulsorySem: null,
} as const;

async function main() {
  console.log("Mode: " + (APPLY ? "APPLY" : "DRY RUN"));
  console.log(COURSE.code + " · " + COURSE.name + " · " + COURSE.ltpc + " · HSS+IKS");

  if (!APPLY) {
    console.log("Would upsert the catalog course, " + ALL_BRANCHES.length + " IKS mappings and the Autumn 2026 registration offering.");
    return;
  }

  const course = await prisma.course.upsert({
    where: { code: COURSE.code },
    update: COURSE,
    create: COURSE,
    select: { id: true, code: true },
  });

  for (const branch of ALL_BRANCHES) {
    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch, batch: "" } },
      update: { courseCategory: CourseCategoryType.IKS, semester: null, isRequired: false },
      create: {
        courseId: course.id,
        branch,
        batch: "",
        courseCategory: CourseCategoryType.IKS,
        semester: null,
        isRequired: false,
      },
    });
  }

  await prisma.courseOffering.upsert({
    where: {
      courseCode_offeringSemester_offeringYear: {
        courseCode: COURSE.code,
        offeringSemester: OFFERING.offeringSemester,
        offeringYear: OFFERING.offeringYear,
      },
    },
    update: { ...OFFERING, courseId: course.id },
    create: { ...OFFERING, courseId: course.id },
  });

  console.log("Added " + course.code + " with " + ALL_BRANCHES.length + " all-branch IKS mappings and a Fall 2026 registration offering.");
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(() => prisma.$disconnect());
