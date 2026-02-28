import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔄 Fixing internship course codes...\n');

  // Delete incorrect 399PR courses
  console.log('Deleting 399PR courses...');
  const deleted = await prisma.course.deleteMany({
    where: {
      code: {
        endsWith: '-399PR'
      }
    }
  });
  console.log(`✅ Deleted ${deleted.count} 399PR courses\n`);

  // Add correct 396P courses
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

  console.log('Adding 396P courses for remote internships...');
  let added = 0;

  for (const branch of branches) {
    const courseCode = `${branch.code}-396P`;
    const courseName = `6-Month Remote Internship (${branch.name})`;

    const existing = await prisma.course.findUnique({
      where: { code: courseCode }
    });

    if (existing) {
      console.log(`⏭️  Skipped: ${courseCode} - already exists`);
      continue;
    }

    const course = await prisma.course.create({
      data: {
        code: courseCode,
        name: courseName,
        credits: 6,
        department: branch.dept,
        level: 300,
        isPassFailEligible: true,
        description: `6-month remote internship for ${branch.name} students. Counts as 6 Pass/Fail Free Elective credits.`,
      }
    });

    await prisma.courseBranchMapping.create({
      data: {
        courseId: course.id,
        branch: branch.code,
        courseCategory: 'FE',
        isRequired: false,
      }
    });

    console.log(`✅ Added: ${courseCode} - ${courseName} (6 cr P/F FE)`);
    added++;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`✅ Fixed internship courses:`);
  console.log(`   - 399P (Onsite): 9 credits P/F FE`);
  console.log(`   - 396P (Remote): 6 credits P/F FE`);
  console.log(`   Added: ${added} new 396P courses`);
  console.log('='.repeat(70) + '\n');

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(console.error);
