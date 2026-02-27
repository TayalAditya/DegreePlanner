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
}

interface CreditsAnalysis {
  courseCode: string;
  courseName: string;
  lecture: number;
  tutorial: number;
  practical: number;
  statedCredit: number;
  formulaResult: number; // L + 0.5*T + P
  match: boolean;
  issue?: string;
}

async function analyzeCredits() {
  try {
    const extractionFile = path.join(__dirname, '..', 'extracted-courses.json');
    console.log('📖 Reading extracted courses...\n');

    const rawData = fs.readFileSync(extractionFile, 'utf-8');
    const extraction = JSON.parse(rawData) as {
      bySemester: { [key: string]: CourseData[] };
    };

    const analysis: CreditsAnalysis[] = [];
    let matchingCount = 0;
    let mismatchCount = 0;

    // Process each semester
    for (const courses of Object.values(extraction.bySemester)) {
      for (const course of courses) {
        const { lecture, tutorial, practical, total } = course.creditBreakdown;
        const formulaResult = lecture + tutorial * 0.5 + practical;

        // Allow for small floating point differences (0.1)
        const matches = Math.abs(formulaResult - total) < 0.1;

        if (matches) {
          matchingCount++;
        } else {
          mismatchCount++;
          analysis.push({
            courseCode: course.courseCode,
            courseName: course.courseName,
            lecture,
            tutorial,
            practical,
            statedCredit: total,
            formulaResult: Math.round(formulaResult * 10) / 10,
            match: false,
            issue: `L+0.5T+P = ${lecture}+0.5(${tutorial})+${practical} = ${formulaResult.toFixed(1)} ≠ ${total}`,
          });
        }
      }
    }

    // Save analysis
    const outputFile = path.join(__dirname, '..', 'credits-analysis.json');
    fs.writeFileSync(outputFile, JSON.stringify({ analysis, matchingCount, mismatchCount }, null, 2));

    console.log('✅ CREDITS VALIDATION ANALYSIS\n');
    console.log(`Total courses: ${matchingCount + mismatchCount}`);
    console.log(`✓ Credits match formula: ${matchingCount}`);
    console.log(`✗ Credits MISMATCH: ${mismatchCount}`);

    if (mismatchCount > 0) {
      console.log('\n🔍 Courses with credit mismatches:\n');
      analysis.slice(0, 15).forEach((item) => {
        console.log(`${item.courseCode}: ${item.courseName}`);
        console.log(`  Breakdown: L${item.lecture} T${item.tutorial} P${item.practical}`);
        console.log(`  Formula: ${item.formulaResult} vs Stated: ${item.statedCredit}`);
        console.log(`  ${item.issue}\n`);
      });

      if (mismatchCount > 15) {
        console.log(`... and ${mismatchCount - 15} more courses with mismatches\n`);
      }
    }

    console.log(`📁 Full analysis saved to: credits-analysis.json`);
  } catch (error) {
    console.error('❌ Error analyzing credits:', error);
    process.exit(1);
  }
}

analyzeCredits();
