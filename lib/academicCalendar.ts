export type AcademicPhase = "SPRING" | "FALL" | "BREAK";

export type AcademicState = {
  currentSemester: number;
  phase: AcademicPhase;
  isInSession: boolean;
};

const clampSemester = (semester: number) => Math.min(8, Math.max(1, Math.trunc(semester)));

const getIndiaMonthYear = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);

  const month = Number(parts.find((p) => p.type === "month")?.value);
  const year = Number(parts.find((p) => p.type === "year")?.value);

  return { month, year };
};

export const inferBatchYear = (
  batch: number | null | undefined,
  enrollmentId: string | null | undefined
) => {
  if (typeof batch === "number" && batch > 2000) return batch;

  const text = String(enrollmentId ?? "").toUpperCase();
  const match = /^B(\d{2})\d+/.exec(text);
  if (match) return 2000 + Number.parseInt(match[1], 10);

  return null;
};

// IIT Mandi (as used in this app):
// - Odd semester runs Aug–Dec
// - Even semester runs Jan–May
// - Jun–Jul is the break window
export const inferAcademicState = (batchYear: number, now: Date = new Date()): AcademicState => {
  const { month, year } = getIndiaMonthYear(now);
  const yearsElapsed = year - batchYear;

  if (month >= 1 && month <= 5) {
    return {
      currentSemester: clampSemester(yearsElapsed * 2),
      phase: "SPRING",
      isInSession: true,
    };
  }

  if (month >= 8 && month <= 12) {
    return {
      currentSemester: clampSemester(yearsElapsed * 2 + 1),
      phase: "FALL",
      isInSession: true,
    };
  }

  return {
    currentSemester: clampSemester(yearsElapsed * 2),
    phase: "BREAK",
    isInSession: false,
  };
};

