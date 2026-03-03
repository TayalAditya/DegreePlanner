"use client";

import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Award, BookOpen, Target, ChevronDown, AlertCircle } from "lucide-react";
import { ProgressChart } from "@/components/ProgressChart";
import { MinorPlannerCard } from "@/components/MinorPlannerCard";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { useMinorPlannerSelection } from "@/lib/minorPlannerClient";
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
  doingMTP2?: boolean;
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
  const [doingMTP1, setDoingMTP1] = useState(true);
  const [doingMTP2, setDoingMTP2] = useState(true);
  const [doingISTP, setDoingISTP] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);
  const { confirm } = useConfirmDialog();

  const minorPlanner = useMinorPlannerSelection();
  const minorCodesKey = useMemo(() => {
    if (!minorPlanner.enabled) return "";
    const codes = [...minorPlanner.codes].filter(Boolean).sort();
    return codes.join(",");
  }, [minorPlanner.enabled, minorPlanner.codes]);

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
        const minorCodesParam = minorCodesKey ? `&minorCodes=${encodeURIComponent(minorCodesKey)}` : "";

        const [progressRes, enrollmentsRes, userRes] = await Promise.all([
          fetch(`/api/progress?programId=${encodeURIComponent(primaryProgram.program.id)}${minorCodesParam}`),
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
          const mtp1 = data?.doingMTP ?? true;
          const mtp2 = (data?.doingMTP2 ?? mtp1) && mtp1;
          setDoingMTP1(mtp1);
          setDoingMTP2(mtp2);
          setDoingISTP(data?.doingISTP ?? true);
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
  }, [primaryProgram?.program?.id, minorCodesKey]);

  const refreshExtras = async () => {
    if (!primaryProgram?.program?.id) return;

    setProgressLoading(true);
    setEnrollmentsLoading(true);
    setProgressError(null);

    try {
      const minorCodesParam = minorCodesKey ? `&minorCodes=${encodeURIComponent(minorCodesKey)}` : "";

      const [progressRes, enrollmentsRes, userRes] = await Promise.all([
        fetch(`/api/progress?programId=${encodeURIComponent(primaryProgram.program.id)}${minorCodesParam}`),
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
        const mtp1 = data?.doingMTP ?? true;
        const mtp2 = (data?.doingMTP2 ?? mtp1) && mtp1;
        setDoingMTP1(mtp1);
        setDoingMTP2(mtp2);
        setDoingISTP(data?.doingISTP ?? true);
      }
    } catch (error) {
      console.error("Failed to load program progress:", error);
      setProgressError("Failed to load program progress");
    } finally {
      setProgressLoading(false);
      setEnrollmentsLoading(false);
    }
  };

  const saveProjectPrefs = async (mtp1: boolean, mtp2: boolean, istp: boolean) => {
    setSavingPrefs(true);
    setSavedPrefs(false);
    try {
      await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doingMTP: mtp1, doingMTP2: mtp2, doingISTP: istp }),
      });
      setSavedPrefs(true);
      setTimeout(() => setSavedPrefs(false), 2000);
      await refreshExtras();
    } catch {
      // ignore
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleMTP1Change = async (checked: boolean) => {
    if (!checked) {
      const ok = await confirm({
        title: "Skip MTP?",
        message:
          "Any course enrolled for MTP-1 or MTP-2 will be automatically deregistered. +8 DE credits will be added to your requirement.",
        confirmText: "Skip MTP",
        cancelText: "Keep MTP",
        variant: "warning",
      });
      if (!ok) return;

      setDoingMTP1(false);
      setDoingMTP2(false);
      saveProjectPrefs(false, false, doingISTP);
      return;
    }

    setDoingMTP1(true);
    saveProjectPrefs(true, doingMTP2, doingISTP);
  };

  const handleMTP2Change = async (checked: boolean) => {
    if (!checked) {
      const ok = await confirm({
        title: "Skip MTP-2?",
        message:
          "Any course enrolled for MTP-2 will be automatically deregistered. +5 DE credits will be added to your requirement.",
        confirmText: "Skip MTP-2",
        cancelText: "Keep MTP-2",
        variant: "warning",
      });
      if (!ok) return;

      setDoingMTP2(false);
      saveProjectPrefs(doingMTP1, false, doingISTP);
      return;
    }

    // MTP-2 implies MTP-1
    if (!doingMTP1) setDoingMTP1(true);
    setDoingMTP2(true);
    saveProjectPrefs(true, true, doingISTP);
  };

  const handleISTPChange = async (checked: boolean) => {
    if (!checked) {
      const ok = await confirm({
        title: "Skip ISTP?",
        message:
          "Any course enrolled for ISTP will be automatically deregistered. +4 FE credits will be added to your requirement.",
        confirmText: "Skip ISTP",
        cancelText: "Keep ISTP",
        variant: "warning",
      });
      if (!ok) return;
    }

    setDoingISTP(checked);
    saveProjectPrefs(doingMTP1, doingMTP2, checked);
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
                <div className="mt-6 space-y-3">
                  {/* Total bar */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-primary/8 rounded-xl border border-primary/20">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">Total Required</p>
                    </div>
                    <p className="text-xl font-bold text-primary">
                      {primaryProgram.program.totalCreditsRequired} cr
                    </p>
                  </div>

                  {/* IC + DC combined block */}
                  <div className="rounded-xl border border-border bg-surface/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Core Courses</p>
                      {progressData && (
                        <p className="text-xs text-foreground-secondary">
                          {progressData.completed.core} / {progressData.required.core} cr earned
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                        <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">IC</p>
                        <p className="text-xs text-foreground-secondary mb-1">Institutional Core</p>
                        <p className="text-2xl font-bold text-foreground">
                          {primaryProgram.program.icCredits}
                          <span className="text-xs font-normal text-foreground-secondary ml-1">cr</span>
                        </p>
                      </div>
                      <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-500/20">
                        <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">DC</p>
                        <p className="text-xs text-foreground-secondary mb-1">Discipline Core</p>
                        <p className="text-2xl font-bold text-foreground">
                          {primaryProgram.program.dcCredits}
                          <span className="text-xs font-normal text-foreground-secondary ml-1">cr</span>
                        </p>
                      </div>
                    </div>
                    {progressData && progressData.required.core > 0 && (
                      <div className="mt-3 h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, (progressData.completed.core / progressData.required.core) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Electives row */}
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* DE */}
                    <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                      <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">DE</p>
                      <p className="text-xs text-foreground-secondary mb-2">Discipline Electives</p>
                      {progressData ? (
                        <>
                          <p className="text-xl font-bold text-foreground">
                            {progressData.completed.de}
                            <span className="text-xs font-normal text-foreground-secondary"> / {progressData.required.de} cr</span>
                          </p>
                          {progressData.required.de > 0 && (
                            <div className="mt-2 h-1 bg-emerald-500/20 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (progressData.completed.de / progressData.required.de) * 100)}%` }} />
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xl font-bold text-foreground">{primaryProgram.program.deCredits}<span className="text-xs font-normal text-foreground-secondary ml-1">cr</span></p>
                      )}
                    </div>

                    {/* FE */}
                    <div className="bg-purple-500/10 rounded-xl p-3 border border-purple-500/20">
                      <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">FE</p>
                      <p className="text-xs text-foreground-secondary mb-2">Free Electives</p>
                      {progressData ? (
                        <>
                          <p className="text-xl font-bold text-foreground">
                            {progressData.completed.freeElective}
                            <span className="text-xs font-normal text-foreground-secondary"> / {progressData.required.freeElective} cr</span>
                          </p>
                          {progressData.required.freeElective > 0 && (
                            <div className="mt-2 h-1 bg-purple-500/20 rounded-full overflow-hidden">
                              <div className="h-full bg-purple-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (progressData.completed.freeElective / progressData.required.freeElective) * 100)}%` }} />
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xl font-bold text-foreground">{primaryProgram.program.feCredits}<span className="text-xs font-normal text-foreground-secondary ml-1">cr</span></p>
                      )}
                    </div>

                    {/* MTP */}
                    {progressData && progressData.required.mtp > 0 && (
                      <div className="bg-orange-500/10 rounded-xl p-3 border border-orange-500/20">
                        <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">MTP</p>
                        <p className="text-xs text-foreground-secondary mb-2">Major Tech Project</p>
                        <p className="text-xl font-bold text-foreground">
                          {progressData.completed.mtp}
                          <span className="text-xs font-normal text-foreground-secondary"> / {progressData.required.mtp} cr</span>
                        </p>
                        <div className="mt-2 h-1 bg-orange-500/20 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (progressData.completed.mtp / progressData.required.mtp) * 100)}%` }} />
                        </div>
                      </div>
                    )}

                    {/* ISTP */}
                    {progressData && progressData.required.istp > 0 && (
                      <div className="bg-rose-500/10 rounded-xl p-3 border border-rose-500/20">
                        <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">ISTP</p>
                        <p className="text-xs text-foreground-secondary mb-2">Socio-Tech Practicum</p>
                        <p className="text-xl font-bold text-foreground">
                          {progressData.completed.istp}
                          <span className="text-xs font-normal text-foreground-secondary"> / {progressData.required.istp} cr</span>
                        </p>
                        <div className="mt-2 h-1 bg-rose-500/20 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (progressData.completed.istp / progressData.required.istp) * 100)}%` }} />
                        </div>
                      </div>
                    )}

                    {/* BSCS Research */}
                    {progressData && progressData.required.pe > 0 && (
                      <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
                        <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Research</p>
                        <p className="text-xs text-foreground-secondary mb-2">Research Credits</p>
                        <p className="text-xl font-bold text-foreground">
                          {progressData.completed.pe}
                          <span className="text-xs font-normal text-foreground-secondary"> / {progressData.required.pe} cr</span>
                        </p>
                        <div className="mt-2 h-1 bg-amber-500/20 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, progressData.required.pe > 0 ? (progressData.completed.pe / progressData.required.pe) * 100 : 0)}%` }} />
                        </div>
                      </div>
                    )}
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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* MTP-1 */}
                          <label
                            className={`flex items-start gap-4 p-4 bg-background-secondary dark:bg-background rounded-xl border-2 transition-colors hover:border-primary/50 focus-within:ring-4 focus-within:ring-primary/20 ${
                              doingMTP1 ? "border-primary/40" : "border-border"
                            } ${savingPrefs ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <input
                              type="checkbox"
                              checked={doingMTP1}
                              onChange={(e) => handleMTP1Change(e.target.checked)}
                              disabled={savingPrefs}
                              className="mt-0.5 w-5 h-5 accent-primary cursor-pointer flex-shrink-0 disabled:cursor-not-allowed"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Award className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                <span className="font-semibold text-foreground text-sm">
                                  MTP-1
                                </span>
                              </div>
                              <p className="text-sm text-foreground-secondary">
                                3 credits · DP 498P · Semester 7
                              </p>
                              {!doingMTP1 && (
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 font-medium">
                                  ⚠️ Skipping adds +8 credits to DE
                                </p>
                              )}
                            </div>
                          </label>

                          {/* MTP-2 */}
                          <label
                            className={`flex items-start gap-4 p-4 bg-background-secondary dark:bg-background rounded-xl border-2 transition-colors hover:border-primary/50 focus-within:ring-4 focus-within:ring-primary/20 ${
                              doingMTP2 ? "border-primary/40" : "border-border"
                            } ${savingPrefs ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <input
                              type="checkbox"
                              checked={doingMTP2}
                              onChange={(e) => handleMTP2Change(e.target.checked)}
                              disabled={savingPrefs}
                              className="mt-0.5 w-5 h-5 accent-primary cursor-pointer flex-shrink-0 disabled:cursor-not-allowed"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Award className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                <span className="font-semibold text-foreground text-sm">
                                  MTP-2
                                </span>
                              </div>
                              <p className="text-sm text-foreground-secondary">
                                5 credits · DP 499P · Semester 8 · Requires MTP-1
                              </p>
                              {doingMTP1 && !doingMTP2 && (
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 font-medium">
                                  ⚠️ Skipping adds +5 credits to DE
                                </p>
                              )}
                              {!doingMTP1 && (
                                <p className="text-xs text-foreground-secondary mt-2">
                                  Enabling MTP-2 will automatically enable MTP-1.
                                </p>
                              )}
                            </div>
                          </label>

                          {/* ISTP */}
                          <label
                            className={`flex items-start gap-4 p-4 bg-background-secondary dark:bg-background rounded-xl border-2 transition-colors hover:border-primary/50 focus-within:ring-4 focus-within:ring-primary/20 ${
                              doingISTP ? "border-primary/40" : "border-border"
                            } ${savingPrefs ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <input
                              type="checkbox"
                              checked={doingISTP}
                              onChange={(e) => handleISTPChange(e.target.checked)}
                              disabled={savingPrefs}
                              className="mt-0.5 w-5 h-5 accent-primary cursor-pointer flex-shrink-0 disabled:cursor-not-allowed"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Award className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                <span className="font-semibold text-foreground text-sm">
                                  ISTP
                                </span>
                              </div>
                              <p className="text-sm text-foreground-secondary">
                                4 credits · DP 301P · Semester 6
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
            </div>
          )}

          <MinorPlannerCard enrollments={enrollments} isLoading={enrollmentsLoading} />

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
