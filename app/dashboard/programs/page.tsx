"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Award, BookOpen, Target, ChevronDown, AlertCircle } from "lucide-react";
import { ProgressChart } from "@/components/ProgressChart";
import { MinorPlannerCard } from "@/components/MinorPlannerCard";
import { formatCourseCode } from "@/lib/utils";

interface Program {
  id: string;
  name: string;
  code: string;
  type: string;
  department: string;
  totalCreditsRequired: number;
  icCredits: number;
  dcCredits: number;
  deCredits: number;
  feCredits: number;
  mtpIstpCredits: number;
  description?: string;
}

interface UserProgram {
  id: string;
  programType: string;
  isPrimary: boolean;
  startSemester: number;
  status: string;
  program: Program;
}

interface Enrollment {
  id: string;
  semester: number;
  year: number;
  term: string;
  status: string;
  grade?: string | null;
  programId?: string | null;
  course: {
    code: string;
    name: string;
    credits: number;
    department: string;
    branchMappings?: {
      courseCategory: string;
      branch: string;
    }[];
  };
}

interface UserSettings {
  branch?: string;
  doingMTP?: boolean;
  doingISTP?: boolean;
}

export default function ProgramsPage() {
  const [userPrograms, setUserPrograms] = useState<UserProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState<any | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [doingMTP, setDoingMTP] = useState(true);
  const [doingISTP, setDoingISTP] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      const res = await fetch("/api/programs");
      if (res.ok) {
        const data = await res.json();
        setUserPrograms(data);
      }
    } catch (error) {
      console.error("Failed to fetch programs:", error);
    } finally {
      setLoading(false);
    }
  };

  const primaryProgram = userPrograms.find((p) => p.isPrimary);

  useEffect(() => {
    if (!primaryProgram?.program?.id) return;

    const loadExtras = async () => {
      setProgressLoading(true);
      setEnrollmentsLoading(true);
      setProgressError(null);

      try {
        const [progressRes, enrollmentsRes, userRes] = await Promise.all([
          fetch(`/api/progress?programId=${encodeURIComponent(primaryProgram.program.id)}`),
          fetch("/api/enrollments"),
          fetch("/api/user/settings"),
        ]);

        if (progressRes.ok) {
          const data = await progressRes.json();
          setProgressData(data?.progress ?? null);
        } else {
          setProgressError("Failed to load program progress");
        }

        if (enrollmentsRes.ok) {
          const data = await enrollmentsRes.json();
          setEnrollments(Array.isArray(data) ? data : []);
        }

        if (userRes.ok) {
          const data = await userRes.json();
          setUserSettings(data ?? null);
          setDoingMTP(data?.doingMTP ?? true);
          setDoingISTP(data?.doingISTP ?? false);
        }
      } catch (error) {
        console.error("Failed to load program progress:", error);
        setProgressError("Failed to load program progress");
      } finally {
        setProgressLoading(false);
        setEnrollmentsLoading(false);
      }
    };

    loadExtras();
  }, [primaryProgram?.program?.id]);

  const saveProjectPrefs = async (mtp: boolean, istp: boolean) => {
    setSavingPrefs(true);
    setSavedPrefs(false);
    try {
      await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doingMTP: mtp, doingISTP: istp }),
      });
      setSavedPrefs(true);
      setTimeout(() => setSavedPrefs(false), 2000);
    } catch {
      // ignore
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleMTPChange = (checked: boolean) => {
    setDoingMTP(checked);
    saveProjectPrefs(checked, doingISTP);
  };

  const handleISTPChange = (checked: boolean) => {
    setDoingISTP(checked);
    saveProjectPrefs(doingMTP, checked);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const secondaryPrograms = userPrograms.filter((p) => !p.isPrimary);

  const programEnrollments = primaryProgram?.program?.id
    ? enrollments.filter(
        (e) => e.programId === primaryProgram.program.id || e.programId == null
      )
    : enrollments;

  const visibleEnrollments = programEnrollments.filter(
    (e) =>
      e.status === "IN_PROGRESS" ||
      (e.status === "COMPLETED" && (!e.grade || e.grade !== "F"))
  );

  const semesterCourses: Record<number, Enrollment[]> = visibleEnrollments.reduce(
    (acc: Record<number, Enrollment[]>, e) => {
      const sem = e.semester || 0;
      if (!acc[sem]) acc[sem] = [];
      acc[sem].push(e);
      return acc;
    },
    {}
  );

  const semesters = Object.keys(semesterCourses)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  const latestSemester = semesters.length > 0 ? semesters[semesters.length - 1] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Academic Programs</h1>
        <p className="text-foreground-secondary mt-2">
          View your enrolled programs and credit requirements
        </p>
      </div>

      {userPrograms.length === 0 ? (
        <div className="bg-surface rounded-lg border border-border p-6 sm:p-8 text-center">
          <GraduationCap className="w-16 h-16 text-foreground-secondary mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            No Programs Enrolled
          </h2>
          <p className="text-foreground-secondary">
            Contact your academic advisor to enroll in a program
          </p>
        </div>
      ) : (
        <>
          {/* Primary Program */}
          {primaryProgram && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Primary Program</h2>
              </div>
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border-2 border-primary p-4 sm:p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="text-xl sm:text-2xl font-bold text-foreground">
                        {primaryProgram.program.name}
                      </h3>
                      <span className="px-3 py-1 bg-primary text-white text-sm rounded-full">
                        {primaryProgram.program.type}
                      </span>
                    </div>
                    <p className="text-foreground-secondary">
                      {primaryProgram.program.code} • {primaryProgram.program.department}
                    </p>
                    {primaryProgram.program.description && (
                      <p className="text-foreground-secondary mt-2">
                        {primaryProgram.program.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Credit Requirements */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  <div className="bg-surface/50 rounded-lg p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="w-4 h-4 text-primary" />
                      <p className="text-sm font-medium text-foreground-secondary">Total Credits</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {primaryProgram.program.totalCreditsRequired}
                    </p>
                  </div>

                  <div className="bg-surface/50 rounded-lg p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="w-4 h-4 text-blue-500" />
                      <p className="text-sm font-medium text-foreground-secondary">IC + DC</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {primaryProgram.program.icCredits + primaryProgram.program.dcCredits}
                    </p>
                  </div>

                  <div className="bg-surface/50 rounded-lg p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="w-4 h-4 text-green-500" />
                      <p className="text-sm font-medium text-foreground-secondary">Electives (DE)</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {primaryProgram.program.deCredits}
                    </p>
                  </div>

                  <div className="bg-surface/50 rounded-lg p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="w-4 h-4 text-purple-500" />
                      <p className="text-sm font-medium text-foreground-secondary">Free Electives</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {primaryProgram.program.feCredits}
                    </p>
                  </div>
                </div>

                {/* MTP/ISTP Preferences */}
                {primaryProgram.program.mtpIstpCredits > 0 && (
                  <div className="mt-6 pt-6 border-t border-border">
                    {primaryProgram.program.code !== "BSCS" ? (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-semibold text-foreground">Project Preferences</h4>
                            <p className="text-xs text-foreground-secondary mt-0.5">
                              Toggle to adjust credit distribution in your progress tracker
                            </p>
                          </div>
                          <span
                            className={`text-xs transition-opacity duration-300 ${
                              savingPrefs
                                ? "text-foreground-secondary opacity-100"
                                : savedPrefs
                                ? "text-green-600 dark:text-green-400 opacity-100"
                                : "opacity-0"
                            }`}
                          >
                            {savingPrefs ? "Saving…" : "Saved ✓"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label
                            className={`flex items-start gap-4 p-4 bg-background-secondary dark:bg-background rounded-xl border-2 transition-colors cursor-pointer hover:border-primary/50 focus-within:ring-4 focus-within:ring-primary/20 ${
                              doingMTP ? "border-primary/40" : "border-border"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={doingMTP}
                              onChange={(e) => handleMTPChange(e.target.checked)}
                              className="mt-0.5 w-5 h-5 accent-primary cursor-pointer flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Award className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                <span className="font-semibold text-foreground text-sm">
                                  Major Technical Project (MTP)
                                </span>
                              </div>
                              <p className="text-sm text-foreground-secondary">
                                8 credits · MTP-1 (3cr) + MTP-2 (5cr)
                              </p>
                              {!doingMTP && (
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 font-medium">
                                  ⚠️ Skipping adds +8 credits to DE
                                </p>
                              )}
                            </div>
                          </label>

                          <label
                            className={`flex items-start gap-4 p-4 bg-background-secondary dark:bg-background rounded-xl border-2 transition-colors cursor-pointer hover:border-primary/50 focus-within:ring-4 focus-within:ring-primary/20 ${
                              doingISTP ? "border-primary/40" : "border-border"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={doingISTP}
                              onChange={(e) => handleISTPChange(e.target.checked)}
                              className="mt-0.5 w-5 h-5 accent-primary cursor-pointer flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Award className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                <span className="font-semibold text-foreground text-sm">
                                  Socio-Technical Practicum (ISTP)
                                </span>
                              </div>
                              <p className="text-sm text-foreground-secondary">
                                4 credits · Semester 6
                              </p>
                              {!doingISTP && (
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 font-medium">
                                  ⚠️ Skipping adds +4 credits to FE
                                </p>
                              )}
                            </div>
                          </label>
                        </div>

                        <p className="mt-3 text-xs text-foreground-secondary">
                          Changes save automatically and update your credit distribution.
                        </p>
                      </>
                    ) : (
                      <>
                        <h4 className="font-semibold text-foreground mb-3">Project Requirements</h4>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                            <Award className="w-5 h-5 text-purple-500" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Research Projects</p>
                            <p className="text-sm text-foreground-secondary">
                              {primaryProgram.program.mtpIstpCredits} credits
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {progressError ? (
                  <div className="bg-surface rounded-lg border border-border p-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Couldn&apos;t load progress</p>
                        <p className="text-sm text-foreground-secondary mt-1">
                          Please refresh the page or try again later.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : progressLoading ? (
                  <ProgressChart progress={{} as any} isLoading={true} />
                ) : progressData ? (
                  <ProgressChart
                    progress={progressData}
                    isLoading={false}
                    enrollments={programEnrollments}
                    userBranch={userSettings?.branch}
                  />
                ) : (
                  <div className="bg-surface rounded-lg border border-border p-6">
                    <p className="text-foreground-secondary text-sm">
                      Progress will appear once you have an active primary program.
                    </p>
                  </div>
                )}

                <div className="bg-surface rounded-lg border border-border p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                    Credits Counted (Courses)
                  </h3>
                  <p className="text-xs text-foreground-secondary mb-4">
                    Collapsed by semester so the page stays clean.
                  </p>

                  {enrollmentsLoading ? (
                    <div className="space-y-3 animate-pulse">
                      <div className="h-4 bg-background-secondary dark:bg-background rounded w-1/3"></div>
                      <div className="h-10 bg-background-secondary dark:bg-background rounded"></div>
                      <div className="h-10 bg-background-secondary dark:bg-background rounded"></div>
                    </div>
                  ) : semesters.length === 0 ? (
                    <p className="text-sm text-foreground-secondary">
                      No courses yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {semesters.map((sem) => {
                        const courses = semesterCourses[sem] || [];
                        const credits = courses.reduce((sum, e) => sum + (e.course?.credits || 0), 0);

                        return (
                          <details
                            key={sem}
                            open={latestSemester !== null && sem === latestSemester}
                            className="group rounded-lg border border-border bg-surface-hover/50"
                          >
                            <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground">Semester {sem}</p>
                                <p className="text-xs text-foreground-secondary">
                                  {courses.length} courses • {credits} credits
                                </p>
                              </div>
                              <ChevronDown className="w-4 h-4 text-foreground-secondary transition-transform duration-200 group-open:rotate-180" />
                            </summary>

                            <div className="px-4 pb-4 overflow-x-auto">
                              <table className="min-w-[640px] w-full text-sm">
                                <thead className="text-foreground-secondary">
                                  <tr className="border-b border-border">
                                    <th className="py-2 pr-4 text-left whitespace-nowrap">Code</th>
                                    <th className="py-2 pr-4 text-left min-w-[16rem]">Course</th>
                                    <th className="py-2 pr-4 text-right whitespace-nowrap">Credits</th>
                                    <th className="py-2 text-left whitespace-nowrap">Result</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {courses.map((e) => (
                                    <tr key={e.id} className="border-b border-border/60 last:border-0">
                                      <td className="py-2 pr-4 font-semibold text-foreground whitespace-nowrap">
                                        {formatCourseCode(e.course?.code)}
                                      </td>
                                      <td className="py-2 pr-4 text-foreground-secondary">
                                        {e.course?.name}
                                      </td>
                                      <td className="py-2 pr-4 text-right text-foreground whitespace-nowrap">
                                        {e.course?.credits || 0}
                                      </td>
                                      <td className="py-2 whitespace-nowrap">
                                        {e.status === "IN_PROGRESS" ? (
                                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                            <span className="font-semibold">In Progress</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                                            <span className="font-semibold">
                                              Completed{e.grade ? ` (${e.grade})` : ""}
                                            </span>
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <MinorPlannerCard enrollments={enrollments} isLoading={enrollmentsLoading} />
            </div>
          )}

          {/* Secondary Programs (Minor/Double Major) */}
          {secondaryPrograms.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Additional Programs</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {secondaryPrograms.map((userProgram) => (
                  <div
                    key={userProgram.id}
                    className="bg-surface rounded-lg border border-border p-6 hover:border-primary transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-foreground">
                        {userProgram.program.name}
                      </h3>
                      <span className="px-3 py-1 bg-blue-500/10 text-blue-500 text-sm rounded-full">
                        {userProgram.program.type}
                      </span>
                    </div>
                    <p className="text-foreground-secondary mb-4">
                      {userProgram.program.code} • {userProgram.program.department}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm text-foreground-secondary">Total Credits</p>
                        <p className="text-lg font-bold text-foreground">
                          {userProgram.program.totalCreditsRequired}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-foreground-secondary">Status</p>
                        <p className="text-lg font-bold text-green-500">
                          {userProgram.status}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
