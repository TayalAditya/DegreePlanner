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
  console.log(`\nCompleted enrollments: ${user.enrollments.length}`);

  const FE_courses = user.enrollments.filter((e) => {
    const code = e.course.code.toUpperCase();
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
    
    // Check if it would be categorized as FE
    const branch = user.branch === "CSE" ? "CS" : user.branch;
    const mapping = e.course.branchMappings.find(
      (m) => m.branch === branch || m.branch === "COMMON"
    );
    
    if (mapping && mapping.courseCategory === "FE") {
      return true;
    }
    
    if (e.courseType === "FREE_ELECTIVE" || e.courseType === "PE") {
      return true;
    }
    
    return false;
  });

  console.log(`\nCourses that might show as FE: ${FE_courses.length}`);
  let totalFECredits = 0;
  FE_courses.forEach((e) => {
    console.log(`  ${e.course.code} - ${e.course.name} (${e.course.credits} cr) - courseType: ${e.courseType}`);
    totalFECredits += e.course.credits;
    const branch = user.branch === "CSE" ? "CS" : user.branch;
    const mapping = e.course.branchMappings.find(
      (m) => m.branch === branch || m.branch === "COMMON"
    );
    if (mapping) {
      console.log(`    Mapping: ${mapping.branch} -> ${mapping.courseCategory}`);
    }
  });
  
  console.log(`\nTotal FE credits: ${totalFECredits}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
