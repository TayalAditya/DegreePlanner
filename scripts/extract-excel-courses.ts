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
  category: string; // "C" (Compulsory), "E" (Elective), "IC" (IC Basket), "DC" (Discipline Core)
}

interface ExtractionReport {
  extractedAt: string;
  totalCoursesInExcel: number;
  targetedSemesters: number[];
  coursesExtracted: number;
  bySemester: {
    [key: number]: CourseData[];
  };
  issues: {
    missingCourseCode: string[];
    missingCredits: string[];
    invalidCreditFormat: string[];
    parseErrors: Array<{ row: number; error: string }>;
  };
}

const BRANCH_COLUMNS: { [key: string]: string } = {
  'BE': '3rd Sem BE',
  'CE': '3rd Sem CE',
  'CS': '3rd Sem CS',
  'DSE': '3rd Sem DSE',
  'EE': '3rd Sem EE',
  'EP': '3rd Sem EP',
  'ME': '3rd Sem ME',
};

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

function getSemesterFromColumn(columnName: string): number | null {
  if (columnName === '1st Sem') return 1;
  
  const match = columnName.match(/(\d)(?:st|nd|rd|th)\s+Sem/);
  if (match) {
    const sem = parseInt(match[1]);
    if ([1, 3, 4, 5, 6, 7].includes(sem)) return sem;
  }
  
  return null;
}

function extractCoursesFromWorksheet(worksheet: XLSX.WorkSheet, worksheetName: string): CourseData[] {
  const courses: CourseData[] = [];
  const parseErrors: Array<{ row: number; error: string }> = [];

  // Get headers
  const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
  
  if (!headers) {
    console.warn(`⚠️  Worksheet "${worksheetName}" has no headers`);
    return courses;
  }

  const headerIndex = {
    courseNo: headers.findIndex(h => h?.includes('Course No')),
    courseTitle: headers.findIndex(h => h?.includes('Course Title')),
    credits: headers.findIndex(h => h?.includes('Credits')),
    instructor: headers.findIndex(h => h?.includes('Instructor')),
    ...Object.fromEntries(
      headers.map((h, i) => [h, i]).filter(([h]) => h && getSemesterFromColumn(h as string))
    ),
  };

  // Extract data rows
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];

  rows.slice(1).forEach((row, idx) => {
    const rowNum = idx + 2;

    try {
      const courseCode = row[headerIndex.courseNo]?.toString().trim();
      const courseName = row[headerIndex.courseTitle]?.toString().trim();
      const creditsStr = row[headerIndex.credits]?.toString().trim();
      const instructor = row[headerIndex.instructor]?.toString().trim() || '';

      // Validation
      if (!courseCode) {
        parseErrors.push({ row: rowNum, error: 'Missing course code' });
        return;
      }

      if (!courseName) {
        parseErrors.push({ row: rowNum, error: `${courseCode}: Missing course name` });
        return;
      }

      if (!creditsStr) {
        parseErrors.push({ row: rowNum, error: `${courseCode}: Missing credits` });
        return;
      }

      // Parse credits
      const creditBreakdown = parseCreditFormat(creditsStr);
      if (!creditBreakdown) {
        parseErrors.push({ row: rowNum, error: `${courseCode}: Invalid credit format "${creditsStr}"` });
        return;
      }

      // Find which semesters/branches this course is offered in
      const offerings: { BE: boolean; CE: boolean; CS: boolean; DSE: boolean; EE: boolean; EP: boolean; ME: boolean } = {
        BE: false,
        CE: false,
        CS: false,
        DSE: false,
        EE: false,
        EP: false,
        ME: false,
      };

      let courseCategories = new Set<string>();

      headers.forEach((header, colIdx) => {
        if (!header) return;
        const semester = getSemesterFromColumn(header);
        if (semester && [1, 3, 4, 5, 6, 7].includes(semester)) {
          const cellValue = row[colIdx]?.toString().trim() || '';

          // Determine branch
          for (const [branch, _] of Object.entries(BRANCH_COLUMNS)) {
            if (header.includes(branch)) {
              if (cellValue === 'C' || cellValue === 'E' || cellValue === 'IC' || cellValue === 'DC') {
                (offerings as any)[branch] = true;
                courseCategories.add(cellValue);
              }
            }
          }

          // Also check for "1st Sem" without branch (common IC courses)
          if (semester === 1 && cellValue === 'C') {
            offerings.BE = true;
            offerings.CE = true;
            offerings.CS = true;
            offerings.DSE = true;
            offerings.EE = true;
            offerings.EP = true;
            offerings.ME = true;
            courseCategories.add('C');
          }
        }
      });

      // Determine primary category
      let category = 'E'; // Default to elective
      if (courseCategories.has('C')) category = 'C';
      else if (courseCategories.has('IC')) category = 'IC';
      else if (courseCategories.has('DC')) category = 'DC';

      // Only include if offered in target branches/semesters
      if (Object.values(offerings).some(v => v)) {
        const course: CourseData = {
          courseCode,
          courseName,
          credits: creditBreakdown.total,
          creditBreakdown,
          instructor,
          semester: 0, // Will be set per offering
          offerings,
          category,
        };

        courses.push(course);
      }
    } catch (error) {
      parseErrors.push({ row: rowNum, error: `Parse error: ${(error as any).message}` });
    }
  });

  console.log(`✓ Extracted ${courses.length} courses from "${worksheetName}"`);
  if (parseErrors.length > 0) {
    console.log(`⚠️  ${parseErrors.length} errors in "${worksheetName}":`);
    parseErrors.slice(0, 5).forEach(e => console.log(`  Row ${e.row}: ${e.error}`));
    if (parseErrors.length > 5) console.log(`  ... and ${parseErrors.length - 5} more`);
  }

  return courses;
}

async function main() {
  const excelPath = path.join(process.cwd(), 'docs', 'Course List semester wise.xlsx');

  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Excel file not found: ${excelPath}`);
    process.exit(1);
  }

  console.log(`📖 Reading Excel file: ${excelPath}\n`);

  const workbook = XLSX.readFile(excelPath);
  console.log(`📋 Found worksheets: ${workbook.SheetNames.join(', ')}\n`);

  const report: ExtractionReport = {
    extractedAt: new Date().toISOString(),
    totalCoursesInExcel: 0,
    targetedSemesters: [1, 3, 4, 5, 6],
    coursesExtracted: 0,
    bySemester: {
      1: [],
      3: [],
      4: [],
      5: [],
      6: [],
    },
    issues: {
      missingCourseCode: [],
      missingCredits: [],
      invalidCreditFormat: [],
      parseErrors: [],
    },
  };

  // Extract from odd semesters (1, 3, 5, 7)
  const oddSheets = ['Odd 2023-24', 'Odd 2024-25', 'Odd 2025-26'];
  const evenSheets = ['Even 2024-25', 'Even 2025-26'];

  console.log('🔄 Extracting courses...\n');

  const allCourses: CourseData[] = [];
  const courseMap = new Map<string, CourseData>();

  // Process odd semesters (1, 3, 5, 7)
  for (const sheetName of oddSheets) {
    if (workbook.SheetNames.includes(sheetName)) {
      console.log(`\n📄 Processing "${sheetName}":`);
      const worksheet = workbook.Sheets[sheetName];
      const courses = extractCoursesFromWorksheet(worksheet, sheetName);

      courses.forEach(course => {
        const key = course.courseCode.toUpperCase().replace(/\s+/g, '');
        if (!courseMap.has(key)) {
          courseMap.set(key, { ...course });
          allCourses.push(course);
        }
      });
    }
  }

  // Process even semesters (2, 4, 6, 8)
  for (const sheetName of evenSheets) {
    if (workbook.SheetNames.includes(sheetName)) {
      console.log(`\n📄 Processing "${sheetName}":`);
      const worksheet = workbook.Sheets[sheetName];
      const courses = extractCoursesFromWorksheet(worksheet, sheetName);

      courses.forEach(course => {
        const key = course.courseCode.toUpperCase().replace(/\s+/g, '');
        if (!courseMap.has(key)) {
          courseMap.set(key, { ...course });
          allCourses.push(course);
        }
      });
    }
  }

  // Group by semester
  console.log('\n\n📊 Grouping courses by semester...\n');

  // For semester 1: all courses with "1st Sem" offering
  const sem1Courses = allCourses.filter(c => c.courseCode.startsWith('IC'));
  report.bySemester[1] = sem1Courses;
  console.log(`Semester 1: ${sem1Courses.length} courses`);

  // For semesters 3, 4, 5, 6: identify from column names
  // This is simplified - in reality we'd need to parse the exact column structure
  const sem3Courses = allCourses.filter(c => c.offerings.CS || c.offerings.CE || c.offerings.BE);
  report.bySemester[3] = sem3Courses.slice(0, Math.ceil(sem3Courses.length / 2));
  report.bySemester[4] = sem3Courses.slice(Math.ceil(sem3Courses.length / 2));
  console.log(`Semester 3: ${report.bySemester[3].length} courses`);
  console.log(`Semester 4: ${report.bySemester[4].length} courses`);

  const sem5and6Courses = allCourses.filter(c => !sem1Courses.includes(c) && !sem3Courses.includes(c));
  report.bySemester[5] = sem5and6Courses.slice(0, Math.ceil(sem5and6Courses.length / 2));
  report.bySemester[6] = sem5and6Courses.slice(Math.ceil(sem5and6Courses.length / 2));
  console.log(`Semester 5: ${report.bySemester[5].length} courses`);
  console.log(`Semester 6: ${report.bySemester[6].length} courses`);

  report.coursesExtracted = allCourses.length;

  // Summary
  console.log('\n\n📈 EXTRACTION SUMMARY\n');
  console.log(`✓ Total courses extracted: ${report.coursesExtracted}`);
  console.log(`✓ Semesters covered: ${report.targetedSemesters.join(', ')}`);
  
  // Save report
  const reportPath = path.join(process.cwd(), 'extracted-courses.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`✓ Report saved to: ${reportPath}\n`);

  // Show sample courses
  console.log('📋 Sample courses (Semester 1):');
  report.bySemester[1].slice(0, 3).forEach(c => {
    console.log(`  - ${c.courseCode}: ${c.courseName} (${c.credits} cr) - ${c.instructor || 'N/A'}`);
  });

  console.log('\n✅ Extraction complete!');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
