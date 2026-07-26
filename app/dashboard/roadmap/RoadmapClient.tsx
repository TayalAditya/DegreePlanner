"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Globe,
  GitBranch,
  GraduationCap,
  LockKeyhole,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";

export type RoadmapCourse = {
  id: string;
  code: string;
  name: string;
  credits: number;
  category: string;
  completed: boolean;
  source: "curriculum" | "live" | "historical";
  offeringYear?: number;
  offeringSemester?: number;
  equivalents?: Array<{ code: string; name: string }>;
};

export type RoadmapData = {
  branch: string;
  batchYear: number;
  currentSemester: number;
  storageKey: string;
  semesters: Array<{
    semester: number;
    status: "past" | "current" | "future";
    requiredCourses: RoadmapCourse[];
    mappedElectives: RoadmapCourse[];
    liveOptions: RoadmapCourse[];
    historicalOptions: RoadmapCourse[];
  }>;
  creditSummary: {
    totalRequired: number;
    completed: number;
    remaining: number;
    byBucket: {
      core: number;
      de: number;
      freeElective: number;
      mtp: number;
      istp: number;
      pe: number;
    };
  } | null;
  passFail: {
    used: number;
    remaining: number;
    bySemester: Record<string, number>;
  };
};

type InternshipType = "none" | "remote" | "onsite" | "semex";
type InternshipSemester = 5 | 6 | 7 | 8;
type CourseFilter = "all" | "DE" | "FE" | "HSS" | "PE";
type ExchangeResolution = "equivalent" | "shift";
type ShiftedRoadmapCourse = RoadmapCourse & { shiftedFrom?: number };

const categoryStyle: Record<string, string> = {
  IC: "bg-info/10 text-info border-info/15",
  DC: "bg-primary/10 text-primary border-primary/15",
  DE: "bg-secondary/10 text-secondary border-secondary/15",
  FE: "bg-success/10 text-success border-success/15",
  HSS: "bg-warning/10 text-warning border-warning/15",
  PE: "bg-accent/10 text-accent border-accent/15",
  MTP: "bg-error/10 text-error border-error/15",
  ISTP: "bg-accent/10 text-accent border-accent/15",
};

const semesterLabel = (semester: number) => `Semester ${semester}`;

function formatCredits(credits: number) {
  return `${Number.isInteger(credits) ? credits : credits.toFixed(1)} cr`;
}

function courseCreditTotal(courses: RoadmapCourse[]) {
  return courses.reduce((sum, course) => sum + course.credits, 0);
}

function statusCopy(status: RoadmapData["semesters"][number]["status"]) {
  if (status === "past") return { label: "Past", className: "bg-foreground-muted/10 text-foreground-secondary" };
  if (status === "current") return { label: "In planning", className: "bg-primary/10 text-primary" };
  return { label: "Ahead", className: "bg-accent/10 text-accent" };
}

function FlowConnector() {
  return (
    <div className="hidden xl:flex w-10 items-center justify-center text-foreground-muted" aria-hidden="true">
      <ArrowRight className="h-5 w-5" />
    </div>
  );
}

function optionPool(semester: RoadmapData["semesters"][number]) {
  return semester.liveOptions.length > 0 ? semester.liveOptions : semester.historicalOptions;
}

function nextSameParitySemester(fromSemester: number, semesters: number[]) {
  return semesters.find((semester) => semester > fromSemester && semester % 2 === fromSemester % 2) ?? null;
}

export default function RoadmapClient({ data }: { data: RoadmapData | null }) {
  const [internshipType, setInternshipType] = useState<InternshipType>("none");
  const [internshipSemester, setInternshipSemester] = useState<InternshipSemester>(6);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [exploringSemester, setExploringSemester] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CourseFilter>("all");
  const [exchangeResolutions, setExchangeResolutions] = useState<Record<string, ExchangeResolution>>({});
  const [semexDuration, setSemexDuration] = useState<1 | 2>(1);
  const [passFailSelections, setPassFailSelections] = useState<Record<string, string[]>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(false);
    if (!data) return;

    try {
      const saved = window.localStorage.getItem(data.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          internshipType?: InternshipType;
          internshipSemester?: InternshipSemester;
          selections?: Record<string, string[]>;
          exchangeResolutions?: Record<string, ExchangeResolution>;
          semexDuration?: 1 | 2;
          passFailSelections?: Record<string, string[]>;
        };
        if (parsed.internshipType === "none" || parsed.internshipType === "remote" || parsed.internshipType === "onsite" || parsed.internshipType === "semex") {
          setInternshipType(parsed.internshipType);
        }
        if (parsed.internshipSemester === 5 || parsed.internshipSemester === 6 || parsed.internshipSemester === 7 || parsed.internshipSemester === 8) {
          setInternshipSemester(parsed.internshipSemester);
        }
        if (parsed.selections && typeof parsed.selections === "object") {
          setSelections(parsed.selections);
        }
        if (parsed.exchangeResolutions && typeof parsed.exchangeResolutions === "object") {
          setExchangeResolutions(parsed.exchangeResolutions);
        }
        if (parsed.semexDuration === 1 || parsed.semexDuration === 2) {
          setSemexDuration(parsed.semexDuration);
        }
        if (parsed.passFailSelections && typeof parsed.passFailSelections === "object") {
          setPassFailSelections(parsed.passFailSelections);
        }
      }
    } catch {
      // A malformed browser draft should never make the roadmap unavailable.
    } finally {
      setHydrated(true);
    }
  }, [data]);

  useEffect(() => {
    if (!data || !hydrated) return;
    window.localStorage.setItem(
      data.storageKey,
      JSON.stringify({ internshipType, internshipSemester, selections, exchangeResolutions, semexDuration, passFailSelections })
    );
  }, [data, hydrated, internshipType, internshipSemester, selections, exchangeResolutions, semexDuration, passFailSelections]);

  const selectedCoursesBySemester = useMemo(() => {
    const selected = new Map<number, RoadmapCourse[]>();
    if (!data) return selected;

    for (const semester of data.semesters) {
      const ids = new Set(selections[String(semester.semester)] ?? []);
      selected.set(semester.semester, optionPool(semester).filter((course) => ids.has(course.id)));
    }
    return selected;
  }, [data, selections]);

  const semexSemesters = useMemo<number[]>(() => {
    if (internshipType !== "semex") return [];
    const planned: number[] = [internshipSemester];
    if (semexDuration === 2 && internshipSemester < 7) planned.push(internshipSemester + 1);
    return planned;
  }, [internshipType, internshipSemester, semexDuration]);

  const passFailPlan = useMemo(() => {
    if (!data) return null;

    const courseIdsBySemester = new Map<number, Set<string>>();
    const selectedPassFailCourses = new Map<number, RoadmapCourse[]>();
    const perSemesterPlanned: Record<number, number> = {};

    for (const semester of data.semesters) {
      const ids = new Set(passFailSelections[String(semester.semester)] ?? []);
      const pFCourses = (selectedCoursesBySemester.get(semester.semester) ?? []).filter(
        (course) => ids.has(course.id) && course.category === "FE"
      );
      courseIdsBySemester.set(semester.semester, ids);
      selectedPassFailCourses.set(semester.semester, pFCourses);
      perSemesterPlanned[semester.semester] = courseCreditTotal(pFCourses);
    }

    const totalSelectedPF = Array.from(selectedPassFailCourses.values()).reduce(
      (sum, courses) => sum + courseCreditTotal(courses),
      0
    );
    // 399P is a 9-credit P/F exception and cannot coexist with any other P/F
    // course. 396P consumes six P/F credits in its own semester.
    const onsitePathConflictsWithPF = internshipType === "onsite" &&
      (data.passFail.used > 0 || totalSelectedPF > 0);
    const internshipPF = internshipType === "onsite"
      ? onsitePathConflictsWithPF ? 0 : 9
      : internshipType === "remote" ? 6 : 0;
    const forcedPFBySemester: Record<number, number> = {};
    if (internshipType === "remote" || (internshipType === "onsite" && !onsitePathConflictsWithPF)) {
      forcedPFBySemester[internshipSemester] = internshipPF;
    }
    const totalRemaining = Math.max(0, 9 - data.passFail.used - internshipPF - totalSelectedPF);
    const semesterRemaining: Record<number, number> = {};
    for (const semester of data.semesters) {
      const existingPF = data.passFail.bySemester[String(semester.semester)] ?? 0;
      semesterRemaining[semester.semester] = Math.max(
        0,
        6 - existingPF - (forcedPFBySemester[semester.semester] ?? 0) - (perSemesterPlanned[semester.semester] ?? 0)
      );
    }

    const suggestions: Array<{ semester: number; course: RoadmapCourse }> = [];
    let suggestionRemaining = totalRemaining;
    const tentativePerSemester = { ...perSemesterPlanned };

    const candidates = internshipType === "onsite" || data.creditSummary?.byBucket.freeElective === 0
      ? []
      : data.semesters
      .flatMap((semester) =>
        (selectedCoursesBySemester.get(semester.semester) ?? [])
          .filter((course) => course.category === "FE" && !(courseIdsBySemester.get(semester.semester)?.has(course.id)))
          .map((course) => ({ semester: semester.semester, course }))
      )
      .filter(({ semester }) => {
        const isInternshipSemester = internshipType === "remote" && internshipSemester === semester;
        const isSemExSemester = internshipType === "semex" && semexSemesters.includes(semester);
        return !isInternshipSemester && !isSemExSemester;
      })
      .sort((a, b) => b.course.credits - a.course.credits || a.course.code.localeCompare(b.course.code));

    for (const candidate of candidates) {
      const capacity = Math.max(
        0,
        semesterRemaining[candidate.semester] - (tentativePerSemester[candidate.semester] ?? 0) + (perSemesterPlanned[candidate.semester] ?? 0)
      );
      if (candidate.course.credits > suggestionRemaining || candidate.course.credits > capacity) continue;
      suggestions.push(candidate);
      tentativePerSemester[candidate.semester] = (tentativePerSemester[candidate.semester] ?? 0) + candidate.course.credits;
      suggestionRemaining -= candidate.course.credits;
    }

    return {
      internshipPF,
      totalSelectedPF,
      totalRemaining,
      selectedPassFailCourses,
      suggestions,
      suggestedCredits: courseCreditTotal(suggestions.map((item) => item.course)),
      semesterRemaining,
      onsitePathConflictsWithPF,
      internshipFitsBudget: !onsitePathConflictsWithPF && data.passFail.used + internshipPF + totalSelectedPF <= 9,
    };
  }, [data, internshipType, internshipSemester, passFailSelections, selectedCoursesBySemester, semexSemesters]);

  const pathway = useMemo(() => {
    const scheduled = new Map<number, ShiftedRoadmapCourse[]>();
    const exchangeEquivalents = new Map<number, RoadmapCourse[]>();
    const shifted: Array<{ course: RoadmapCourse; from: number; to: number }> = [];
    const unplaced: Array<{ course: RoadmapCourse; from: number }> = [];

    if (!data) return { scheduled, exchangeEquivalents, shifted, unplaced };

    const semesterNumbers = data.semesters.map((semester) => semester.semester);
    for (const semester of data.semesters) {
      scheduled.set(semester.semester, [...semester.requiredCourses]);
      exchangeEquivalents.set(semester.semester, []);
    }

    const localSemesterBlocks = internshipType === "onsite"
      ? [internshipSemester]
      : internshipType === "semex"
      ? semexSemesters
      : [];

    for (const sourceSemester of localSemesterBlocks) {
      const source = data.semesters.find((semester) => semester.semester === sourceSemester);
      if (!source) continue;

      for (const course of source.requiredCourses) {
      // Only DC work is auto-routed. MTP/ISTP and other special requirements
      // need a programme-level decision instead of an invented rule.
        if (course.completed || course.category !== "DC") continue;

        const resolution = exchangeResolutions[course.id] ??
          (course.equivalents && course.equivalents.length > 0 ? "equivalent" : "shift");
        const canUseEquivalent =
          internshipType === "semex" &&
          resolution === "equivalent" &&
          Boolean(course.equivalents?.length);

        scheduled.set(
          source.semester,
          (scheduled.get(source.semester) ?? []).filter((scheduledCourse) => scheduledCourse.id !== course.id)
        );

        if (canUseEquivalent) {
          exchangeEquivalents.set(source.semester, [
            ...(exchangeEquivalents.get(source.semester) ?? []),
            course,
          ]);
          continue;
        }

        const destination = nextSameParitySemester(source.semester, semesterNumbers);
        if (!destination) {
          unplaced.push({ course, from: source.semester });
          continue;
        }

        scheduled.set(destination, [
          ...(scheduled.get(destination) ?? []),
          { ...course, shiftedFrom: source.semester },
        ]);
        shifted.push({ course, from: source.semester, to: destination });
      }
    }

    return { scheduled, exchangeEquivalents, shifted, unplaced };
  }, [data, internshipType, internshipSemester, exchangeResolutions, semexSemesters]);

  const creditRunway = useMemo(() => {
    if (!data?.creditSummary) return null;

    let mappedCredits = 0;
    let selectedCredits = 0;
    let transferCredits = 0;
    for (const semester of data.semesters) {
      mappedCredits += courseCreditTotal(
        (pathway.scheduled.get(semester.semester) ?? []).filter((course) => !course.completed)
      );
      transferCredits += courseCreditTotal(pathway.exchangeEquivalents.get(semester.semester) ?? []);
      selectedCredits += courseCreditTotal(selectedCoursesBySemester.get(semester.semester) ?? []);
    }

    const internshipCredits = passFailPlan?.internshipPF ?? 0;
    const plannedCredits = mappedCredits + transferCredits + selectedCredits + internshipCredits;

    return {
      mappedCredits,
      selectedCredits,
      transferCredits,
      internshipCredits,
      plannedCredits,
      stillUnallocated: Math.max(0, data.creditSummary.remaining - plannedCredits),
    };
  }, [data, pathway, passFailPlan, selectedCoursesBySemester]);

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl dp-card p-8 sm:p-10 text-center">
        <GitBranch className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-2xl font-bold text-foreground">Set up your roadmap first</h1>
        <p className="mt-2 text-sm leading-6 text-foreground-secondary">
          Add your branch and batch in Settings. Then Degree Roadmap can use your own curriculum mapping instead of showing a generic plan.
        </p>
      </div>
    );
  }

  const openExplorer = data.semesters.find((semester) => semester.semester === exploringSemester) ?? null;
  const isAwaySemesterLocked =
    (internshipType === "onsite" && internshipSemester === exploringSemester) ||
    (internshipType === "semex" && exploringSemester !== null && semexSemesters.includes(exploringSemester));
  const liveSemesterLabels = data.semesters
    .filter((semester) => semester.liveOptions.length > 0)
    .map((semester) => `${semesterLabel(semester.semester)} ${semester.liveOptions[0].offeringYear ?? ""}`.trim());

  const chooseScenario = (type: InternshipType, semester: InternshipSemester = 6) => {
    setInternshipType(type);
    setInternshipSemester(semester);
    if (type !== "semex") setSemexDuration(1);
  };

  const toggleSelection = (semester: number, courseId: string) => {
    if (
      (internshipType === "onsite" && internshipSemester === semester) ||
      (internshipType === "semex" && semexSemesters.includes(semester))
    ) return;
    const key = String(semester);
    const isRemoving = (selections[key] ?? []).includes(courseId);
    if (isRemoving) {
      setPassFailSelections((currentPassFail) => {
        const passFailIds = new Set(currentPassFail[key] ?? []);
        passFailIds.delete(courseId);
        return { ...currentPassFail, [key]: Array.from(passFailIds) };
      });
    }
    setSelections((current) => {
      const selected = new Set(current[key] ?? []);
      if (selected.has(courseId)) selected.delete(courseId);
      else selected.add(courseId);
      return { ...current, [key]: Array.from(selected) };
    });
  };

  const resetDraft = () => {
    setInternshipType("none");
    setInternshipSemester(6);
    setSelections({});
    setExchangeResolutions({});
    setSemexDuration(1);
    setPassFailSelections({});
    window.localStorage.removeItem(data.storageKey);
  };

  const applyPassFailSuggestion = () => {
    if (!passFailPlan?.suggestions.length) return;
    setPassFailSelections((current) => {
      const next = { ...current };
      for (const suggestion of passFailPlan.suggestions) {
        const key = String(suggestion.semester);
        const ids = new Set(next[key] ?? []);
        ids.add(suggestion.course.id);
        next[key] = Array.from(ids);
      }
      return next;
    });
  };

  const scenarioSemesters = internshipType === "semex" ? [5, 6, 7] : [6, 7, 8];

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-surface px-5 py-6 shadow-sm sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">{data.branch} · Batch {data.batchYear}</span>
            <span className="rounded-full bg-surface-hover px-3 py-1.5 text-foreground-secondary">Curriculum mapped</span>
            {liveSemesterLabels.length > 0 && (
              <span className="rounded-full bg-success/10 px-3 py-1.5 text-success">Live options: {liveSemesterLabels.join(", ")}</span>
            )}
          </div>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Plan the rest of your degree, not just the next registration.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground-secondary sm:text-base">
            Draft your Semester 5–8 course path, then pressure-test it against an internship or Semester Exchange. Your commitments come from the branch and batch curriculum; availability is either published or clearly marked as a same-parity historical estimate.
          </p>
        </div>
      </section>

      <section className="dp-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Path simulator</p>
            <h2 className="mt-1 text-lg font-bold text-foreground">Which degree path do you want to test?</h2>
            <p className="mt-1 text-sm text-foreground-secondary">This models a practical completion path. It does not submit or change your registration.</p>
          </div>
          <button type="button" onClick={resetDraft} className="dp-btn dp-btn-ghost shrink-0 text-xs">
            <RotateCcw className="h-4 w-4" /> Reset draft
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => chooseScenario("none")}
            className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
              internshipType === "none" ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <GraduationCap className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm font-semibold text-foreground">Course-focused path</p>
            <p className="mt-1 text-xs leading-5 text-foreground-secondary">Estimate electives around your mapped curriculum and project work.</p>
          </button>
          <button
            type="button"
            onClick={() => chooseScenario("remote", 6)}
            className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
              internshipType === "remote" ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <BriefcaseBusiness className="h-5 w-5 text-accent" />
            <p className="mt-3 text-sm font-semibold text-foreground">Remote internship path</p>
            <p className="mt-1 text-xs leading-5 text-foreground-secondary">Plan a lighter course load with a DP-396P semester-long remote internship.</p>
          </button>
          <button
            type="button"
            onClick={() => chooseScenario("onsite", 6)}
            className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
              internshipType === "onsite" ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <LockKeyhole className="h-5 w-5 text-warning" />
            <p className="mt-3 text-sm font-semibold text-foreground">Onsite internship path</p>
            <p className="mt-1 text-xs leading-5 text-foreground-secondary">Reserve a DP-399P semester and surface any curriculum work that needs rescheduling.</p>
          </button>
          <button
            type="button"
            onClick={() => chooseScenario("semex", 5)}
            className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
              internshipType === "semex" ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <Globe className="h-5 w-5 text-info" />
            <p className="mt-3 text-sm font-semibold text-foreground">Semester Exchange path</p>
            <p className="mt-1 text-xs leading-5 text-foreground-secondary">Test Sem 5, 6 or 7 with recorded equivalences or same-parity DC shifts.</p>
          </button>
        </div>

        {internshipType !== "none" && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface-hover/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm leading-6 text-foreground-secondary">
                <span className="font-semibold text-foreground">Place it in:</span>{" "}
                {internshipType === "remote"
                  ? "Remote 396P can run with at most 9 credits alongside, so use the estimate to keep the semester intentionally light."
                  : internshipType === "onsite"
                  ? "Onsite 399P is a no-course semester. Any pending DC is automatically moved to the next same-parity semester; special requirements remain visible for approval."
                  : "Semester Exchange is available from Sem 5 to 7 for up to two contiguous semesters. Each pending DC can use an existing recorded equivalent or move to the next same-parity home semester."}
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-border bg-surface p-1">
              {(scenarioSemesters as InternshipSemester[]).map((semester) => (
                <button
                  key={semester}
                  type="button"
                  onClick={() => {
                    setInternshipSemester(semester);
                    if (internshipType === "semex" && semester === 7) setSemexDuration(1);
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    internshipSemester === semester ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground-secondary hover:bg-surface-hover"
                  }`}
                >
                  Sem {semester}
                </button>
              ))}
            </div>
          </div>
        )}

        {internshipType === "semex" && (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-info/20 bg-info/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-foreground-secondary"><span className="font-semibold text-foreground">Exchange duration:</span> {semexDuration === 2 ? `Sem ${internshipSemester} and Sem ${internshipSemester + 1} will both route DC.` : "Route DC for one exchange semester."}</p>
            <div className="inline-flex rounded-xl border border-border bg-surface p-1">
              <button type="button" onClick={() => setSemexDuration(1)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${semexDuration === 1 ? "bg-info text-white" : "text-foreground-secondary hover:bg-surface-hover"}`}>1 semester</button>
              <button type="button" onClick={() => setSemexDuration(2)} disabled={internshipSemester === 7} className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${semexDuration === 2 ? "bg-info text-white" : "text-foreground-secondary hover:bg-surface-hover"}`}>2 consecutive</button>
            </div>
          </div>
        )}
      </section>

      {creditRunway && data.creditSummary && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Degree credit runway">
          <div className="dp-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Degree progress</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{formatCredits(data.creditSummary.completed)} <span className="text-sm font-medium text-foreground-secondary">/ {formatCredits(data.creditSummary.totalRequired)}</span></p>
            <p className="mt-1 text-xs text-foreground-secondary">Already counted by the programme credit calculator</p>
          </div>
          <div className="dp-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Still required</p>
            <p className="mt-2 text-2xl font-bold text-primary">{formatCredits(data.creditSummary.remaining)}</p>
            <p className="mt-1 text-xs text-foreground-secondary">Core {formatCredits(data.creditSummary.byBucket.core)} · DE {formatCredits(data.creditSummary.byBucket.de)} · FE {formatCredits(data.creditSummary.byBucket.freeElective)}</p>
          </div>
          <div className="dp-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">This path allocates</p>
            <p className="mt-2 text-2xl font-bold text-success">{formatCredits(creditRunway.plannedCredits)}</p>
            <p className="mt-1 text-xs text-foreground-secondary">Mapped {formatCredits(creditRunway.mappedCredits)} · picks {formatCredits(creditRunway.selectedCredits)}{creditRunway.internshipCredits > 0 ? ` · internship ${formatCredits(creditRunway.internshipCredits)}` : ""}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${creditRunway.stillUnallocated > 0 || pathway.unplaced.length > 0 ? "border-warning/25 bg-warning/10" : "border-success/25 bg-success/10"}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">After this path</p>
            <p className={`mt-2 text-2xl font-bold ${creditRunway.stillUnallocated > 0 || pathway.unplaced.length > 0 ? "text-warning" : "text-success"}`}>{formatCredits(creditRunway.stillUnallocated)}</p>
            <p className="mt-1 text-xs text-foreground-secondary">{pathway.unplaced.length > 0 ? `${pathway.unplaced.length} DC course${pathway.unplaced.length === 1 ? "" : "s"} need a post-Sem 8 decision.` : "Still to allocate through remaining electives or approved transfer credits."}</p>
          </div>
        </section>
      )}

      {passFailPlan && (
        <section className="dp-card overflow-hidden" aria-label="Pass fail credit optimiser">
          <div className="border-b border-border bg-surface-hover/50 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">P/F optimiser</p>
                <h2 className="mt-1 text-lg font-bold text-foreground">Use remaining P/F credits where they actually help the plan.</h2>
                <p className="mt-1 text-sm leading-6 text-foreground-secondary">Only selected FE courses are suggested here. P/F still counts toward Free Electives and remains subject to institute approval and the 6-credit semester cap.</p>
              </div>
              {passFailPlan.totalSelectedPF > 0 && <button type="button" onClick={() => setPassFailSelections({})} className="dp-btn dp-btn-ghost shrink-0 px-3 py-2 text-xs">Clear P/F picks</button>}
            </div>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
            <div className="rounded-xl bg-surface-hover p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Already used</p>
              <p className="mt-1 text-xl font-bold text-foreground">{formatCredits(data.passFail.used)} <span className="text-xs font-medium text-foreground-secondary">/ 9 cr</span></p>
            </div>
            <div className="rounded-xl bg-surface-hover p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Reserved by this path</p>
              <p className="mt-1 text-xl font-bold text-primary">{formatCredits(passFailPlan.internshipPF + passFailPlan.totalSelectedPF)}</p>
              <p className="mt-1 text-[11px] text-foreground-secondary">{passFailPlan.internshipPF > 0 ? `${formatCredits(passFailPlan.internshipPF)} internship` : "No internship P/F"}{passFailPlan.totalSelectedPF > 0 ? ` · ${formatCredits(passFailPlan.totalSelectedPF)} FE` : ""}</p>
            </div>
            <div className="rounded-xl bg-surface-hover p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Still available</p>
              <p className={`mt-1 text-xl font-bold ${passFailPlan.internshipFitsBudget ? "text-success" : "text-warning"}`}>{formatCredits(passFailPlan.totalRemaining)}</p>
              <p className="mt-1 text-[11px] text-foreground-secondary">After historical use and this draft</p>
            </div>
            <div className={`rounded-xl border p-3 ${passFailPlan.internshipFitsBudget ? "border-primary/15 bg-primary/5" : "border-warning/25 bg-warning/10"}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Planner signal</p>
              <p className="mt-1 text-xs leading-5 text-foreground-secondary">{!passFailPlan.internshipFitsBudget ? passFailPlan.onsitePathConflictsWithPF ? "399P uses all 9 P/F credits and cannot coexist with prior or planned P/F courses. This onsite path is not feasible until that conflict is cleared." : "This internship path exceeds your remaining 9-credit P/F allowance. Change the internship or clear earlier P/F before relying on it." : passFailPlan.suggestions.length > 0 ? `A valid ${formatCredits(passFailPlan.suggestedCredits)} FE P/F combination is ready below.` : passFailPlan.totalRemaining > 0 ? "Select an FE in an available semester to receive a P/F recommendation." : "Your current draft uses the available P/F capacity."}</p>
            </div>
          </div>
          {passFailPlan.internshipFitsBudget && passFailPlan.suggestions.length > 0 && (
            <div className="mx-5 mb-5 flex flex-col gap-3 rounded-2xl border border-success/20 bg-success/5 p-4 sm:mx-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Suggested P/F use: {passFailPlan.suggestions.map((item) => `${item.course.code} (Sem ${item.semester})`).join(", ")}</p>
                <p className="mt-1 text-xs leading-5 text-foreground-secondary">Use {formatCredits(passFailPlan.suggestedCredits)} of the remaining P/F capacity on selected FE courses, while keeping each semester within 6 P/F credits.</p>
              </div>
              <button type="button" onClick={applyPassFailSuggestion} className="dp-btn dp-btn-primary shrink-0 px-4 py-2 text-xs">Use P/F suggestion</button>
            </div>
          )}
        </section>
      )}

      <section aria-label="Semester pathway" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your pathway</p>
            <h2 className="mt-1 text-xl font-bold text-foreground">The graduation flow, with the pressure points visible.</h2>
          </div>
          <p className="text-xs text-foreground-secondary">Draft saved only in this browser for now.</p>
        </div>

        <div className="xl:flex xl:items-stretch">
          {data.semesters.map((semester, index) => {
            const selectedCourses = selectedCoursesBySemester.get(semester.semester) ?? [];
            const scheduledCourses = pathway.scheduled.get(semester.semester) ?? [];
            const requiredPending = scheduledCourses.filter((course) => !course.completed);
            const markedElectives = semester.mappedElectives.filter((course) => !course.completed);
            const status = statusCopy(semester.status);
            const isSemEx = internshipType === "semex" && semexSemesters.includes(semester.semester);
            const isOnsite = internshipType === "onsite" && internshipSemester === semester.semester;
            const isInternshipSemester =
              isSemEx ||
              (internshipType === "remote" && internshipSemester === semester.semester) ||
              isOnsite;
            const baseCredits = courseCreditTotal(requiredPending);
            const selectedCredits = courseCreditTotal(selectedCourses);
            const blockingRequirements = isOnsite || isSemEx
              ? semester.requiredCourses.filter((course) => !course.completed && course.category !== "DC")
              : [];
            const exchangeEquivalentCourses = pathway.exchangeEquivalents.get(semester.semester) ?? [];
            const sourceDcCourses = semester.requiredCourses.filter((course) => !course.completed && course.category === "DC");

            return (
              <div key={semester.semester} className="contents">
                <article className={`dp-card flex min-w-0 flex-1 flex-col p-4 sm:p-5 ${isInternshipSemester ? "ring-2 ring-primary/20" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-foreground">Sem {semester.semester}</span>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-foreground-secondary">
                        {baseCredits > 0 ? `${formatCredits(baseCredits)} mapped commitments remaining` : "No unfinished mapped commitment"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface-hover p-2 text-primary"><GitBranch className="h-4 w-4" /></div>
                  </div>

                  {isInternshipSemester && (
                    <div className={`mt-4 rounded-xl border p-3 ${isOnsite ? "border-warning/25 bg-warning/10" : isSemEx ? "border-info/25 bg-info/10" : "border-accent/25 bg-accent/10"}`}>
                      <div className="flex gap-2">
                        {isOnsite ? <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> : isSemEx ? <Globe className="mt-0.5 h-4 w-4 shrink-0 text-info" /> : <BriefcaseBusiness className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
                        <div>
                          <p className="text-xs font-semibold text-foreground">{isOnsite ? "DP-399P · Onsite internship" : isSemEx ? "Semester Exchange · transfer-credit path" : "DP-396P · Remote internship"}</p>
                          <p className="mt-1 text-xs leading-5 text-foreground-secondary">
                            {isOnsite ? "Pending DC has moved to the next same-parity semester, and local elective estimation is locked." : isSemEx ? "Resolve every DC through a recorded equivalent or a same-parity home-semester shift." : "Keep your selected courses at or below 9 credits alongside the internship."}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {isSemEx && sourceDcCourses.length > 0 && (
                    <div className="mt-3 space-y-2 rounded-xl border border-info/20 bg-info/5 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-info">Resolve DC during SemEx</p>
                      {sourceDcCourses.map((course) => {
                        const defaultResolution: ExchangeResolution = course.equivalents?.length ? "equivalent" : "shift";
                        const resolution = exchangeResolutions[course.id] ?? defaultResolution;
                        const hasEquivalent = Boolean(course.equivalents?.length);
                        return (
                          <div key={course.id} className="rounded-lg border border-border bg-surface p-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-mono text-[11px] font-bold text-foreground">{course.code}</p>
                                <p className="mt-0.5 text-[11px] leading-4 text-foreground-secondary">{hasEquivalent ? `Recorded equivalent: ${course.equivalents!.map((item) => item.code).join(", ")}` : "No recorded equivalent in Degree Planner."}</p>
                              </div>
                              <div className="inline-flex rounded-lg bg-surface-hover p-0.5">
                                {hasEquivalent && <button type="button" onClick={() => setExchangeResolutions((current) => ({ ...current, [course.id]: "equivalent" }))} className={`rounded-md px-2 py-1 text-[10px] font-semibold ${resolution === "equivalent" ? "bg-info text-white" : "text-foreground-secondary"}`}>Equivalent</button>}
                                <button type="button" onClick={() => setExchangeResolutions((current) => ({ ...current, [course.id]: "shift" }))} className={`rounded-md px-2 py-1 text-[10px] font-semibold ${resolution === "shift" ? "bg-primary text-primary-foreground" : "text-foreground-secondary"}`}>Shift</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Mapped commitments</p>
                      {scheduledCourses.length === 0 ? (
                        <p className="mt-2 text-xs leading-5 text-foreground-secondary">{isOnsite ? "Pending DC has been moved forward by this onsite path." : isSemEx ? "Pending DC is being resolved through exchange equivalence or a same-parity shift." : "No compulsory course is mapped here in the current curriculum data."}</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {scheduledCourses.map((course) => (
                            <div key={course.id} className={`rounded-xl border px-3 py-2 ${course.completed ? "border-border bg-surface-hover/50 opacity-65" : "border-border bg-surface"}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[11px] font-bold text-foreground">{course.code}</span>
                                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${categoryStyle[course.category] ?? categoryStyle.FE}`}>{course.category}</span>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-foreground-secondary">{course.name}</p>
                              <p className="mt-1 text-[11px] font-medium text-foreground-secondary">{course.completed ? "Done" : course.shiftedFrom ? `Shifted from Sem ${course.shiftedFrom} · ${formatCredits(course.credits)}` : formatCredits(course.credits)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {exchangeEquivalentCourses.length > 0 && (
                      <div className="rounded-xl border border-info/20 bg-info/5 p-3">
                        <p className="text-[11px] font-semibold text-info">Planned through an equivalent</p>
                        <p className="mt-1 text-xs leading-5 text-foreground-secondary">{exchangeEquivalentCourses.map((course) => course.code).join(", ")} · {formatCredits(courseCreditTotal(exchangeEquivalentCourses))}. Transfer-credit approval is still required before departure.</p>
                      </div>
                    )}

                    {markedElectives.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Curriculum-marked electives</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {markedElectives.map((course) => (
                            <span key={course.id} className={`rounded-lg border px-2 py-1 text-[11px] font-medium ${categoryStyle[course.category] ?? categoryStyle.FE}`} title={`${course.name} · ${formatCredits(course.credits)}`}>
                              {course.code} · {formatCredits(course.credits)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 border-t border-border pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-foreground">Your elective estimate</p>
                        <p className="mt-0.5 text-[11px] text-foreground-secondary">{selectedCourses.length > 0 ? `${selectedCourses.length} course${selectedCourses.length === 1 ? "" : "s"} · ${formatCredits(selectedCredits)}` : semester.liveOptions.length > 0 ? "No published offering selected" : semester.historicalOptions.length > 0 ? "No historical estimate selected" : "No offering history available"}</p>
                      </div>
                      {optionPool(semester).length > 0 && (
                        <button type="button" onClick={() => { setExploringSemester(semester.semester); setSearch(""); setFilter("all"); }} disabled={isOnsite || isSemEx} className="dp-btn dp-btn-soft min-h-0 px-3 py-2 text-xs disabled:cursor-not-allowed">
                          <Plus className="h-3.5 w-3.5" /> Options
                        </button>
                      )}
                    </div>
                    {semester.liveOptions.length === 0 && semester.historicalOptions.length > 0 && (
                      <p className="mt-2 text-[11px] leading-5 text-warning">Estimated from the most recent matching odd/even offering. Treat it as a planning hint until the official list is published.</p>
                    )}
                    {semester.liveOptions.length === 0 && semester.historicalOptions.length === 0 && (
                      <p className="mt-2 text-[11px] leading-5 text-foreground-secondary">No matching odd/even offering history has been imported yet, so the planner will not invent an elective list.</p>
                    )}
                    {selectedCourses.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {selectedCourses.map((course) => {
                          const isPlannedPassFail = (passFailSelections[String(semester.semester)] ?? []).includes(course.id);
                          return (
                            <button key={course.id} type="button" onClick={() => toggleSelection(semester.semester, course.id)} disabled={isOnsite || isSemEx} className="rounded-lg border border-success/20 bg-success/10 px-2 py-1 text-left text-[11px] font-medium text-success transition-colors hover:bg-success/15 disabled:cursor-not-allowed">
                              {course.code}{isPlannedPassFail ? " · P/F" : ""} <span className="text-success/80">×</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {blockingRequirements.length > 0 && (
                    <div className="mt-4 rounded-xl border border-warning/25 bg-warning/10 p-3">
                      <div className="flex gap-2">
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                        <p className="text-xs leading-5 text-foreground-secondary"><span className="font-semibold text-foreground">Separate approval needed:</span> {blockingRequirements.map((course) => course.code).join(", ")} are not auto-shifted because only DC follows the same-parity planner rule. Confirm their treatment before finalizing this path.</p>
                      </div>
                    </div>
                  )}
                </article>
                {index < data.semesters.length - 1 && <FlowConnector />}
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="dp-card p-5 sm:p-6">
          <div className="flex gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="font-bold text-foreground">How to read this roadmap</h2>
              <p className="mt-1 text-sm leading-6 text-foreground-secondary">Use it to compare workable paths before registration opens, not as a replacement for institute approval.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-surface-hover p-3">
              <p className="text-xs font-semibold text-foreground">1. Lock constraints</p>
              <p className="mt-1 text-xs leading-5 text-foreground-secondary">Mapped DC, ISTP and MTP cards show degree commitments that should drive the plan.</p>
            </div>
            <div className="rounded-xl bg-surface-hover p-3">
              <p className="text-xs font-semibold text-foreground">2. Add real choices</p>
              <p className="mt-1 text-xs leading-5 text-foreground-secondary">Published offerings are selectable first; matching odd/even history is available only as a clearly marked estimate.</p>
            </div>
            <div className="rounded-xl bg-surface-hover p-3">
              <p className="text-xs font-semibold text-foreground">3. Test the trade-off</p>
              <p className="mt-1 text-xs leading-5 text-foreground-secondary">Move an onsite internship or SemEx and see DC shift automatically, with special cases held for approval.</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="font-bold text-foreground">Data integrity note</h2>
              <p className="mt-1 text-sm leading-6 text-foreground-secondary">A course can be part of your curriculum without being offered in a future semester yet. This page keeps those two truths separate so a roadmap stays useful without inventing elective availability.</p>
            </div>
          </div>
        </div>
      </section>

      {openExplorer && (() => {
        const explorerOptions = optionPool(openExplorer);
        const isHistoricalEstimate = openExplorer.liveOptions.length === 0;
        const visibleOptions = explorerOptions.filter((course) => {
          const matchesFilter = filter === "all" || course.category === filter;
          const text = `${course.code} ${course.name}`.toLowerCase();
          return matchesFilter && text.includes(search.trim().toLowerCase());
        });
        const selectedIds = new Set(selections[String(openExplorer.semester)] ?? []);
        const selectedCredits = courseCreditTotal(selectedCoursesBySemester.get(openExplorer.semester) ?? []);
        const exceedsRemoteGuidance = internshipType === "remote" && internshipSemester === openExplorer.semester && selectedCredits > 9;

        return (
          <div className="fixed inset-0 z-[70] flex items-end bg-black/45 p-0 sm:items-center sm:justify-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Options for semester ${openExplorer.semester}`}>
            <button type="button" aria-label="Close options" className="absolute inset-0 cursor-default" onClick={() => setExploringSemester(null)} />
            <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-t-3xl border border-border bg-surface shadow-xl sm:rounded-3xl">
              <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{isHistoricalEstimate ? "Historical odd/even estimate" : "Published offerings"}</p>
                  <h2 className="mt-1 text-xl font-bold text-foreground">Choose a Sem {openExplorer.semester} estimate</h2>
                  <p className="mt-1 text-xs leading-5 text-foreground-secondary">{explorerOptions.length} eligible option{explorerOptions.length === 1 ? "" : "s"}{isHistoricalEstimate ? ". This is a same-parity planning signal, not the official release." : " from the currently published list."}</p>
                </div>
                <button type="button" onClick={() => setExploringSemester(null)} className="dp-icon-btn h-10 w-10 shrink-0" aria-label="Close options"><X className="h-4 w-4" /></button>
              </div>

              <div className="border-b border-border px-5 py-4 sm:px-6">
                <label className="sr-only" htmlFor="roadmap-course-search">Search published options</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                  <input id="roadmap-course-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code or course name" className="dp-field pl-10" autoFocus />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["all", "DE", "FE", "HSS", "PE"] as CourseFilter[]).map((option) => (
                    <button key={option} type="button" onClick={() => setFilter(option)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${filter === option ? "bg-primary text-primary-foreground" : "bg-surface-hover text-foreground-secondary hover:text-foreground"}`}>
                      {option === "all" ? "All" : option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[52vh] overflow-y-auto px-5 py-4 sm:px-6">
                {isAwaySemesterLocked ? (
                  <div className="rounded-2xl border border-warning/25 bg-warning/10 p-5 text-sm leading-6 text-foreground-secondary"><LockKeyhole className="mb-2 h-5 w-5 text-warning" />This semester is currently reserved for an onsite internship or Semester Exchange, so local elective selection stays locked. Switch the simulator path if you want to compare electives here.</div>
                ) : visibleOptions.length === 0 ? (
                  <p className="py-10 text-center text-sm text-foreground-secondary">No matching option is available in this list.</p>
                ) : (
                  <div className="space-y-2">
                    {visibleOptions.map((course) => {
                      const selected = selectedIds.has(course.id);
                      return (
                        <button key={course.id} type="button" onClick={() => toggleSelection(openExplorer.semester, course.id)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${selected ? "border-primary/35 bg-primary/5" : "border-border hover:bg-surface-hover"}`}>
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`}>
                            {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-foreground">{course.code}</span><span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${categoryStyle[course.category] ?? categoryStyle.FE}`}>{course.category}</span></span>
                            <span className="mt-1 block text-xs leading-5 text-foreground-secondary">{course.name}</span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-foreground-secondary">{formatCredits(course.credits)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-border bg-surface-hover/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className={`text-xs ${exceedsRemoteGuidance ? "font-semibold text-warning" : "text-foreground-secondary"}`}>{selectedIds.size} estimated course{selectedIds.size === 1 ? "" : "s"} · {formatCredits(selectedCredits)}{exceedsRemoteGuidance ? " — above the 9-credit remote internship guidance" : ""}</p>
                <button type="button" onClick={() => setExploringSemester(null)} className="dp-btn dp-btn-primary px-4 py-2 text-xs">Done</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
