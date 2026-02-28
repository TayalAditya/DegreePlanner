import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CourseIssue {
  courseId: string;
  code: string;
  name: string;
  credits: number;
  issue: string;
  details?: string;
}

interface SemesterRestriction {
  courseId: string;
  code: string;
  name: string;
  offeredInFall: boolean;
  offeredInSpring: boolean;
  offeredInSummer: boolean;
  suggestedRestriction: "odd" | "even" | "both";
}

async function analyzeCourses() {
  console.log("🔍 Analyzing course catalog...\n");

  // Get all courses
  const courses = await prisma.course.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  console.log(`📊 Total active courses: ${courses.length}\n`);

  const issues: CourseIssue[] = [];
  const semesterRestrictions: SemesterRestriction[] = [];

  // Issue 1: Check for code/name/credit consistency
  console.log("=" .repeat(80));
  console.log("ISSUE 1: Checking course code/name/credit consistency");
  console.log("=" .repeat(80) + "\n");

  for (const course of courses) {
    // Check if course code matches naming convention
    const codePattern = /^([A-Z]{2,6})-?(\d{3}[A-Z]?)P?$/i;
    const match = course.code.match(codePattern);

    if (!match) {
      issues.push({
        courseId: course.id,
        code: course.code,
        name: course.name,
        credits: course.credits,
        issue: "INVALID_CODE_FORMAT",
        details: `Course code "${course.code}" doesn't match expected pattern (e.g., CS-101, IC-202P)`,
      });
    }

    // Check for suspicious names (with numbers, dots, etc.)
    const suspiciousPatterns = [
      /^\d+\s*[:.)\-]*/,  // Starts with number
      /\bP:\s*/,           // Contains "P:"
      /^\(\d+\)/,          // Starts with (number)
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(course.name)) {
        issues.push({
          courseId: course.id,
          code: course.code,
          name: course.name,
          credits: course.credits,
          issue: "SUSPICIOUS_NAME",
          details: `Course name appears to have extraction artifacts: "${course.name}"`,
        });
        break;
      }
    }

    // Check credits (should be between 0 and 12 typically)
    if (course.credits < 0 || course.credits > 12) {
      issues.push({
        courseId: course.id,
        code: course.code,
        name: course.name,
        credits: course.credits,
        issue: "UNUSUAL_CREDITS",
        details: `Credits (${course.credits}) outside typical range (0-12)`,
      });
    }

    // Check if credits are 0 (might be an error)
    if (course.credits === 0 && !course.code.includes("ISTP") && !course.code.includes("MTP")) {
      issues.push({
        courseId: course.id,
        code: course.code,
        name: course.name,
        credits: course.credits,
        issue: "ZERO_CREDITS",
        details: "Course has 0 credits (may be incorrect unless it's audit/seminar)",
      });
    }
  }

  // Issue 2: Check semester offerings
  console.log("=" .repeat(80));
  console.log("ISSUE 2: Checking semester offering restrictions");
  console.log("=" .repeat(80) + "\n");

  for (const course of courses) {
    const { offeredInFall, offeredInSpring, offeredInSummer } = course;

    // Skip courses offered in both Fall and Spring (they're flexible)
    if (offeredInFall && offeredInSpring) {
      continue; // This is fine - offered both semesters
    }

    // Skip courses not offered in either (might be special courses)
    if (!offeredInFall && !offeredInSpring) {
      continue;
    }

    // Fall only = odd semesters (1, 3, 5, 7)
    if (offeredInFall && !offeredInSpring) {
      semesterRestrictions.push({
        courseId: course.id,
        code: course.code,
        name: course.name,
        offeredInFall,
        offeredInSpring,
        offeredInSummer,
        suggestedRestriction: "odd",
      });
    }

    // Spring only = even semesters (2, 4, 6, 8)
    if (!offeredInFall && offeredInSpring) {
      semesterRestrictions.push({
        courseId: course.id,
        code: course.code,
        name: course.name,
        offeredInFall,
        offeredInSpring,
        offeredInSummer,
        suggestedRestriction: "even",
      });
    }
  }

  // Report findings
  console.log("\n📋 REPORT: COURSE DATA ISSUES\n");
  console.log("=" .repeat(80) + "\n");

  if (issues.length === 0) {
    console.log("✅ No course data issues found!\n");
  } else {
    console.log(`⚠️  Found ${issues.length} course data issues:\n`);

    const byType = issues.reduce((acc, issue) => {
      if (!acc[issue.issue]) acc[issue.issue] = [];
      acc[issue.issue].push(issue);
      return acc;
    }, {} as Record<string, CourseIssue[]>);

    for (const [issueType, courseIssues] of Object.entries(byType)) {
      console.log(`\n${issueType} (${courseIssues.length} courses):`);
      console.log("-".repeat(80));
      for (const issue of courseIssues.slice(0, 10)) { // Show first 10
        console.log(`  • ${issue.code} | ${issue.name.substring(0, 50)}... | ${issue.credits} cr`);
        console.log(`    ${issue.details}`);
      }
      if (courseIssues.length > 10) {
        console.log(`    ... and ${courseIssues.length - 10} more`);
      }
    }
  }

  console.log("\n" + "=".repeat(80) + "\n");
  console.log("📋 REPORT: SEMESTER RESTRICTION RECOMMENDATIONS\n");
  console.log("=" .repeat(80) + "\n");

  if (semesterRestrictions.length === 0) {
    console.log("ℹ️  No semester-specific courses found (all are offered in both semesters or neither)\n");
  } else {
    console.log(`📌 Found ${semesterRestrictions.length} courses with semester restrictions:\n`);

    const oddOnly = semesterRestrictions.filter((r) => r.suggestedRestriction === "odd");
    const evenOnly = semesterRestrictions.filter((r) => r.suggestedRestriction === "even");

    console.log(`\n🔴 ODD SEMESTER ONLY (Fall) - ${oddOnly.length} courses:`);
    console.log("   Should allow enrollment in semesters: 1, 3, 5, 7");
    console.log("-".repeat(80));
    for (const course of oddOnly.slice(0, 20)) {
      console.log(`  • ${course.code.padEnd(12)} | ${course.name.substring(0, 60)}`);
    }
    if (oddOnly.length > 20) {
      console.log(`    ... and ${oddOnly.length - 20} more`);
    }

    console.log(`\n🔵 EVEN SEMESTER ONLY (Spring) - ${evenOnly.length} courses:`);
    console.log("   Should allow enrollment in semesters: 2, 4, 6, 8");
    console.log("-".repeat(80));
    for (const course of evenOnly.slice(0, 20)) {
      console.log(`  • ${course.code.padEnd(12)} | ${course.name.substring(0, 60)}`);
    }
    if (evenOnly.length > 20) {
      console.log(`    ... and ${evenOnly.length - 20} more`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n💡 SUMMARY:");
  console.log(`   • Total issues found: ${issues.length}`);
  console.log(`   • Courses needing semester restriction: ${semesterRestrictions.length}`);
  console.log(`     - Odd semester only: ${semesterRestrictions.filter(r => r.suggestedRestriction === "odd").length}`);
  console.log(`     - Even semester only: ${semesterRestrictions.filter(r => r.suggestedRestriction === "even").length}`);
  console.log("\n" + "=".repeat(80) + "\n");

  // Save detailed report to JSON
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalCourses: courses.length,
      issuesFound: issues.length,
      coursesWithRestrictions: semesterRestrictions.length,
    },
    issues,
    semesterRestrictions,
  };

  const fs = await import("fs");
  const reportPath = "./reports/course-analysis-" + new Date().toISOString().replace(/:/g, "-") + ".json";
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}\n`);

  await prisma.$disconnect();
}

analyzeCourses().catch((error) => {
  console.error("❌ Error analyzing courses:", error);
  process.exit(1);
});
