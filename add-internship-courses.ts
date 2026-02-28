import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n📚 Adding 399P Internship Courses...\n');

  const branches = [
    { code: 'CS', name: 'Computer Science and Engineering', dept: 'School of Computing and Electrical Engineering' },
    { code: 'DS', name: 'Data Science and Engineering', dept: 'School of Computing and Electrical Engineering' },
    { code: 'MC', name: 'Mathematics and Computing', dept: 'School of Mathematical and Statistical Sciences' },
    { code: 'EE', name: 'Electrical Engineering', dept: 'School of Computing and Electrical Engineering' },
    { code: 'VL', name: 'VLSI', dept: 'School of Computing and Electrical Engineering' },
    { code: 'EP', name: 'Engineering Physics', dept: 'School of Engineering' },
    { code: 'ME', name: 'Mechanical Engineering', dept: 'School of Engineering' },
    { code: 'MS', name: 'Materials Science and Engineering', dept: 'School of Engineering' },
    { code: 'GE', name: 'General Engineering', dept: 'School of Engineering' },
    { code: 'BS', name: 'Biological Sciences and Engineering', dept: 'School of Engineering' },
    { code: 'BE', name: 'Bio Engineering', dept: 'School of Engineering' },
    { code: 'CE', name: 'Civil Engineering', dept: 'School of Engineering' },
  ];

  const internshipVariants = [
    { type: 'Onsite', credits: 9 },
    { type: 'Remote', credits: 6 },
  ];

  let added = 0;
  let skipped = 0;

  for (const branch of branches) {
    for (const variant of internshipVariants) {
      const courseCode = `${branch.code}-399P${variant.type === 'Remote' ? 'R' : ''}`;
      const courseName = `6-Month ${variant.type} Internship (${branch.name})`;

      // Check if course already exists
      const existing = await prisma.course.findUnique({
        where: {
          code: courseCode,
        }
      });

      if (existing) {
        console.log(`⏭️  Skipped: ${courseCode} (${variant.credits} cr) - already exists`);
        skipped++;
        continue;
      }

      // Create the course
      const course = await prisma.course.create({
        data: {
          code: courseCode,
          name: courseName,
          credits: variant.credits,
          department: branch.dept,
          level: 300,
          isPassFailEligible: true,
          description: `6-month ${variant.type.toLowerCase()} internship for ${branch.name} students. Counts as ${variant.credits} Pass/Fail Free Elective credits.`,
        }
      });

      // Create branch mapping for FE category
      await prisma.courseBranchMapping.create({
        data: {
          courseId: course.id,
          branch: branch.code,
          courseCategory: 'FE',
          isRequired: false,
        }
      });

      console.log(`✅ Added: ${courseCode} - ${courseName} (${variant.credits} cr P/F FE)`);
      added++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`✅ Added: ${added} courses`);
  console.log(`⏭️  Skipped: ${skipped} courses (already exist)`);
  console.log('='.repeat(70) + '\n');

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(console.error);
