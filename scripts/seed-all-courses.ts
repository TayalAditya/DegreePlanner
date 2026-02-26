import prisma from "@/lib/prisma";

// Sample structured course data extracted from the PDF
// In production, you would parse the PDF more thoroughly
const courses = [
  // Computer Science Courses
  {
    code: "CS-101",
    name: "Introduction to Programming",
    credits: 3,
    department: "CSE",
    level: 100,
    description: "Fundamentals of computer programming and algorithms",
    offeredInFall: true,
    offeredInSpring: true,
    offeredInSummer: false,
  },
  {
    code: "CS-201",
    name: "Computer Organization",
    credits: 4,
    department: "CSE",
    level: 200,
    description: "Computer architecture and organization fundamentals",
    offeredInFall: true,
    offeredInSpring: false,
    offeredInSummer: false,
  },
  {
    code: "CS-202",
    name: "Data Structures and Algorithms",
    credits: 4,
    department: "CSE",
    level: 200,
    description: "Data structures, algorithms, and their analysis",
    offeredInFall: true,
    offeredInSpring: true,
    offeredInSummer: false,
  },
  {
    code: "CS-203",
    name: "Discrete Structures",
    credits: 4,
    department: "CSE",
    level: 200,
    description: "Discrete mathematics for computer science",
    offeredInFall: true,
    offeredInSpring: false,
    offeredInSummer: false,
  },
  {
    code: "CS-204",
    name: "Introduction to Database",
    credits: 4,
    department: "CSE",
    level: 200,
    description: "Database design and management",
    offeredInFall: false,
    offeredInSpring: true,
    offeredInSummer: false,
  },
  // Mathematics Courses (Institute Core)
  {
    code: "MA-101",
    name: "Calculus I",
    credits: 4,
    department: "Mathematics",
    level: 100,
    description: "Single variable calculus",
    offeredInFall: true,
    offeredInSpring: true,
    offeredInSummer: true,
  },
  {
    code: "MA-102",
    name: "Linear Algebra",
    credits: 4,
    department: "Mathematics",
    level: 100,
    description: "Linear algebra and matrix theory",
    offeredInFall: true,
    offeredInSpring: true,
    offeredInSummer: true,
  },
  {
    code: "MA-201",
    name: "Probability and Statistics",
    credits: 4,
    department: "Mathematics",
    level: 200,
    description: "Probability theory and statistical methods",
    offeredInFall: true,
    offeredInSpring: true,
    offeredInSummer: false,
  },
  // Physics Courses
  {
    code: "PH-101",
    name: "Classical Mechanics",
    credits: 4,
    department: "Physics",
    level: 100,
    description: "Mechanics and motion",
    offeredInFall: true,
    offeredInSpring: false,
    offeredInSummer: false,
  },
  {
    code: "PH-102",
    name: "Electricity and Magnetism",
    credits: 4,
    department: "Physics",
    level: 100,
    description: "Electromagnetic theory",
    offeredInFall: false,
    offeredInSpring: true,
    offeredInSummer: false,
  },
  // Chemistry Courses
  {
    code: "CH-101",
    name: "General Chemistry",
    credits: 4,
    department: "Chemistry",
    level: 100,
    description: "Fundamental chemistry concepts",
    offeredInFall: true,
    offeredInSpring: true,
    offeredInSummer: false,
  },
  // Humanities Courses
  {
    code: "HS-101",
    name: "English Communication",
    credits: 3,
    department: "Humanities",
    level: 100,
    description: "Effective written and oral communication",
    offeredInFall: true,
    offeredInSpring: true,
    offeredInSummer: true,
  },
  {
    code: "HS-102",
    name: "History and Society",
    credits: 3,
    department: "Humanities",
    level: 100,
    description: "Indian history and social context",
    offeredInFall: false,
    offeredInSpring: true,
    offeredInSummer: false,
  },
];

async function seedCourses() {
  console.log("🌱 Starting course seeding...");
  console.log(`📚 Found ${courses.length} courses to seed\n`);

  try {
    for (const course of courses) {
      const existingCourse = await prisma.course.findUnique({
        where: { code: course.code },
      });

      if (existingCourse) {
        console.log(`✓ Course already exists: ${course.code}`);
      } else {
        const created = await prisma.course.create({
          data: course,
        });
        console.log(
          `✓ Created: ${created.code} - ${created.name} (${created.credits} credits)`
        );
      }
    }

    console.log("\n✅ Course seeding completed successfully!");
    console.log(`📊 Total courses in database: ${await prisma.course.count()}`);
  } catch (error) {
    console.error("❌ Error seeding courses:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedCourses().catch((e) => {
  console.error(e);
  process.exit(1);
});
