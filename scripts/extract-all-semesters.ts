import XLSX from 'xlsx';
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

interface ExtractionReport {
  extractedAt: string;
  totalCoursesExtracted: number;
  allSemesters: number[];
  coursesPerSemester: { [key: number]: number };
  bySemester: {
    [key: number]: CourseData[];
  };
  academicYears: string[];
  issues: {
    parseErrors: Array<{ sheet: string; row: number; error: string }>;
  };
}

function parseCreditFormat(creditStr: string): { lecture: number; tutorial: number; practical: number; total: number } | null {
  if (!creditStr) return null;

  const match = creditStr.toString().match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  return {
    lecture: parseFloat(match[1]),
    tutorial: parseFloat(match[2]),
    practical: parseFloat(match[3]),
    total: parseFloat(match[4]),
  };
}

function extractSemesterFromColumn(columnName: string): number | null {
  if (!columnName) return null;
  
  const lowerCol = columnName.toLowerCase();
  
  // Check for explicit semester patterns: "2nd Sem", "4th Sem", "8th Sem", etc.
  const semMatch = lowerCol.match(/(\d)(?:st|nd|rd|th)\s+sem/);
  if (semMatch) {
    const sem = parseInt(semMatch[1]);
    if (sem >= 1 && sem <= 8) return sem;
  }
  
  // Check for branch-specific patterns: "3rd Sem CS", "5th Sem BE", etc.
  const branchSemMatch = lowerCol.match(/(\d)(?:st|nd|rd|th)\s+sem\s+(?:be|ce|cs|dse|ee|ep|me)/);
  if (branchSemMatch) {
    const sem = parseInt(branchSemMatch[1]);
    if (sem >= 1 && sem <= 8) return sem;
  }

  return null;
}

function extractCoursesFromWorksheet(worksheet: XLSX.WorkSheet, worksheetName: string): CourseData[] {
  const courses: CourseData[] = [];
  const parseErrors: Array<{ row: number; error: string }> = [];

  // Get headers
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
  
  if (!rows || rows.length === 0) {
    console.warn(`⚠️  Worksheet "${worksheetName}" is empty`);
    return courses;
  }

  const headers = rows[0] as string[];
  
  const headerIndex = {
    courseNo: headers.findIndex(h => h?.toLowerCase().includes('course no') || h?.toLowerCase().includes('code')),
    courseTitle: headers.findIndex(h => h?.toLowerCase().includes('course title') || h?.toLowerCase().includes('name')),
    credits: headers.findIndex(h => h?.toLowerCase().includes('credit')),
    instructor: headers.findIndex(h => h?.toLowerCase().includes('instructor') || h?.toLowerCase().includes('faculty')),
  };

  // Find semester columns (1st, 2nd, 3rd, 4th, 5th, 6th, 7th, 8th Sem)
  const semesterColumns: { [sem: number]: { indices: number[]; column: string } } = {};
  
  headers.forEach((header, idx) => {
    const sem = extractSemesterFromColumn(header);
    if (sem && sem >= 1 && sem <= 8) {
      if (!semesterColumns[sem]) {
        semesterColumns[sem] = { indices: [], column: header };
      }
      semesterColumns[sem].indices.push(idx);
    }
  });

  console.log(`\n  Semesters found in "${worksheetName}":`, Object.keys(semesterColumns).map(k => parseInt(k)).sort((a, b) => a - b));

  // Extract data rows
  rows.slice(1).forEach((row, idx) => {
    const rowNum = idx + 2;

    try {
      const courseCode = row[headerIndex.courseNo]?.toString().trim();
      const courseName = row[headerIndex.courseTitle]?.toString().trim();
      const creditsStr = row[headerIndex.credits]?.toString().trim();
      const instructor = row[headerIndex.instructor]?.toString().trim() || '';

      // Validation
      if (!courseCode || courseCode === '') return;
      if (!courseName || courseName === '') return;
      if (!creditsStr || creditsStr === '') return;

      // Parse credits
      const creditBreakdown = parseCreditFormat(creditsStr);
      if (!creditBreakdown) {
        parseErrors.push({ row: rowNum, error: `${courseCode}: Invalid credit format "${creditsStr}"` });
        return;
      }

      // Find which semesters this course is offered in
      const offerings = {
        BE: false,
        CE: false,
        CS: false,
        DSE: false,
        EE: false,
        EP: false,
        ME: false,
      };

      // For each semester, check if course is offered
      for (const [semStr, semInfo] of Object.entries(semesterColumns)) {
        const sem = parseInt(semStr);
        
        // Check all indices for this semester
        for (const idx of semInfo.indices) {
          const cellValue = row[idx];
          if (cellValue && (cellValue === 'C' || cellValue === 'E' || cellValue === 'DC' || cellValue === 'IC')) {
            // Extract branch from header if possible
            const header = headers[idx] || '';
            const lowerHeader = header.toLowerCase();
            
            if (lowerHeader.includes('be')) offerings.BE = true;
            if (lowerHeader.includes('ce')) offerings.CE = true;
            if (lowerHeader.includes('cs')) offerings.CS = true;
            if (lowerHeader.includes('dse')) offerings.DSE = true;
            if (lowerHeader.includes('ee')) offerings.EE = true;
            if (lowerHeader.includes('ep')) offerings.EP = true;
            if (lowerHeader.includes('me')) offerings.ME = true;

            // Create course entry for this semester
            const course: CourseData = {
              courseCode,
              courseName,
              credits: creditBreakdown.total,
              creditBreakdown,
              instructor,
              semester: sem,
              offerings,
              category: cellValue,
            };

            courses.push(course);
          }
        }
      }
    } catch (error) {
      parseErrors.push({ row: rowNum, error: `Parse error: ${(error as any).message}` });
    }
  });

  console.log(`  ✓ Extracted ${courses.length} course-semester pairs from "${worksheetName}"`);
  if (parseErrors.length > 0) {
    console.log(`  ⚠️  ${parseErrors.length} errors`);
  }

  return courses;
}

async function main() {
  const excelPath = path.join(process.cwd(), 'docs', 'Course List semester wise.xlsx');

  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Excel file not found: ${excelPath}`);
    process.exit(1);
  }

  console.log(`📖 Reading Excel file: ${excelPath}`);

  const workbook = XLSX.readFile(excelPath);
  console.log(`📋 Found worksheets: ${workbook.SheetNames.join(', ')}\n`);

  const report: ExtractionReport = {
    extractedAt: new Date().toISOString(),
    totalCoursesExtracted: 0,
    allSemesters: [],
    coursesPerSemester: {},
    bySemester: {},
    academicYears: workbook.SheetNames.filter(name => name.includes('2023-24') || name.includes('2024-25') || name.includes('2025-26')),
    issues: {
      parseErrors: [],
    },
  };

  console.log('🔄 Extracting courses from all semesters...\n');

  const allCourses: CourseData[] = [];
  const semesterCourses: { [key: number]: CourseData[] } = {};

  // Initialize semester arrays
  for (let i = 1; i <= 8; i++) {
    semesterCourses[i] = [];
  }

  // Process all worksheets
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n📄 Processing "${sheetName}":`);
    const worksheet = workbook.Sheets[sheetName];
    const courses = extractCoursesFromWorksheet(worksheet, sheetName);

    // Group courses by semester
    courses.forEach(course => {
      const sem = course.semester;
      if (sem >= 1 && sem <= 8) {
        // Check if course already exists in this semester
        const exists = semesterCourses[sem].some(c => c.courseCode.toUpperCase() === course.courseCode.toUpperCase());
        if (!exists) {
          semesterCourses[sem].push(course);
        }
      }
    });

    allCourses.push(...courses);
  }

  // Build report
  console.log('\n\n📊 Summary by Semester:\n');
  let totalUniqueCourses = 0;

  for (let sem = 1; sem <= 8; sem++) {
    const count = semesterCourses[sem].length;
    if (count > 0) {
      report.bySemester[sem] = semesterCourses[sem];
      report.coursesPerSemester[sem] = count;
      report.allSemesters.push(sem);
      totalUniqueCourses += count;
      console.log(`  Semester ${sem}: ${count} courses`);
    }
  }

  report.totalCoursesExtracted = totalUniqueCourses;

  console.log(`\n✓ Total unique course-semester pairs: ${totalUniqueCourses}`);
  console.log(`✓ Semesters covered: ${report.allSemesters.join(', ')}`);
  console.log(`✓ Academic years: ${report.academicYears.join(', ')}`);

  // Save comprehensive report
  const reportPath = path.join(process.cwd(), 'extracted-courses-all-semesters.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ Detailed report saved: ${reportPath}\n`);

  // Show sample courses from each semester
  console.log('📋 Sample Courses:\n');
  report.allSemesters.slice(0, 3).forEach(sem => {
    console.log(`Semester ${sem}:`);
    report.bySemester[sem]?.slice(0, 3).forEach(c => {
      console.log(`  - ${c.courseCode}: ${c.courseName} (${c.credits} cr) by ${c.instructor || 'N/A'}`);
    });
  });

  console.log('\n✅ Extraction complete! All semesters (1-8) extracted.');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  console.error(error);
  process.exit(1);
});
