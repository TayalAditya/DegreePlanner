import prisma from "@/lib/prisma";
import { EnrollmentStatus, Term } from "@prisma/client";

export type CurrentTimetableContext = {
  semester: number;
  year: number;
  term: Term;
};

const TERM_ORDER: Record<Term, number> = {
  SPRING: 1,
  SUMMER: 2,
  FALL: 3,
};

export async function getCurrentTimetableContext(userId: string): Promise<CurrentTimetableContext> {
  const enrollments = await prisma.courseEnrollment.findMany({
    where: { userId },
    select: { semester: true, year: true, term: true, status: true },
  });

  if (enrollments.length === 0) {
    return {
      semester: 1,
      year: new Date().getFullYear(),
      term: Term.FALL,
    };
  }

  const inProgress = enrollments.filter((e) => e.status === EnrollmentStatus.IN_PROGRESS);
  const pool = inProgress.length > 0 ? inProgress : enrollments;
  const semester = Math.max(1, ...pool.map((e) => e.semester || 0));

  const semesterPool = pool.filter((e) => e.semester === semester);
  const best = semesterPool.reduce((acc, cur) => {
    if (cur.year > acc.year) return cur;
    if (cur.year < acc.year) return acc;
    return TERM_ORDER[cur.term] > TERM_ORDER[acc.term] ? cur : acc;
  }, semesterPool[0]);

  return { semester, year: best.year, term: best.term };
}

