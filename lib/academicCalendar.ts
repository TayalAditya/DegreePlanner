// IIT Mandi academic calendar:
// - Jan–May 29: Spring (even semester)
// - May 30–Jul: Pre-registration (Spring marked complete, Fall pre-reg opens)
// - Aug–Dec   : Fall   (odd semester)
export type AcademicPhase = "SPRING" | "FALL" | "BREAK" | "PRE_REGISTRATION";

export type AcademicState = {
  currentSemester: number;
  phase: AcademicPhase;
  isInSession: boolean;
  // During PRE_REGISTRATION this is the upcoming Fall semester number.
  // During BREAK it is the just-completed Spring semester number.
  upcomingSemester?: number;
};

const clampSemester = (semester: number) => Math.min(8, Math.max(1, Math.trunc(semester)));

const getIndiaDate = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const month = Number(parts.find((p) => p.type === "month")?.value);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  return { month, year, day };
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

export const inferAcademicState = (batchYear: number, now: Date = new Date()): AcademicState => {
  const { month, year, day } = getIndiaDate(now);
  const yearsElapsed = year - batchYear;

  // Jan-May 29: Spring semester in session
  if (month >= 1 && (month < 5 || (month === 5 && day < 30))) {
    return {
      currentSemester: clampSemester(yearsElapsed * 2),
      phase: "SPRING",
      isInSession: true,
    };
  }

  // May 30-Jul 31: Pre-registration for upcoming Fall semester.
  // currentSemester is set to the upcoming Fall semester so that the sync
  // auto-completes all Spring (< upcoming Fall) enrollments and keeps any
  // pre-registered Fall courses as IN_PROGRESS.
  if ((month === 5 && day >= 30) || month === 6 || month === 7) {
    const upcomingFall = clampSemester(yearsElapsed * 2 + 1);
    return {
      currentSemester: upcomingFall,
      phase: "PRE_REGISTRATION",
      isInSession: true,
      upcomingSemester: upcomingFall,
    };
  }

  // Aug–Dec: Fall semester in session
  return {
    currentSemester: clampSemester(yearsElapsed * 2 + 1),
    phase: "FALL",
    isInSession: true,
  };
};
