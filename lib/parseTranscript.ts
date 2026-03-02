export interface DetectedCourse {
  rawCode: string;
  rawName?: string;
  detectedSemester?: number;
  detectedGrade?: string;
  detectedCredits?: number;
}

// Grade tokens we recognise from Samarth transcripts
const GRADE_RE = /\b(A\+|A|B\+|B|C|D|F|S|X|W|EX|AB)\b/;

// Course code pattern: 2-4 uppercase letters, optional dash, 3 digits + optional letter suffix.
// Uses (?![A-Z0-9]) instead of \b at the end so Samarth-style "IC-112_New" still matches —
// underscore is a word char so \b fails after digits when followed by _.
const CODE_RE = /\b([A-Z]{2,4})\s*-?\s*(\d{3}[A-Z]?)(?![A-Z0-9])/g;

// Semester header patterns
const SEM_HEADER_RE =
  /(?:semester|sem(?:ester)?)\s*[-:.]?\s*(\d)/i;
const ODD_SEM_RE = /\bODD\s+SEMESTER\b/i;
const EVEN_SEM_RE = /\bEVEN\s+SEMESTER\b/i;

// Credits pattern: a standalone decimal or integer (1–9) near a course row
const CREDITS_RE = /\b([1-9](?:\.\d)?)\b/;

/**
 * Parse raw OCR/PDF text and return a deduped list of detected courses.
 * Courses are grouped under the nearest preceding semester header.
 */
export function parseTranscriptText(text: string): DetectedCourse[] {
  const lines = text.split(/\r?\n/);
  const results: DetectedCourse[] = [];

  let currentSemester: number | undefined;

  // Track duplicates by "CODE|semester" to handle multi-screenshot uploads
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── Semester header detection ──────────────────────────────────────────
    const semMatch = SEM_HEADER_RE.exec(line);
    if (semMatch) {
      currentSemester = parseInt(semMatch[1], 10);
      continue;
    }
    if (ODD_SEM_RE.test(line)) {
      // We can't know which odd semester without context — leave ambiguous
      // (user will confirm in modal). Reset to undefined so modal asks.
      currentSemester = undefined;
      continue;
    }
    if (EVEN_SEM_RE.test(line)) {
      currentSemester = undefined;
      continue;
    }

    // ── Course code detection ──────────────────────────────────────────────
    CODE_RE.lastIndex = 0;
    let codeMatch: RegExpExecArray | null;

    while ((codeMatch = CODE_RE.exec(line)) !== null) {
      const rawCode = `${codeMatch[1]}-${codeMatch[2]}`;

      // Skip codes that look like years (e.g. "20-231") or roll numbers
      if (/^\d{2}-\d{3}$/.test(rawCode)) continue;
      // Skip page numbers / section headers that aren't real course codes
      if (["ODD-SEM", "EVE-SEM"].includes(rawCode.toUpperCase())) continue;

      const dupKey = `${rawCode.toUpperCase()}|${currentSemester ?? "?"}`;
      if (seen.has(dupKey)) continue;
      seen.add(dupKey);

      // Extract grade from same line (or next line as fallback)
      const gradeSource = line + " " + (lines[i + 1] ?? "");
      const gradeMatch = GRADE_RE.exec(gradeSource);
      const detectedGrade = gradeMatch?.[1];

      // Extract credits — look for a standalone number 1-9 in the line
      const creditsMatch = CREDITS_RE.exec(line);
      const detectedCredits = creditsMatch ? parseFloat(creditsMatch[1]) : undefined;

      // Try to extract course name: text between the code and the grade/credits
      // Take the slice of the line after the full code match, trim numbers & grades
      const afterCode = line.slice((codeMatch.index ?? 0) + codeMatch[0].length);
      const rawName = afterCode
        .replace(/\d+(\.\d+)?/g, "")   // remove numbers
        .replace(GRADE_RE, "")          // remove grade token
        .replace(/[^A-Za-z\s]/g, " ")  // remove punctuation
        .trim()
        .replace(/\s+/g, " ") || undefined;

      results.push({
        rawCode,
        rawName: rawName && rawName.length > 2 ? rawName : undefined,
        detectedSemester: currentSemester,
        detectedGrade,
        detectedCredits,
      });
    }
  }

  return results;
}

/** Normalise a course code for matching: "MA-222" → "MA222" */
export function normalizeCourseCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
