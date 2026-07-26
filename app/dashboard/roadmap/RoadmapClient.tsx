"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
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
  source: "curriculum" | "live";
  offeringYear?: number;
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
  }>;
};

type InternshipType = "none" | "remote" | "onsite";
type InternshipSemester = 6 | 7 | 8;
type CourseFilter = "all" | "DE" | "FE" | "HSS" | "PE";

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

export default function RoadmapClient({ data }: { data: RoadmapData | null }) {
  const [internshipType, setInternshipType] = useState<InternshipType>("none");
  const [internshipSemester, setInternshipSemester] = useState<InternshipSemester>(6);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [exploringSemester, setExploringSemester] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CourseFilter>("all");
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
        };
        if (parsed.internshipType === "none" || parsed.internshipType === "remote" || parsed.internshipType === "onsite") {
          setInternshipType(parsed.internshipType);
        }
        if (parsed.internshipSemester === 6 || parsed.internshipSemester === 7 || parsed.internshipSemester === 8) {
          setInternshipSemester(parsed.internshipSemester);
        }
        if (parsed.selections && typeof parsed.selections === "object") {
          setSelections(parsed.selections);
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
      JSON.stringify({ internshipType, internshipSemester, selections })
    );
  }, [data, hydrated, internshipType, internshipSemester, selections]);

  const selectedCoursesBySemester = useMemo(() => {
    const selected = new Map<number, RoadmapCourse[]>();
    if (!data) return selected;

    for (const semester of data.semesters) {
      const ids = new Set(selections[String(semester.semester)] ?? []);
      selected.set(semester.semester, semester.liveOptions.filter((course) => ids.has(course.id)));
    }
    return selected;
  }, [data, selections]);

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
  const isOnsiteSemesterLocked = internshipType === "onsite" && internshipSemester === exploringSemester;
  const liveSemesterLabels = data.semesters
    .filter((semester) => semester.liveOptions.length > 0)
    .map((semester) => `${semesterLabel(semester.semester)} ${semester.liveOptions[0].offeringYear ?? ""}`.trim());

  const chooseScenario = (type: InternshipType, semester: InternshipSemester = 6) => {
    setInternshipType(type);
    setInternshipSemester(semester);
  };

  const toggleSelection = (semester: number, courseId: string) => {
    if (internshipType === "onsite" && internshipSemester === semester) return;
    setSelections((current) => {
      const key = String(semester);
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
    window.localStorage.removeItem(data.storageKey);
  };

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
            Draft your Semester 6–8 course path, then pressure-test it against a semester-long internship. Your committed courses come from the branch and batch curriculum; elective picks only come from published offerings.
          </p>
        </div>
      </section>

      <section className="dp-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Path simulator</p>
            <h2 className="mt-1 text-lg font-bold text-foreground">What kind of semester-long internship are you planning around?</h2>
            <p className="mt-1 text-sm text-foreground-secondary">This changes the workload signal below. It does not submit or change your registration.</p>
          </div>
          <button type="button" onClick={resetDraft} className="dp-btn dp-btn-ghost shrink-0 text-xs">
            <RotateCcw className="h-4 w-4" /> Reset draft
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
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
        </div>

        {internshipType !== "none" && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface-hover/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm leading-6 text-foreground-secondary">
                <span className="font-semibold text-foreground">Place it in:</span>{" "}
                {internshipType === "remote"
                  ? "Remote 396P can run with at most 9 credits alongside, so use the estimate to keep the semester intentionally light."
                  : "Onsite 399P is treated as a no-course semester. Any required course shown there needs a separate academic rescheduling decision."}
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-border bg-surface p-1">
              {([6, 7, 8] as InternshipSemester[]).map((semester) => (
                <button
                  key={semester}
                  type="button"
                  onClick={() => setInternshipSemester(semester)}
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
      </section>

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
            const requiredPending = semester.requiredCourses.filter((course) => !course.completed);
            const markedElectives = semester.mappedElectives.filter((course) => !course.completed);
            const status = statusCopy(semester.status);
            const isInternshipSemester = internshipType !== "none" && internshipSemester === semester.semester;
            const isOnsite = isInternshipSemester && internshipType === "onsite";
            const baseCredits = courseCreditTotal(requiredPending);
            const selectedCredits = courseCreditTotal(selectedCourses);
            const blockingRequirements = isOnsite ? requiredPending : [];

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
                    <div className={`mt-4 rounded-xl border p-3 ${isOnsite ? "border-warning/25 bg-warning/10" : "border-accent/25 bg-accent/10"}`}>
                      <div className="flex gap-2">
                        {isOnsite ? <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> : <BriefcaseBusiness className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
                        <div>
                          <p className="text-xs font-semibold text-foreground">{isOnsite ? "DP-399P · Onsite internship" : "DP-396P · Remote internship"}</p>
                          <p className="mt-1 text-xs leading-5 text-foreground-secondary">
                            {isOnsite ? "Elective estimation is locked for this semester." : "Keep your selected courses at or below 9 credits alongside the internship."}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Mapped commitments</p>
                      {semester.requiredCourses.length === 0 ? (
                        <p className="mt-2 text-xs leading-5 text-foreground-secondary">No compulsory course is mapped here in the current curriculum data.</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {semester.requiredCourses.map((course) => (
                            <div key={course.id} className={`rounded-xl border px-3 py-2 ${course.completed ? "border-border bg-surface-hover/50 opacity-65" : "border-border bg-surface"}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[11px] font-bold text-foreground">{course.code}</span>
                                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${categoryStyle[course.category] ?? categoryStyle.FE}`}>{course.category}</span>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-foreground-secondary">{course.name}</p>
                              <p className="mt-1 text-[11px] font-medium text-foreground-secondary">{course.completed ? "Done" : formatCredits(course.credits)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

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
                        <p className="mt-0.5 text-[11px] text-foreground-secondary">{selectedCourses.length > 0 ? `${selectedCourses.length} course${selectedCourses.length === 1 ? "" : "s"} · ${formatCredits(selectedCredits)}` : "No live offering selected"}</p>
                      </div>
                      {semester.liveOptions.length > 0 && (
                        <button type="button" onClick={() => { setExploringSemester(semester.semester); setSearch(""); setFilter("all"); }} disabled={isOnsite} className="dp-btn dp-btn-soft min-h-0 px-3 py-2 text-xs disabled:cursor-not-allowed">
                          <Plus className="h-3.5 w-3.5" /> Options
                        </button>
                      )}
                    </div>
                    {semester.liveOptions.length === 0 && (
                      <p className="mt-2 text-[11px] leading-5 text-foreground-secondary">Live offerings have not been published for this semester yet. This is deliberately not guessed from the catalog.</p>
                    )}
                    {selectedCourses.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {selectedCourses.map((course) => (
                          <button key={course.id} type="button" onClick={() => toggleSelection(semester.semester, course.id)} disabled={isOnsite} className="rounded-lg border border-success/20 bg-success/10 px-2 py-1 text-left text-[11px] font-medium text-success transition-colors hover:bg-success/15 disabled:cursor-not-allowed">
                            {course.code} <span className="text-success/80">×</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {blockingRequirements.length > 0 && (
                    <div className="mt-4 rounded-xl border border-warning/25 bg-warning/10 p-3">
                      <div className="flex gap-2">
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                        <p className="text-xs leading-5 text-foreground-secondary"><span className="font-semibold text-foreground">Decision needed:</span> {blockingRequirements.map((course) => course.code).join(", ")} still appear as mapped commitments. Confirm their rescheduling before treating this as an onsite semester.</p>
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
              <p className="mt-1 text-xs leading-5 text-foreground-secondary">The Options drawer only exposes electives from published offerings for that semester.</p>
            </div>
            <div className="rounded-xl bg-surface-hover p-3">
              <p className="text-xs font-semibold text-foreground">3. Test the trade-off</p>
              <p className="mt-1 text-xs leading-5 text-foreground-secondary">Move the internship from Sem 6 to 7 or 8 and see which commitments require a decision.</p>
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
        const visibleOptions = openExplorer.liveOptions.filter((course) => {
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
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Published offerings</p>
                  <h2 className="mt-1 text-xl font-bold text-foreground">Choose a Sem {openExplorer.semester} estimate</h2>
                  <p className="mt-1 text-xs leading-5 text-foreground-secondary">{openExplorer.liveOptions.length} eligible option{openExplorer.liveOptions.length === 1 ? "" : "s"} from the currently published list.</p>
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
                {isOnsiteSemesterLocked ? (
                  <div className="rounded-2xl border border-warning/25 bg-warning/10 p-5 text-sm leading-6 text-foreground-secondary"><LockKeyhole className="mb-2 h-5 w-5 text-warning" />This is currently an onsite internship semester, so course selection stays locked. Switch the simulator path if you want to compare electives here.</div>
                ) : visibleOptions.length === 0 ? (
                  <p className="py-10 text-center text-sm text-foreground-secondary">No published option matches that search.</p>
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
