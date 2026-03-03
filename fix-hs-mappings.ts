import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixHSSMappings() {
  try {
    console.log("🔍 Finding all HS courses mapped as FE...");
    
    const hsCoursesAsFE = await prisma.courseBranchMapping.findMany({
      where: {
        course: {
          code: {
            startsWith: "HS",
          },
        },
        courseCategory: "FE",
      },
      include: {
        course: true,
      },
    });

    console.log(`Found ${hsCoursesAsFE.length} HS courses mapped as FE`);

    if (hsCoursesAsFE.length > 0) {
      const updated = await prisma.courseBranchMapping.updateMany({
        where: {
          course: {
            code: {
              startsWith: "HS",
            },
          },
          courseCategory: "FE",
        },
        data: {
          courseCategory: "HSS",
        },
      });

      console.log(`✅ Updated ${updated.count} mappings from FE to HSS`);
      
      // Show which courses were updated
      hsCoursesAsFE.forEach((mapping) => {
        console.log(
          `  ${mapping.course.code} (${mapping.branch}): FE → HSS`
        );
      });
    }

    console.log("\n✅ HS course mappings fixed!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixHSSMappings();
