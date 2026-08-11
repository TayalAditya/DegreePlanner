import prisma from "@/lib/prisma";

type MechanicalDeCourse = {
  code: string;
  name: string;
  credits: number;
};

// The shared ME mapping (batch "") applies to every supported batch.
// Credits match the existing catalog rows. MT-508 is a 3-credit MT 500-level course,
// consistent with the surrounding MT-502/503/505/510/511 catalog entries.
const COURSES: MechanicalDeCourse[] = [
  { code: "MT-201", name: "Physics of Solids", credits: 3 },
  { code: "MT-202", name: "Applied Quantum Mechanics", credits: 3 },
  { code: "MT-203", name: "Materials Synthesis and Characterization", credits: 4 },
  { code: "MT-301", name: "Phase Transformations", credits: 3 },
  { code: "MT-302", name: "Transport Phenomena", credits: 3 },
  { code: "MT-303", name: "Computational Materials Science", credits: 4 },
  { code: "MT-304", name: "Mechanical Behavior of Materials", credits: 4 },
  { code: "MT-502", name: "Recycling and Circular Economy", credits: 3 },
  { code: "MT-503", name: "Semiconductor Materials and Devices", credits: 3 },
  { code: "MT-505", name: "Thin Film Technology", credits: 3 },
  { code: "MT-508", name: "Iron and Steel Making", credits: 3 },
  { code: "MT-510", name: "Colloids and Interfaces", credits: 3 },
  { code: "MT-511", name: "Sensor Materials and Technologies", credits: 3 },
];

async function main() {
  let createdCourses = 0;
  let createdMappings = 0;
  let updatedMappings = 0;

  await prisma.$transaction(async (tx) => {
    for (const definition of COURSES) {
      const existingCourse = await tx.course.findUnique({
        where: { code: definition.code },
        select: { id: true, name: true, credits: true },
      });

      const course = existingCourse ?? await tx.course.create({
        data: {
          ...definition,
          department: "Materials Science",
          level: Number(definition.code.slice(3, 4)) * 100,
        },
        select: { id: true, name: true, credits: true },
      });

      if (!existingCourse) createdCourses++;

      const existingMapping = await tx.courseBranchMapping.findUnique({
        where: {
          courseId_branch_batch: {
            courseId: course.id,
            branch: "ME",
            batch: "",
          },
        },
        select: { courseCategory: true },
      });

      await tx.courseBranchMapping.upsert({
        where: {
          courseId_branch_batch: {
            courseId: course.id,
            branch: "ME",
            batch: "",
          },
        },
        create: {
          courseId: course.id,
          branch: "ME",
          batch: "",
          courseCategory: "DE",
        },
        update: { courseCategory: "DE" },
      });

      if (existingMapping) updatedMappings++;
      else createdMappings++;

      console.log(`${definition.code} — ${course.name} (${course.credits} credits) → ME DE (all batches)`);
    }
  });

  console.log(
    `\nDone: ${createdCourses} course created, ${createdMappings} mappings created, ${updatedMappings} mappings updated.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
