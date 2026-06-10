"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  GraduationCap,
  Award,
  BookOpen,
  Target,
  ChevronDown,
  Loader2,
  Trash2,
  Plus,
} from "lucide-react";
import { ProgressChart } from "@/components/ProgressChart";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";
import { ICB1_CODES, ICB2_CODES, IC_BASKET_COMPULSIONS, normalizeBranchForIcBasket } from "@/lib/icBasketConfig";
import { getBranchCandidates, isDataScienceBranch } from "@/lib/branchInfo";
import { normalizeCourseCode } from "@/lib/parseTranscript";
import { getSpecialDpCategory } from "@/lib/specialCourseCategories";
import { MTP_COMPONENT_CREDITS, MTP_TOTAL_CREDITS } from "@/lib/mtpConfig";
import { addCredits, formatCourseCode, formatCredits, minCredits, subtractCredits, sumCredits } from "@/lib/utils";

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
  isInternship?: boolean;
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
  userSettings: { branch?: string; batch?: number | null; enrollmentId?: string | null };
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
  AUDIT: "Audit (NC)",
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
  AUDIT: { bg: "bg-foreground-muted/10", text: "text-foreground-muted" },
};

const CURRENT_YEAR = new Date().getFullYear();

interface CourseSearchResult {
  id: string;
  code: string;
  name: string;
  credits: number;
  department?: string;
}

export function UserProgramModal({ userId, userName, onClose }: UserProgramModalProps) {
  const [view, setView] = useState<"progress" | "programs">("progress");
  const [deletingEnrollmentId, setDeletingEnrollmentId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ courseCode: "", semester: "1" });
  const [courseSearch, setCourseSearch] = useState("");
  const [courseResults, setCourseResults] = useState<CourseSearchResult[]>([]);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [courseSearchLoading, setCourseSearchLoading] = useState(false);
  const [detectedCategory, setDetectedCategory] = useState<string | null>(null);
  const courseCategoryMapRef = useRef<Record<string, string>>({});
  const courseSearchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const addEnrollmentMutation = useMutation({
    mutationFn: async (form: typeof addForm) => {
      const res = await fetch(`/api/admin/users/${userId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseCode: form.courseCode.trim(), semester: Number(form.semester) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed to add course");
      return body;
    },
    onSuccess: () => {
      showToast("success", "Course added");
      setShowAddForm(false);
      setAddForm({ courseCode: "", semester: "1" });
      setCourseSearch("");
      setCourseResults([]);
      setDetectedCategory(null);
      queryClient.invalidateQueries({ queryKey: ["admin-user-programs", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err) => {
      showToast("error", err instanceof Error ? err.message : "Failed to add course");
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

  // Fetch category map once when form opens so we can show instant category preview
  useEffect(() => {
    if (!showAddForm || !data?.userSettings?.branch) return;
    const branch = data.userSettings.branch;
    const batch = data.userSettings.batch ? String(data.userSettings.batch) : "";
    fetch(`/api/course-category-map?branch=${encodeURIComponent(branch)}&batch=${encodeURIComponent(batch)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.categoriesByCode) courseCategoryMapRef.current = d.categoriesByCode; })
      .catch(() => {});
  }, [showAddForm, data?.userSettings?.branch, data?.userSettings?.batch]);

  // Course search debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!courseSearch.trim()) { setCourseResults([]); setShowCourseDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      setCourseSearchLoading(true);
      try {
        const res = await fetch(`/api/courses?search=${encodeURIComponent(courseSearch)}`);
        if (res.ok) {
          const data = await res.json();
          setCourseResults((data.courses ?? data).slice(0, 8));
          setShowCourseDropdown(true);
        }
      } finally {
        setCourseSearchLoading(false);
      }
    }, 250);
  }, [courseSearch]);

  // Close course dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (courseSearchRef.current && !courseSearchRef.current.contains(e.target as Node)) {
        setShowCourseDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const inferredBatch = useMemo(() => {
    const batch = userSettings.batch;
    if (typeof batch === "number" && batch > 2000) return batch;
    const enrollmentId = String(userSettings.enrollmentId || "").toUpperCase();
    const match = /B(\d{2})/i.exec(enrollmentId);
    if (match) return 2000 + Number.parseInt(match[1], 10);
    return null;
  }, [userSettings.batch, userSettings.enrollmentId]);

  type CourseCategory = keyof typeof categoryLabels;
  type ICBasketUsed = { ic1: boolean; ic2: boolean };

  // Must ignore Samarth suffix noise like "_New" so course-type matching works consistently
  const normalizeCode = (code: string) => normalizeCourseCode(code);

  const mappingBranchAliases = useMemo(() => {
    const raw = userSettings.branch;
    if (!raw) return [];
    return getBranchCandidates(raw).filter((branch) => branch !== "COMMON");
  }, [userSettings.branch]);

  const pickRelevantBranchMapping = (
    branch: string | undefined,
    mappings: Enrollment["course"]["branchMappings"] | undefined
  ) => {
    if (!branch || !mappings || mappings.length === 0) return undefined;

    const exact = mappings.find((m) => m.branch === branch);
    if (exact) return exact;

    const direct = mappings.find((m) => mappingBranchAliases.includes(m.branch));
    if (direct) return direct;

    if (branch === "GE") {
      const ge = mappings.find((m) => m.branch.startsWith("GE"));
      if (ge) return ge;
    }

    return mappings.find((m) => m.branch === "COMMON");
  };

  const applyMinorDeOverride = (category: CourseCategory, enrollment: Enrollment): CourseCategory => {
    return category;
  };

  const getCourseCategory = (
    enrollment: Enrollment,
    icBasketUsed?: ICBasketUsed,
    hssUsed?: { credits: number }
  ): CourseCategory => {
    // Internship courses (XX-399P / XX-396P) are always P/F FE for all branches
    if (enrollment.isInternship || /39[69]P$/i.test(enrollment.course.code)) return "FE";

    const branch = userSettings.branch;
    const code = enrollment.course.code.toUpperCase();
    const normalizedCode = normalizeCode(code);
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);
    const isIkCourse = /^IK\d/.test(normalizedCode);
    const credits = enrollment.course.credits || 0;

    // IC Basket compulsion logic - check BEFORE branchMappings
    if ((isICB1 || isICB2) && branch) {
      const basketBranch = normalizeBranchForIcBasket(branch);
      const branchCompulsion = IC_BASKET_COMPULSIONS[basketBranch] || {};

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

      // Some IC basket courses are mapped as DC for certain branches (e.g. MSE: IC-240).
      // Respect explicit branch mappings before defaulting to FE.
      if (enrollment.course.branchMappings && enrollment.course.branchMappings.length > 0) {
        const mapping = pickRelevantBranchMapping(branch, enrollment.course.branchMappings);

        if (mapping?.courseCategory === "DC") {
          return "DC";
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
          hssUsed.credits = minCredits(HSS_CORE_CAP, addCredits(before, credits));
          return "HSS";
        }
        return "FE";
      }
      return "HSS";
    }

    // Hard overrides (batch-sensitive)
    const isBatch24Or25 = inferredBatch === 2024 || inferredBatch === 2025;
    if (normalizedCode === "IK593") return "FE";
    if (normalizedCode === "IC181") return "IKS";
    if (normalizedCode === "IC182") return isBatch24Or25 ? "IKS" : "IC";

    if (enrollment.course.branchMappings && enrollment.course.branchMappings.length > 0 && branch) {
      const mapping = pickRelevantBranchMapping(branch, enrollment.course.branchMappings);

      if (mapping?.courseCategory === "NA") {
        return "FE";
      }

      if (mapping && mapping.courseCategory in categoryLabels) {
        // IK-xxx courses should not count towards IKS requirement.
        if (mapping.courseCategory === "IKS" && isIkCourse) {
          return "FE";
        }
        const resolvedCat = applyMinorDeOverride(mapping.courseCategory as CourseCategory, enrollment);
        // Apply HSS cap for non-HS-prefix courses mapped to HSS (e.g. German intensive courses)
        if (resolvedCat === "HSS" && hssUsed) {
          const before = hssUsed.credits;
          if (before >= HSS_CORE_CAP) return "FE";
          hssUsed.credits = minCredits(HSS_CORE_CAP, addCredits(before, credits));
        }
        return resolvedCat;
      }

      // Mappings exist but none matched this student's branch → FE
      return "FE";
    }

    if (isIkCourse) return "FE";

    if (branch === "CSE" && (code.startsWith("DS") || code.startsWith("CS"))) {
      return applyMinorDeOverride("DE", enrollment);
    }
    if (isDataScienceBranch(branch) && (code.startsWith("DS") || code.startsWith("CS"))) {
      return applyMinorDeOverride("DE", enrollment);
    }

    if (normalizedCode.startsWith("IC")) return "IC";

    const specialDpCategory = getSpecialDpCategory(normalizedCode);
    if (specialDpCategory) return specialDpCategory;

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

  // Show all enrollments — programId on enrollments may be stale/null after program reassignment
  const programEnrollments = enrollments;

  const visibleEnrollments = programEnrollments.filter(
    (e) =>
      e.status === "IN_PROGRESS" ||
      e.status === "AUDIT" ||
      (e.status === "COMPLETED" && (!e.grade || e.grade !== "F"))
  );

  const sortedVisibleEnrollments = [...visibleEnrollments].sort(compareEnrollments);

  const icBasketUsedForDisplay: ICBasketUsed = { ic1: false, ic2: false };
  const hssUsedForDisplay = { credits: 0 };
  const categorizedById = new Map<string, { category: CourseCategory; splitCredits?: number }>();

  sortedVisibleEnrollments.forEach((e) => {
    if (e.status === "AUDIT") {
      categorizedById.set(e.id, { category: "AUDIT" as CourseCategory, splitCredits: undefined });
      return;
    }
    const hssBefore = hssUsedForDisplay.credits;
    const category = getCourseCategory(e, icBasketUsedForDisplay, hssUsedForDisplay);
    const hssAfter = hssUsedForDisplay.credits;
    const hssPortionUsed = subtractCredits(hssAfter, hssBefore);
    const splitCredits = category === "HSS" && hssPortionUsed < (e.course.credits || 0)
      ? subtractCredits(e.course.credits || 0, hssPortionUsed)
      : undefined;
    categorizedById.set(e.id, { category, splitCredits });
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
                          {formatCredits(primaryProgram.program.totalCreditsRequired)}
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
                        {(() => {
                          const pfCr = enrollments
                            .filter(e =>
                              (e.isInternship || /39[69]P$/i.test(e.course.code)) &&
                              (e.status === "COMPLETED" || e.status === "IN_PROGRESS")
                            )
                            .reduce((sum, e) => sum + (e.course.credits || 0), 0);
                          return pfCr > 0 ? (
                            <p className={`text-xs mt-1 ${pfCr >= 9 ? "text-success font-medium" : "text-foreground-secondary"}`}>
                              P/F: {pfCr} / 9 cr{pfCr >= 9 ? " ✓" : ""}
                            </p>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    {/* MTP / ISTP */}
                    {primaryProgram.program.mtpIstpCredits > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-sm font-semibold text-foreground mb-2">
                          Project Requirements
                        </p>
                        <div className="flex flex-wrap gap-4 text-sm text-foreground-secondary">
                          <span>
                            MTP: {MTP_TOTAL_CREDITS} cr (MTP-1: {MTP_COMPONENT_CREDITS}cr + MTP-2: {MTP_COMPONENT_CREDITS}cr)
                          </span>
                          {primaryProgram.program.code === "BSCS" ? (
                            <span>
                              Research & Communication: {primaryProgram.program.mtpIstpCredits - MTP_TOTAL_CREDITS} cr
                            </span>
                          ) : (
                            <span>ISTP: 4 cr (Sem 6)</span>
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
                        userBatch={inferredBatch}
                      />
                    ) : (
                      <div className="bg-surface rounded-lg border border-border p-6 flex items-center justify-center">
                        <p className="text-sm text-foreground-secondary">
                          No progress data available.
                        </p>
                      </div>
                    )}

                    <div className="bg-surface rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-foreground">Credits Counted (Courses)</h4>
                        <button
                          type="button"
                          onClick={() => setShowAddForm((v) => !v)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Course
                        </button>
                      </div>
                      <p className="text-xs text-foreground-secondary mb-3">
                        Collapsed by semester.
                      </p>

                      {showAddForm && (
                        <form
                          onSubmit={(e) => { e.preventDefault(); addEnrollmentMutation.mutate(addForm); }}
                          className="mb-4 p-3 rounded-lg border border-border bg-background-secondary space-y-3"
                        >
                          <div className="flex flex-col gap-2" ref={courseSearchRef}>
                            <div>
                              <label className="block text-xs text-foreground-secondary mb-1">Course</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Search by code or name..."
                                  value={courseSearch || (addForm.courseCode ? addForm.courseCode : "")}
                                  onChange={(e) => {
                                    setCourseSearch(e.target.value);
                                    setAddForm((f) => ({ ...f, courseCode: "" }));
                                    setDetectedCategory(null);
                                  }}
                                  onFocus={() => courseResults.length > 0 && setShowCourseDropdown(true)}
                                  className="w-full px-2.5 py-1.5 text-sm rounded-md border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                  required={!addForm.courseCode}
                                />
                                {courseSearchLoading && (
                                  <Loader2 className="absolute right-2.5 top-2 w-4 h-4 animate-spin text-foreground-secondary" />
                                )}
                                {showCourseDropdown && courseResults.length > 0 && (
                                  <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                                    {courseResults.map((c) => (
                                      <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                          setAddForm((f) => ({ ...f, courseCode: c.code }));
                                          setCourseSearch(`${c.code} - ${c.name}`);
                                          setShowCourseDropdown(false);
                                          const norm = normalizeCourseCode(c.code);
                                          setDetectedCategory(courseCategoryMapRef.current[norm] ?? null);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors border-b border-border/50 last:border-0"
                                      >
                                        <span className="font-semibold text-foreground text-xs">{formatCourseCode(c.code)}</span>
                                        <span className="text-foreground-secondary text-xs ml-2">{c.name}</span>
                                        <span className="float-right text-foreground-secondary text-xs">{c.credits} cr</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {detectedCategory && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-foreground-secondary">Counts as:</span>
                                <span className={`px-2 py-0.5 rounded-full font-semibold ${
                                  categoryColors[detectedCategory as CourseCategory]?.bg ?? "bg-surface"
                                } ${
                                  categoryColors[detectedCategory as CourseCategory]?.text ?? "text-foreground"
                                }`}>
                                  {categoryLabels[detectedCategory as CourseCategory] ?? detectedCategory}
                                </span>
                              </div>
                            )}
                            <div>
                              <label className="block text-xs text-foreground-secondary mb-1">Semester</label>
                              <select
                                value={addForm.semester}
                                onChange={(e) => setAddForm((f) => ({ ...f, semester: e.target.value }))}
                                className="w-full px-2.5 py-1.5 text-sm rounded-md border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                              >
                                {[1,2,3,4,5,6,7,8].map((s) => <option key={s} value={s}>Semester {s}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => { setShowAddForm(false); setCourseSearch(""); setCourseResults([]); setDetectedCategory(null); }}
                              className="px-3 py-1.5 text-sm rounded-lg border border-border text-foreground-secondary hover:bg-surface-hover transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={addEnrollmentMutation.isPending}
                              className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1.5"
                            >
                              {addEnrollmentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                              Add
                            </button>
                          </div>
                        </form>
                      )}

                      {semesters.length === 0 ? (
                        <p className="text-sm text-foreground-secondary">No courses yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {semesters.map((sem) => {
                            const courses = semesterCourses[sem] || [];
                            const credits = sumCredits(courses.map((e) => e.course?.credits || 0));
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
                                      {courses.length} courses • {formatCredits(credits)} credits
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
                                        const { category, splitCredits } =
                                          categorizedById.get(e.id) ?? { category: "FE" as CourseCategory };
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
                                            <td className={`py-2 pr-4 text-right ${e.status === "AUDIT" ? "text-foreground-muted line-through" : "text-foreground"}`}>
                                              {formatCredits(e.course?.credits || 0)}
                                            </td>
                                            <td className="py-2 pr-4 whitespace-nowrap">
                                              {e.status === "IN_PROGRESS" ? (
                                                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold whitespace-nowrap">
                                                  In Progress
                                                </span>
                                              ) : e.status === "AUDIT" ? (
                                                <span className="px-2 py-0.5 rounded-full bg-foreground-muted/10 text-foreground-muted text-xs font-semibold whitespace-nowrap">
                                                  Audit
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-semibold whitespace-nowrap">
                                                  Completed{e.grade ? ` (${e.grade})` : ""}
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2 pr-4 whitespace-nowrap">
                                              {splitCredits !== undefined ? (
                                                <span className="inline-flex items-center gap-1">
                                                  <span className={`inline-flex items-center px-2 py-1 rounded-full border border-border ${categoryColors.HSS.bg}`}>
                                                    <span className={`font-semibold text-xs ${categoryColors.HSS.text}`}>
                                                      HSS ({formatCredits(subtractCredits(e.course.credits || 0, splitCredits))})
                                                    </span>
                                                  </span>
                                                  <span className="text-foreground-secondary text-xs">&amp;</span>
                                                  <span className={`inline-flex items-center px-2 py-1 rounded-full border border-border ${categoryColors.FE.bg}`}>
                                                    <span className={`font-semibold text-xs ${categoryColors.FE.text}`}>
                                                      FE ({formatCredits(splitCredits)})
                                                    </span>
                                                  </span>
                                                </span>
                                              ) : (
                                                <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-border ${colors.bg}`}>
                                                  <span className={`font-semibold ${colors.text}`}>{label}</span>
                                                </span>
                                              )}
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
                              {formatCredits(up.program.totalCreditsRequired)}
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
