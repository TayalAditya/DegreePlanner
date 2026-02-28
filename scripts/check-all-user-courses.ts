import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: {
      enrollmentId: "B23243",
    },
    include: {
      enrollments: {
        where: {
          status: "COMPLETED",
        },
        include: {
          course: {
            include: {
              branchMappings: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    console.log("User not found");
    return;
  }

  console.log(`User: ${user.name} (${user.enrollmentId})`);
  console.log(`Branch: ${user.branch}`);
  console.log(`Doing ISTP: ${user.doingISTP}`);
  console.log(`\nAll completed courses:`);

  user.enrollments.forEach((e) => {
    console.log(`${e.course.code} - ${e.course.name}`);
    console.log(`  Credits: ${e.course.credits}, CourseType: ${e.courseType}`);
    console.log(`  isInternship: ${e.isInternship}`);
    if (e.isInternship) {
      console.log(`  Internship Type: ${e.internshipType}, Days: ${e.internshipDays}`);
    }
    const branch = user.branch === "CSE" ? "CS" : user.branch;
    const mapping = e.course.branchMappings.find(
      (m) => m.branch === branch || m.branch === "COMMON"
    );
    if (mapping) {
      console.log(`  Mapping: ${mapping.branch} -> ${mapping.courseCategory}`);
    }
    console.log();
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
