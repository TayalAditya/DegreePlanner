"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  X,
  GraduationCap,
  Award,
  BookOpen,
  Target,
  ChevronDown,
  Loader2,
  Trash2,
} from "lucide-react";
import { ProgressChart } from "@/components/ProgressChart";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";
import { ICB1_CODES, ICB2_CODES, IC_BASKET_COMPULSIONS } from "@/lib/icBasketConfig";
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
  courseType: string;
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

const HSS_CORE_CAP = 12;

const categoryLabels = {
  IC: "Institute Core",
  IC_BASKET: "IC Basket",
  DC: "Discipline Core",
  DE: "Discipline Elective",
  FE: "Free Elective",
  HSS: "Humanities & Social Sciences",
  IKS: "Indian Knowledge System",
  MTP: "Major Technical Project",
  ISTP: "Interactive Socio-Technical Practicum",
};

const categoryColors: Record<keyof typeof categoryLabels, { bg: string; text: string }> = {
  IC: { bg: "bg-info/10", text: "text-info" },
  IC_BASKET: { bg: "bg-accent/10", text: "text-accent" },
  DC: { bg: "bg-primary/10", text: "text-primary" },
  DE: { bg: "bg-secondary/10", text: "text-secondary" },
  FE: { bg: "bg-success/10", text: "text-success" },
  HSS: { bg: "bg-warning/10", text: "text-warning" },
  IKS: { bg: "bg-warning/10", text: "text-warning" },
  MTP: { bg: "bg-error/10", text: "text-error" },
  ISTP: { bg: "bg-accent/10", text: "text-accent" },
};

export function UserProgramModal({ userId, userName, onClose }: UserProgramModalProps) {
  const [view, setView] = useState<"progress" | "programs">("progress");
  const [deletingEnrollmentId, setDeletingEnrollmentId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();

  const { data, isLoading, isError, error } = useQuery<UserProgramData>({
    queryKey: ["admin-user-programs", userId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/admin/users/${userId}/programs`, { signal });
      if (!res.ok) throw new Error("Failed to load programs.");
      return res.json();
    },
    staleTime: 60_000,
  });

  const deleteEnrollmentMutation = useMutation<
    string,
    Error,
    string,
    { previous?: UserProgramData }
  >({
    mutationFn: async (enrollmentId) => {
      const res = await fetch(`/api/enrollments/${enrollmentId}`, { method: "DELETE" });

      let body: any = null;
      try {
        body = await res.json();
      } catch {
        // ignore
      }

      if (!res.ok) {
        throw new Error(body?.error || "Failed to delete course.");
      }

      return enrollmentId;
    },
    onMutate: async (enrollmentId) => {
      setDeletingEnrollmentId(enrollmentId);

      await queryClient.cancelQueries({ queryKey: ["admin-user-programs", userId] });
      const previous = queryClient.getQueryData<UserProgramData>([
        "admin-user-programs",
        userId,
      ]);

      queryClient.setQueryData<UserProgramData>(["admin-user-programs", userId], (old) => {
        if (!old) return old;
        return {
          ...old,
          enrollments: old.enrollments.filter((e) => e.id !== enrollmentId),
        };
      });

      return { previous };
    },
    onError: (err, _enrollmentId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["admin-user-programs", userId], context.previous);
      }
      showToast("error", err instanceof Error ? err.message : "Failed to delete course.");
    },
    onSuccess: () => {
      showToast("success", "Course removed");
    },
    onSettled: () => {
      setDeletingEnrollmentId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-user-programs", userId] });
    },
  });

  const onDeleteEnrollment = async (enrollment: Enrollment) => {
    const ok = await confirm({
      title: "Remove course?",
      message: `Remove ${formatCourseCode(enrollment.course?.code)} — ${enrollment.course?.name}?`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    });

    if (!ok) return;
    deleteEnrollmentMutation.mutate(enrollment.id);
  };

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

  type CourseCategory = keyof typeof categoryLabels;
  type ICBasketUsed = { ic1: boolean; ic2: boolean };

  const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const applyMinorDeOverride = (category: CourseCategory, enrollment: Enrollment): CourseCategory => {
    return category;
  };

  const getCourseCategory = (
    enrollment: Enrollment,
    icBasketUsed?: ICBasketUsed,
    hssUsed?: { credits: number }
  ): CourseCategory => {
    const branch = userSettings.branch;
    const code = enrollment.course.code.toUpperCase();
    const normalizedCode = normalizeCode(code);
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);
    const credits = enrollment.course.credits || 0;

    // IC Basket compulsion logic - check BEFORE branchMappings
    if ((isICB1 || isICB2) && branch) {
      const branchCompulsion = IC_BASKET_COMPULSIONS[branch] || {};

      if (
        isICB1 &&
        branchCompulsion.ic1 &&
        normalizedCode === branchCompulsion.ic1.replace(/[^A-Z0-9]/g, "")
      ) {
        return "IC_BASKET";
      }

      if (
        isICB2 &&
        branchCompulsion.ic2 &&
        normalizedCode === branchCompulsion.ic2.replace(/[^A-Z0-9]/g, "")
      ) {
        return "IC_BASKET";
      }

      // No compulsion - first course counts as IC_BASKET
      if (icBasketUsed) {
        if (isICB1 && !branchCompulsion.ic1 && !icBasketUsed.ic1) {
          icBasketUsed.ic1 = true;
          return "IC_BASKET";
        }

        if (isICB2 && !branchCompulsion.ic2 && !icBasketUsed.ic2) {
          icBasketUsed.ic2 = true;
          return "IC_BASKET";
        }
      }

      return "FE";
    }

    // HS-xxx courses: first 12 credits count as HSS, remaining HS courses count as FE
    // (never let branch mapping override this)
    if (normalizedCode.startsWith("HS")) {
      if (hssUsed) {
        const before = hssUsed.credits;
        if (before < HSS_CORE_CAP) {
          hssUsed.credits = Math.min(HSS_CORE_CAP, before + credits);
          return "HSS";
        }
        return "FE";
      }
      return "HSS";
    }

    if (enrollment.course.branchMappings && enrollment.course.branchMappings.length > 0 && branch) {
      const branchAliases =
        branch === "CSE" ? ["CSE", "CS"] : branch === "CS" ? ["CS", "CSE"] : [branch];
      const mapping =
        enrollment.course.branchMappings.find(
          (m) => branchAliases.includes(m.branch) || m.branch === "COMMON"
        ) ||
        (branch === "GE"
          ? enrollment.course.branchMappings.find((m) => m.branch.startsWith("GE"))
          : undefined);

      if (mapping?.courseCategory === "NA") {
        return "FE";
      }

      if (mapping && mapping.courseCategory in categoryLabels) {
        return applyMinorDeOverride(mapping.courseCategory as CourseCategory, enrollment);
      }
    }

    if (branch === "CSE" && (code.startsWith("DS") || code.startsWith("CS"))) {
      return applyMinorDeOverride("DE", enrollment);
    }
    if (branch === "DSE" && (code.startsWith("DS") || code.startsWith("CS"))) {
      return applyMinorDeOverride("DE", enrollment);
    }

    if (normalizedCode === "IC181") return "IKS";
    if (normalizedCode.startsWith("IC")) return "IC";
    if (normalizedCode.startsWith("IK")) return "IKS";

    // Special DP codes (ISTP/MTP don't contain "ISTP"/"MTP" in the code)
    if (normalizedCode === "DP301P") return "ISTP";
    if (normalizedCode === "DP498P" || normalizedCode === "DP499P") return "MTP";
    if (normalizedCode.includes("MTP")) return "MTP";
    if (normalizedCode.includes("ISTP")) return "ISTP";

    switch (enrollment.courseType) {
      case "DE":
        return applyMinorDeOverride("DE", enrollment);
      case "PE":
      case "FREE_ELECTIVE":
        return "FE";
      case "MTP":
        return "MTP";
      case "ISTP":
        return "ISTP";
      case "CORE":
        return "DC";
      default:
        return "FE";
    }
  };

  const compareEnrollments = (a: Enrollment, b: Enrollment) =>
    (a.semester || 0) - (b.semester || 0) ||
    normalizeCode(a.course.code).localeCompare(normalizeCode(b.course.code));

  const primaryProgram = programs.find((p) => p.isPrimary) ?? programs[0];
  const secondaryPrograms = primaryProgram
    ? programs.filter((p) => p.id !== primaryProgram.id)
    : [];

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

  const sortedVisibleEnrollments = [...visibleEnrollments].sort(compareEnrollments);

  const icBasketUsedForDisplay: ICBasketUsed = { ic1: false, ic2: false };
  const hssUsedForDisplay = { credits: 0 };
  const categorizedById = new Map<string, CourseCategory>();

  sortedVisibleEnrollments.forEach((e) => {
    categorizedById.set(e.id, getCourseCategory(e, icBasketUsedForDisplay, hssUsedForDisplay));
  });

  const semesterCourses: Record<number, Enrollment[]> = sortedVisibleEnrollments.reduce(
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
            <p className="text-sm text-foreground-secondary">
              {view === "progress" ? "Academic Progress" : "Academic Programs"}
            </p>
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
              <div
                className="inline-flex w-full sm:w-auto rounded-lg border border-border bg-surface p-1"
                role="tablist"
                aria-label="User view"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "progress"}
                  onClick={() => setView("progress")}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    view === "progress"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-foreground-secondary hover:text-foreground"
                  }`}
                >
                  Progress
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "programs"}
                  onClick={() => setView("programs")}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    view === "programs"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-foreground-secondary hover:text-foreground"
                  }`}
                >
                  Programs
                </button>
              </div>

              {/* Primary Program */}
              {primaryProgram && (
                <div className="space-y-4">
                  {view === "programs" && (
                    <>
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
                    </>
                  )}

                  {view === "progress" && (
                    <>
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
                        <p className="text-sm text-foreground-secondary">No courses yet.</p>
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
                                  <table className="min-w-[820px] w-full text-sm">
                                    <thead className="text-foreground-secondary">
                                      <tr className="border-b border-border">
                                        <th className="py-2 pr-4 text-left whitespace-nowrap">Code</th>
                                        <th className="py-2 pr-4 text-left min-w-[12rem]">Course</th>
                                        <th className="py-2 pr-4 text-right whitespace-nowrap">Cr</th>
                                        <th className="py-2 text-left whitespace-nowrap">Result</th>
                                        <th className="py-2 pr-4 text-left whitespace-nowrap">Counts As</th>
                                        <th className="py-2 text-right whitespace-nowrap">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {courses.map((e) => {
                                        const category: CourseCategory =
                                          categorizedById.get(e.id) ?? "FE";
                                        const colors = categoryColors[category];
                                        const label = categoryLabels[category];

                                        return (
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
                                            <td className="py-2 pr-4 whitespace-nowrap">
                                              {e.status === "IN_PROGRESS" ? (
                                                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold whitespace-nowrap">
                                                  In Progress
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-semibold whitespace-nowrap">
                                                  Completed{e.grade ? ` (${e.grade})` : ""}
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2 pr-4 whitespace-nowrap">
                                              <span
                                                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-border ${colors.bg}`}
                                              >
                                                <span className={`font-semibold ${colors.text}`}>
                                                  {label}
                                                </span>
                                              </span>
                                            </td>
                                            <td className="py-2 text-right whitespace-nowrap">
                                              <button
                                                type="button"
                                                onClick={() => onDeleteEnrollment(e)}
                                                className="dp-icon-btn min-h-0 min-w-0 w-8 h-8 border-transparent bg-transparent hover:bg-surface-hover text-error"
                                                disabled={deletingEnrollmentId === e.id}
                                                aria-label={`Remove ${formatCourseCode(e.course?.code)}`}
                                              >
                                                {deletingEnrollmentId === e.id ? (
                                                  <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                  <Trash2 className="w-4 h-4" />
                                                )}
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
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
                    </>
                  )}
                </div>
              )}

              {/* Secondary Programs */}
              {view === "programs" && secondaryPrograms.length > 0 && (
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
