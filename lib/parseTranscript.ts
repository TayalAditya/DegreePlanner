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
const CODE_RE = /\b([A-Z]{2,4})\s*-?\s*(\d{3}[A-Z]?)(?![A-Z0-9])/gi;

// Semester header patterns
const SEM_HEADER_RE =
  /(?:semester|sem(?:ester)?)\s*[-:.]?\s*(\d)/i;
const ODD_SEM_RE = /\bODD\s+SEMESTER\b/i;
const EVEN_SEM_RE = /\bEVEN\s+SEMESTER\b/i;
// Samarth tables often show term as "6 SEMESTER" (number before the word).
const SEM_INLINE_RE = /\b([1-8])\s*SEMESTER\b/i;

// Credits pattern: a standalone decimal or integer (1–9) near a course row
const CREDITS_RE = /\b([1-9](?:\.\d)?)\b/;

function normalizeTextForParsing(text: string): string {
  // Normalise line endings, and lightly stitch common OCR line breaks inside course codes.
  // This is especially common in screenshots where the "IC-" part wraps to the next line.
  const normalized = text.replace(/\r\n?/g, "\n");

  // Join: "IC-\n112" -> "IC-112" (keeps any suffix like "_New" on the following characters)
  // Also join: "IC\n112" -> "IC-112" (OCR sometimes drops the hyphen).
  return normalized
    // Convert "CS201(P)" -> "CS201P" so the main code regex can pick up the P suffix.
    .replace(/(\d{3}[A-Z]?)\s*\(\s*P\s*\)/gi, "$1P")
    .replace(/([A-Z]{2,4})\s*-\s*\n\s*(\d{3}[A-Z]?)/gi, "$1-$2")
    // Only stitch when the prefix is the *only* thing on its line (avoids "(icc)\n115" becoming "ICC-115").
    .replace(/(^|\n)\s*([A-Z]{2,4})\s*\n\s*(\d{3}[A-Z]?)/gim, (_m, start, prefix, digits) => (
      `${start}${prefix}-${digits}`
    ));
}

/**
 * Parse raw OCR/PDF text and return a deduped list of detected courses.
 * Courses are grouped under the nearest preceding semester header.
 */
export function parseTranscriptText(text: string): DetectedCourse[] {
  const lines = normalizeTextForParsing(text).split(/\n/);
  const results: DetectedCourse[] = [];

  let currentSemester: number | undefined;

  // Track duplicates by "CODE|semester" to handle multi-screenshot uploads
  const seen = new Set<string>();

  // Some OCR outputs split codes into fragments across nearby lines:
  //   "IC-" ... "(ICB)" ... "112_New"
  // Keep a short-lived pending prefix to reconstruct "IC-112" when we later see the digits token.
  let pendingPrefix: string | null = null;
  let pendingPrefixExpiresAt = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Semester header detection ──────────────────────────────────────────
    const semMatch = SEM_HEADER_RE.exec(line);
    if (semMatch) {
      currentSemester = parseInt(semMatch[1], 10);
    }
    if (ODD_SEM_RE.test(line)) {
      // We can't know which odd semester without context — leave ambiguous
      // (user will confirm in modal). Reset to undefined so modal asks.
      currentSemester = undefined;
    }
    if (EVEN_SEM_RE.test(line)) {
      currentSemester = undefined;
    }

    // ── Pending-prefix reconstruction (OCR tables) ─────────────────────────
    // If we see a standalone prefix like "IC-" or "CS-", keep it briefly.
    const prefixOnly = trimmed.match(/^([A-Z]{2,4})\s*-\s*$/i);
    if (prefixOnly) {
      pendingPrefix = prefixOnly[1].toUpperCase();
      pendingPrefixExpiresAt = i + 8;
      continue;
    }

    // If we have a pending prefix, and the current line begins with a 3-digit token (optionally with a suffix),
    // reconstruct the full code.
    let synthesizedCode: string | null = null;
    if (pendingPrefix && i <= pendingPrefixExpiresAt) {
      const digitsToken = trimmed.match(/^([0-9]{3}[A-Z]?)(?:(?:\s|_).*)?$/i);
      if (digitsToken) {
        synthesizedCode = `${pendingPrefix}-${digitsToken[1].toUpperCase()}`;
        pendingPrefix = null;
        pendingPrefixExpiresAt = -1;
      }
    } else if (pendingPrefix && i > pendingPrefixExpiresAt) {
      pendingPrefix = null;
      pendingPrefixExpiresAt = -1;
    }

    // ── Course code detection ──────────────────────────────────────────────
    CODE_RE.lastIndex = 0;
    let codeMatch: RegExpExecArray | null;

    const scanLine = synthesizedCode ? `${synthesizedCode} ${line}` : line;
    const inlineSemesterMatch = scanLine.match(SEM_INLINE_RE);
    const inlineSemester = inlineSemesterMatch ? parseInt(inlineSemesterMatch[1], 10) : undefined;

    while ((codeMatch = CODE_RE.exec(scanLine)) !== null) {
      const rawCode = `${codeMatch[1].toUpperCase()}-${codeMatch[2].toUpperCase()}`;
      const detectedSemester = inlineSemester ?? currentSemester;

      // Skip codes that look like years (e.g. "20-231") or roll numbers
      if (/^\d{2}-\d{3}$/.test(rawCode)) continue;
      // Skip page numbers / section headers that aren't real course codes
      if (["ODD-SEM", "EVE-SEM"].includes(rawCode.toUpperCase())) continue;

      const dupKey = `${rawCode.toUpperCase()}|${detectedSemester ?? "?"}`;
      if (seen.has(dupKey)) continue;
      seen.add(dupKey);

      // Extract grade from same line (or next line as fallback)
      const gradeSource = scanLine + " " + (lines[i + 1] ?? "");
      const gradeMatch = GRADE_RE.exec(gradeSource);
      const detectedGrade = gradeMatch?.[1];

      // Extract credits — look for a standalone number 1-9 in the line
      const creditsMatch = CREDITS_RE.exec(scanLine);
      const detectedCredits = creditsMatch ? parseFloat(creditsMatch[1]) : undefined;

      // Try to extract course name: text between the code and the grade/credits
      // Take the slice of the line after the full code match, trim numbers & grades
      const afterCode = scanLine.slice((codeMatch.index ?? 0) + codeMatch[0].length);
      const rawName = afterCode
        .replace(/\d+(\.\d+)?/g, "")   // remove numbers
        .replace(GRADE_RE, "")          // remove grade token
        .replace(/[^A-Za-z\s]/g, " ")  // remove punctuation
        .trim()
        .replace(/\s+/g, " ") || undefined;

      results.push({
        rawCode,
        rawName: rawName && rawName.length > 2 ? rawName : undefined,
        detectedSemester,
        detectedGrade,
        detectedCredits,
      });
    }
  }

  return results;
}

/** Normalise a course code for matching: "MA-222" → "MA222" */
export function normalizeCourseCode(code: string): string {
  if (!code) return "";
  return String(code)
    .replace(/\u00a0/g, " ")
    .trim()
    .toUpperCase()
    // "CS201(P)" -> "CS201P"
    .replace(/(\d{3}[A-Z]?)\s*\(\s*P\s*\)/g, "$1P")
    // Samarth suffix noise: "CS-302_New", "HS-342_1_New" -> base code
    .replace(/(_\d{1,2})?_NEW$/g, "")
    .replace(/[^A-Z0-9]/g, "");
}
