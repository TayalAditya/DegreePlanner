import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface CourseData {
  courseCode: string;
  courseName: string;
  credits: number;
  creditBreakdown: {
    lecture: number;
    tutorial: number;
    practical: number;
    total: number;
  };
  instructor: string;
  semester: number;
  offerings: { [key: string]: boolean };
  category: string;
}

interface CorrectedCourse extends CourseData {
  originalCode: string;
  codeFixed: boolean;
}

function normalizeCourseCode(code: string): string {
  // Convert spaces to hyphens: "IC 102P" -> "IC-102P"
  code = code.replace(/\s+/g, '-');

  // Fix common patterns
  code = code.replace(/^IC(\d)/g, 'IC-$1'); // IC123 -> IC-123
  code = code.replace(/^CS(\d)/g, 'CS-$1'); // CS123 -> CS-123
  code = code.replace(/^BE(\d)/g, 'BE-$1'); // BE123 -> BE-123
  code = code.replace(/^CE(\d)/g, 'CE-$1'); // CE123 -> CE-123
  code = code.replace(/^EE(\d)/g, 'EE-$1'); // EE123 -> EE-123
  code = code.replace(/^ME(\d)/g, 'ME-$1'); // ME123 -> ME-123
  code = code.replace(/^HS(\d)/g, 'HS-$1'); // HS123 -> HS-123
  code = code.replace(/^PH(\d)/g, 'PH-$1'); // PH123 -> PH-123
  code = code.replace(/^EP(\d)/g, 'EP-$1'); // EP123 -> EP-123
  code = code.replace(/^IK(\d)/g, 'IK-$1'); // IK123 -> IK-123
  code = code.replace(/^MA(\d)/g, 'MA-$1'); // MA123 -> MA-123
  code = code.replace(/^DP(\d)/g, 'DP-$1'); // DP123 -> DP-123

  // Remove underscores and extra suffixes: "CS514_1" -> "CS-514"
  code = code.replace(/_\d+$/, '');

  // Fix xxx patterns (placeholders): "ME-xxx" -> "ME-201", "EE-XXX" -> "EE-301"
  code = code.replace(/[xX]{2,}/, '000'); // Placeholder for unknown

  // Remove duplicate hyphens
  code = code.replace(/--+/g, '-');

  return code.toUpperCase();
}

function validateCourseCode(code: string): boolean {
  // Valid pattern: XX-NNN[P]? or XX-NNN-N? (e.g., CS-208, IC-102P, IK591-3)
  const pattern = /^[A-Z]{2}-\d{3}[P]?(-\d)?$/;
  return pattern.test(code);
}

async function fixCourseCodesInExtraction() {
  try {
    const extractionFile = path.join(__dirname, '..', 'extracted-courses.json');
    console.log('📖 Reading extracted courses from:', extractionFile);

    const rawData = fs.readFileSync(extractionFile, 'utf-8');
    const extraction = JSON.parse(rawData) as {
      extractedAt: string;
      bySemester: { [key: string]: CourseData[] };
      coursesExtracted: number;
    };

    const fixedCoursess: { [key: string]: CorrectedCourse[] } = {};
    let totalFixed = 0;
    let totalAlreadyValid = 0;
    const issues: Array<{
      semester: string;
      originalCode: string;
      fixedCode: string;
      isValid: boolean;
    }> = [];

    // Process each semester
    for (const [sem, courses] of Object.entries(extraction.bySemester)) {
      fixedCoursess[sem] = [];

      for (const course of courses) {
        const originalCode = course.courseCode;
        const normalizedCode = normalizeCourseCode(originalCode);
        const isValid = validateCourseCode(normalizedCode);

        if (originalCode !== normalizedCode) {
          totalFixed++;
          issues.push({
            semester: sem,
            originalCode,
            fixedCode: normalizedCode,
            isValid,
          });
        } else {
          totalAlreadyValid++;
        }

        const fixed: CorrectedCourse = {
          ...course,
          courseCode: normalizedCode,
          originalCode,
          codeFixed: originalCode !== normalizedCode,
        };

        fixedCoursess[sem].push(fixed);
      }
    }

    // Save corrected courses
    const outputFile = path.join(__dirname, '..', 'fixed-courses.json');
    fs.writeFileSync(
      outputFile,
      JSON.stringify(
        {
          fixedAt: new Date().toISOString(),
          coursesProcessed: extraction.coursesExtracted,
          coursesCorrected: totalFixed,
          coursesAlreadyValid: totalAlreadyValid,
          bySemester: fixedCoursess,
          issues,
        },
        null,
        2
      )
    );

    console.log('\n✅ COURSE CODE FIXES SUMMARY\n');
    console.log(`Total courses processed: ${extraction.coursesExtracted}`);
    console.log(`✓ Courses fixed: ${totalFixed}`);
    console.log(`✓ Courses already valid: ${totalAlreadyValid}`);
    console.log('\n📊 Issues by type:');
    console.log(`  Code format fixes: ${issues.filter((i) => i.isValid).length}`);
    console.log(`  Still invalid: ${issues.filter((i) => !i.isValid).length}`);

    // Sample issues
    if (issues.length > 0) {
      console.log('\n🔍 Sample fixes:');
      issues.slice(0, 10).forEach((issue) => {
        const status = issue.isValid ? '✓' : '✗';
        console.log(
          `  ${status} Sem ${issue.semester}: "${issue.originalCode}" -> "${issue.fixedCode}"`
        );
      });
      if (issues.length > 10) {
        console.log(`  ... and ${issues.length - 10} more`);
      }
    }

    console.log(`\n📁 Fixed courses saved to: fixed-courses.json`);
  } catch (error) {
    console.error('❌ Error fixing course codes:', error);
    process.exit(1);
  }
}

fixCourseCodesInExtraction();
