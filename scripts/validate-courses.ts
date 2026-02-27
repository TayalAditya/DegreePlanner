import * as fs from 'fs';
import * as path from 'path';

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
  offerings: {
    BE: boolean;
    CE: boolean;
    CS: boolean;
    DSE: boolean;
    EE: boolean;
    EP: boolean;
    ME: boolean;
  };
  category: string;
}

interface ValidationReport {
  generatedAt: string;
  totalCoursesValidated: number;
  validationResults: {
    codeValidation: {
      valid: number;
      invalid: number;
      issues: Array<{ code: string; issue: string }>;
    };
    nameValidation: {
      valid: number;
      potentialTypos: Array<{ code: string; name: string; suggestion: string }>;
    };
    creditValidation: {
      valid: number;
      mismatch: Array<{ code: string; formula: number; stated: number }>;
    };
    instructorValidation: {
      complete: number;
      missing: Array<{ code: string; semester: number }>;
      hasMultiple: number;
    };
  };
  summary: {
    overallStatus: 'PASS' | 'WARNING' | 'FAIL';
    score: number;
    recommendations: string[];
  };
}

function validateCourseCode(code: string): { valid: boolean; issue?: string } {
  // Expected formats:
  // AA-123, AA-123P, AA123, AA123P, DP-301P
  const patterns = [
    /^[A-Z]{2}-\d{3}P?$/,  // CS-208, IC-102P
    /^[A-Z]{2}\d{3}P?$/,   // CS208, IC102P
    /^[A-Z]{2}-\d{3}P$/,   // DP-301P
  ];

  if (!code || typeof code !== 'string') {
    return { valid: false, issue: 'Empty or invalid code' };
  }

  const match = patterns.some(p => p.test(code.toUpperCase()));
  if (!match) {
    return { valid: false, issue: `Invalid format: "${code}"` };
  }

  // Check for common typos
  if (code.includes('  ')) {
    return { valid: false, issue: 'Double space in code' };
  }

  if (code.match(/^I-C-/)) {
    return { valid: false, issue: 'Should be IC-, not I-C-' };
  }

  return { valid: true };
}

function validateCourseName(name: string): { valid: boolean; suggestion?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false };
  }

  // Check for common typos
  const typos: { [key: string]: string } = {
    advacned: 'Advanced',
    advacnced: 'Advanced',
    technolgy: 'Technology',
    enginnering: 'Engineering',
    intelligance: 'Intelligence',
    vizualisation: 'Visualization',
    vizualization: 'Visualization',
  };

  const lowerName = name.toLowerCase();
  for (const [typo, correction] of Object.entries(typos)) {
    if (lowerName.includes(typo)) {
      return {
        valid: false,
        suggestion: `"${name}" → "${name.replace(new RegExp(typo, 'gi'), correction)}"`,
      };
    }
  }

  // Check length
  if (name.length > 100) {
    return { valid: false, suggestion: 'Name exceeds 100 characters' };
  }

  return { valid: true };
}

function validateCredits(breakdown: { lecture: number; tutorial: number; practical: number; total: number }): { valid: boolean; formulaResult?: number } {
  if (!breakdown) return { valid: false };

  const calculated = breakdown.lecture + (breakdown.tutorial * 0.5) + breakdown.practical;
  const stated = breakdown.total;

  // Allow for small floating point differences
  if (Math.abs(calculated - stated) > 0.5) {
    return { valid: false, formulaResult: calculated };
  }

  return { valid: true };
}

function validateInstructor(instructor: string, courseCode: string): { valid: boolean; hasMultiple: boolean } {
  const hasMultiple = instructor.includes(',');
  const valid = instructor.length > 0 && instructor !== 'N/A' && !instructor.match(/^[a-z]+$/);

  return { valid, hasMultiple };
}

async function main() {
  const extractedPath = path.join(process.cwd(), 'extracted-courses.json');

  if (!fs.existsSync(extractedPath)) {
    console.error(`❌ Extracted courses file not found: ${extractedPath}`);
    console.log('\nRun extraction script first: npx ts-node scripts/extract-excel-courses.ts');
    process.exit(1);
  }

  console.log(`📖 Loading extracted courses from: ${extractedPath}\n`);

  const extractedData = JSON.parse(fs.readFileSync(extractedPath, 'utf-8'));
  const allCourses: CourseData[] = [];

  // Flatten all courses from semesters
  for (const [sem, courses] of Object.entries(extractedData.bySemester)) {
    allCourses.push(...((courses as CourseData[]) || []));
  }

  console.log(`🔍 Validating ${allCourses.length} courses...\n`);

  const report: ValidationReport = {
    generatedAt: new Date().toISOString(),
    totalCoursesValidated: allCourses.length,
    validationResults: {
      codeValidation: { valid: 0, invalid: 0, issues: [] },
      nameValidation: { valid: 0, potentialTypos: [] },
      creditValidation: { valid: 0, mismatch: [] },
      instructorValidation: { complete: 0, missing: [], hasMultiple: 0 },
    },
    summary: { overallStatus: 'PASS', score: 100, recommendations: [] },
  };

  // Validate each course
  allCourses.forEach(course => {
    // Code validation
    const codeValidation = validateCourseCode(course.courseCode);
    if (codeValidation.valid) {
      report.validationResults.codeValidation.valid++;
    } else {
      report.validationResults.codeValidation.invalid++;
      report.validationResults.codeValidation.issues.push({
        code: course.courseCode,
        issue: codeValidation.issue || 'Unknown',
      });
    }

    // Name validation
    const nameValidation = validateCourseName(course.courseName);
    if (nameValidation.valid) {
      report.validationResults.nameValidation.valid++;
    } else {
      report.validationResults.nameValidation.potentialTypos.push({
        code: course.courseCode,
        name: course.courseName,
        suggestion: nameValidation.suggestion || 'Check spelling',
      });
    }

    // Credit validation
    const creditValidation = validateCredits(course.creditBreakdown);
    if (creditValidation.valid) {
      report.validationResults.creditValidation.valid++;
    } else {
      report.validationResults.creditValidation.mismatch.push({
        code: course.courseCode,
        formula: creditValidation.formulaResult || 0,
        stated: course.creditBreakdown.total,
      });
    }

    // Instructor validation
    const instructorValidation = validateInstructor(course.instructor, course.courseCode);
    if (instructorValidation.valid) {
      report.validationResults.instructorValidation.complete++;
    } else {
      report.validationResults.instructorValidation.missing.push({
        code: course.courseCode,
        semester: course.semester,
      });
    }

    if (instructorValidation.hasMultiple) {
      report.validationResults.instructorValidation.hasMultiple++;
    }
  });

  // Calculate overall score
  const codeScore = (report.validationResults.codeValidation.valid / allCourses.length) * 25;
  const nameScore = (report.validationResults.nameValidation.valid / allCourses.length) * 25;
  const creditScore = (report.validationResults.creditValidation.valid / allCourses.length) * 25;
  const instructorScore = (report.validationResults.instructorValidation.complete / allCourses.length) * 25;

  report.summary.score = Math.round(codeScore + nameScore + creditScore + instructorScore);

  // Determine overall status
  if (report.summary.score === 100) {
    report.summary.overallStatus = 'PASS';
  } else if (report.summary.score >= 80) {
    report.summary.overallStatus = 'WARNING';
  } else {
    report.summary.overallStatus = 'FAIL';
  }

  // Add recommendations
  if (report.validationResults.codeValidation.invalid > 0) {
    report.summary.recommendations.push(
      `Fix ${report.validationResults.codeValidation.invalid} invalid course codes`
    );
  }

  if (report.validationResults.nameValidation.potentialTypos.length > 0) {
    report.summary.recommendations.push(
      `Correct ${report.validationResults.nameValidation.potentialTypos.length} potential spelling errors`
    );
  }

  if (report.validationResults.creditValidation.mismatch.length > 0) {
    report.summary.recommendations.push(
      `Verify ${report.validationResults.creditValidation.mismatch.length} credit mismatches`
    );
  }

  if (report.validationResults.instructorValidation.missing.length > 0) {
    report.summary.recommendations.push(
      `Add instructor names for ${report.validationResults.instructorValidation.missing.length} courses`
    );
  }

  // Save report
  const reportPath = path.join(process.cwd(), 'course-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n📊 VALIDATION SUMMARY\n');
  console.log(`Overall Status: ${report.summary.overallStatus} (${report.summary.score}/100)`);
  console.log(`\nValidation Results:`);
  console.log(`✓ Course Codes:   ${report.validationResults.codeValidation.valid}/${allCourses.length} valid`);
  console.log(`✓ Course Names:   ${report.validationResults.nameValidation.valid}/${allCourses.length} correct`);
  console.log(`✓ Credits:        ${report.validationResults.creditValidation.valid}/${allCourses.length} valid`);
  console.log(`✓ Instructors:    ${report.validationResults.instructorValidation.complete}/${allCourses.length} complete`);
  console.log(`  └─ Multiple Instructors: ${report.validationResults.instructorValidation.hasMultiple}`);

  // Show issues
  if (report.validationResults.codeValidation.issues.length > 0) {
    console.log(`\n⚠️  Code Issues (${report.validationResults.codeValidation.issues.length}):`);
    report.validationResults.codeValidation.issues.slice(0, 5).forEach(issue => {
      console.log(`  - ${issue.code}: ${issue.issue}`);
    });
    if (report.validationResults.codeValidation.issues.length > 5) {
      console.log(`  ... and ${report.validationResults.codeValidation.issues.length - 5} more`);
    }
  }

  if (report.validationResults.nameValidation.potentialTypos.length > 0) {
    console.log(`\n⚠️  Spelling Issues (${report.validationResults.nameValidation.potentialTypos.length}):`);
    report.validationResults.nameValidation.potentialTypos.slice(0, 5).forEach(typo => {
      console.log(`  - ${typo.code}: ${typo.suggestion}`);
    });
    if (report.validationResults.nameValidation.potentialTypos.length > 5) {
      console.log(`  ... and ${report.validationResults.nameValidation.potentialTypos.length - 5} more`);
    }
  }

  if (report.validationResults.creditValidation.mismatch.length > 0) {
    console.log(`\n⚠️  Credit Mismatches (${report.validationResults.creditValidation.mismatch.length}):`);
    report.validationResults.creditValidation.mismatch.slice(0, 5).forEach(mismatch => {
      console.log(`  - ${mismatch.code}: Formula=${mismatch.formula} vs Stated=${mismatch.stated}`);
    });
    if (report.validationResults.creditValidation.mismatch.length > 5) {
      console.log(`  ... and ${report.validationResults.creditValidation.mismatch.length - 5} more`);
    }
  }

  if (report.validationResults.instructorValidation.missing.length > 0) {
    console.log(`\n⚠️  Missing Instructors (${report.validationResults.instructorValidation.missing.length}):`);
    report.validationResults.instructorValidation.missing.slice(0, 5).forEach(missing => {
      console.log(`  - ${missing.code} (Sem ${missing.semester})`);
    });
    if (report.validationResults.instructorValidation.missing.length > 5) {
      console.log(`  ... and ${report.validationResults.instructorValidation.missing.length - 5} more`);
    }
  }

  // Show recommendations
  if (report.summary.recommendations.length > 0) {
    console.log(`\n💡 Recommendations:`);
    report.summary.recommendations.forEach(rec => {
      console.log(`  - ${rec}`);
    });
  }

  console.log(`\n✓ Validation report saved to: ${reportPath}\n`);
  console.log('✅ Validation complete!');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
