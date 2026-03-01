"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  X,
  GraduationCap,
  Award,
  BookOpen,
  Target,
  ChevronDown,
  Loader2,
} from "lucide-react";
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
    branchMappings?: { courseCategory: string; branch: string }[];
  };
}

interface UserProgramData {
  programs: UserProgram[];
  enrollments: Enrollment[];
  userSettings: { branch?: string };
  progressData: any | null;
}

interface UserProgramModalProps {
  userId: string;
  userName: string;
  onClose: () => void;
}

export function UserProgramModal({ userId, userName, onClose }: UserProgramModalProps) {
  const { data, isLoading, isError, error } = useQuery<UserProgramData>({
    queryKey: ["admin-user-programs", userId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/admin/users/${userId}/programs`, { signal });
      if (!res.ok) throw new Error("Failed to load programs.");
      return res.json();
    },
    staleTime: 60_000,
  });

  // Escape key to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const programs = data?.programs ?? [];
  const enrollments = data?.enrollments ?? [];
  const userSettings = data?.userSettings ?? {};
  const progressData = data?.progressData ?? null;

  const primaryProgram = programs.find((p) => p.isPrimary);
  const secondaryPrograms = programs.filter((p) => !p.isPrimary);

  const programEnrollments = primaryProgram?.program?.id
    ? enrollments.filter((e) => e.programId === primaryProgram.program.id)
    : [];

  const completedEnrollments = programEnrollments.filter(
    (e) => e.status === "COMPLETED" && (!e.grade || e.grade !== "F")
  );

  const semesterCourses: Record<number, Enrollment[]> = completedEnrollments.reduce(
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Panel */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">{userName}</h2>
            <p className="text-sm text-foreground-secondary">Academic Programs</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-4 p-2 rounded-lg hover:bg-surface text-foreground-secondary hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-error font-medium">
                {error instanceof Error ? error.message : "Failed to load programs."}
              </p>
            </div>
          ) : programs.length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap className="w-12 h-12 text-foreground-secondary mx-auto mb-3" />
              <p className="text-foreground-secondary">No programs enrolled.</p>
            </div>
          ) : (
            <>
              {/* Primary Program */}
              {primaryProgram && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">Primary Program</h3>
                  </div>

                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border-2 border-primary p-4 sm:p-6">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="text-xl font-bold text-foreground">
                        {primaryProgram.program.name}
                      </h4>
                      <span className="px-3 py-1 bg-primary text-white text-sm rounded-full">
                        {primaryProgram.program.type}
                      </span>
                    </div>
                    <p className="text-foreground-secondary mb-4">
                      {primaryProgram.program.code} • {primaryProgram.program.department}
                    </p>

                    {/* Credit Requirements */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-surface/50 rounded-lg p-3 border border-border">
                        <p className="text-xs text-foreground-secondary flex items-center gap-1 mb-1">
                          <Award className="w-3 h-3" /> Total Credits
                        </p>
                        <p className="text-xl font-bold text-foreground">
                          {primaryProgram.program.totalCreditsRequired}
                        </p>
                      </div>
                      <div className="bg-surface/50 rounded-lg p-3 border border-border">
                        <p className="text-xs text-foreground-secondary flex items-center gap-1 mb-1">
                          <BookOpen className="w-3 h-3 text-blue-500" /> IC + DC
                        </p>
                        <p className="text-xl font-bold text-foreground">
                          {primaryProgram.program.icCredits + primaryProgram.program.dcCredits}
                        </p>
                      </div>
                      <div className="bg-surface/50 rounded-lg p-3 border border-border">
                        <p className="text-xs text-foreground-secondary flex items-center gap-1 mb-1">
                          <BookOpen className="w-3 h-3 text-green-500" /> DE
                        </p>
                        <p className="text-xl font-bold text-foreground">
                          {primaryProgram.program.deCredits}
                        </p>
                      </div>
                      <div className="bg-surface/50 rounded-lg p-3 border border-border">
                        <p className="text-xs text-foreground-secondary flex items-center gap-1 mb-1">
                          <BookOpen className="w-3 h-3 text-purple-500" /> Free Electives
                        </p>
                        <p className="text-xl font-bold text-foreground">
                          {primaryProgram.program.feCredits}
                        </p>
                      </div>
                    </div>

                    {/* MTP / ISTP */}
                    {primaryProgram.program.mtpIstpCredits > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-sm font-semibold text-foreground mb-2">
                          Project Requirements
                        </p>
                        <div className="flex flex-wrap gap-4 text-sm text-foreground-secondary">
                          {primaryProgram.program.code !== "BSCS" ? (
                            <>
                              <span>MTP: 8 cr (MTP-1: 3cr + MTP-2: 5cr)</span>
                              <span>ISTP: 4 cr (Sem 6)</span>
                            </>
                          ) : (
                            <span>
                              Research Projects: {primaryProgram.program.mtpIstpCredits} cr
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Progress chart + semester breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {progressData ? (
                      <ProgressChart
                        progress={progressData}
                        isLoading={false}
                        enrollments={programEnrollments}
                        userBranch={userSettings.branch}
                      />
                    ) : (
                      <div className="bg-surface rounded-lg border border-border p-6 flex items-center justify-center">
                        <p className="text-sm text-foreground-secondary">
                          No progress data available.
                        </p>
                      </div>
                    )}

                    <div className="bg-surface rounded-lg border border-border p-4">
                      <h4 className="font-semibold text-foreground mb-1">Credits Counted (Courses)</h4>
                      <p className="text-xs text-foreground-secondary mb-3">
                        Collapsed by semester.
                      </p>

                      {semesters.length === 0 ? (
                        <p className="text-sm text-foreground-secondary">No completed courses yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {semesters.map((sem) => {
                            const courses = semesterCourses[sem] || [];
                            const credits = courses.reduce(
                              (sum, e) => sum + (e.course?.credits || 0),
                              0
                            );
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
                                  <ChevronDown className="w-4 h-4 shrink-0 text-foreground-secondary transition-transform duration-200 group-open:rotate-180" />
                                </summary>

                                <div className="px-4 pb-4 overflow-x-auto">
                                  <table className="min-w-[520px] w-full text-sm">
                                    <thead className="text-foreground-secondary">
                                      <tr className="border-b border-border">
                                        <th className="py-2 pr-4 text-left whitespace-nowrap">Code</th>
                                        <th className="py-2 pr-4 text-left min-w-[12rem]">Course</th>
                                        <th className="py-2 pr-4 text-right whitespace-nowrap">Cr</th>
                                        <th className="py-2 text-left whitespace-nowrap">Result</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {courses.map((e) => (
                                        <tr
                                          key={e.id}
                                          className="border-b border-border/60 last:border-0"
                                        >
                                          <td className="py-2 pr-4 font-semibold text-foreground whitespace-nowrap">
                                            {formatCourseCode(e.course?.code)}
                                          </td>
                                          <td className="py-2 pr-4 text-foreground-secondary">
                                            {e.course?.name}
                                          </td>
                                          <td className="py-2 pr-4 text-right text-foreground">
                                            {e.course?.credits || 0}
                                          </td>
                                          <td className="py-2">
                                            <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-semibold whitespace-nowrap">
                                              Completed{e.grade ? ` (${e.grade})` : ""}
                                            </span>
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

                  <MinorPlannerCard enrollments={enrollments} />
                </div>
              )}

              {/* Secondary Programs */}
              {secondaryPrograms.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">Additional Programs</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {secondaryPrograms.map((up) => (
                      <div
                        key={up.id}
                        className="bg-surface rounded-lg border border-border p-5 hover:border-primary transition-colors"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h4 className="text-lg font-bold text-foreground">{up.program.name}</h4>
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-xs rounded-full">
                            {up.program.type}
                          </span>
                        </div>
                        <p className="text-sm text-foreground-secondary mb-3">
                          {up.program.code} • {up.program.department}
                        </p>
                        <div className="flex gap-6 text-sm">
                          <div>
                            <p className="text-foreground-secondary">Total Credits</p>
                            <p className="font-bold text-foreground">
                              {up.program.totalCreditsRequired}
                            </p>
                          </div>
                          <div>
                            <p className="text-foreground-secondary">Status</p>
                            <p className="font-bold text-green-500">{up.status}</p>
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
      </div>
    </div>
  );
}
