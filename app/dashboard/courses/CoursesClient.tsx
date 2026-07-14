"use client";

import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import {
  BookOpen,
  Search,
  Filter,
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  X,
  Award,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { StatCard } from "@/components/StatCard";
import { getAllBranches } from "@/lib/branches";
import { getBranchCandidates, isDataScienceBranch } from "@/lib/branchInfo";
import { pickBranchMapping, type BranchMapping } from "@/lib/courseCategory";
import { getSpecialDpCategory, getSpecialDpCourseType } from "@/lib/specialCourseCategories";
import { addCredits, formatCourseCode, formatCredits, subtractCredits, sumCredits } from "@/lib/utils";
import { buildNonMgmtMinorCountedCourseCodeSet, useMinorPlannerSelection } from "@/lib/minorPlannerClient";
import { ICB1_CODES, ICB2_CODES, IC_BASKET_COMPULSIONS, normalizeBranchForIcBasket } from "@/lib/icBasketConfig";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  department: string;
  level: number;
  description?: string;
  offeredInFall: boolean;
  offeredInSpring: boolean;
  offeredInSummer: boolean;
  isPassFailEligible?: boolean;
}

interface Enrollment {
  id: string;
  semester: number;
  year: number;
  term: string;
  status: string;
  grade?: string;
  courseType?: "CORE" | "DE" | "FREE_ELECTIVE" | "PE" | "MTP" | "ISTP";
  courseId: string;
  isPassFail?: boolean;
  isInternship?: boolean;
  course: Course & {
    branchMappings?: {
      courseCategory: string;
      branch: string;
      batch?: string | null;
      splitCategory?: string | null;
      splitAmount?: number | null;
    }[];
  };
}

interface User {
  branch?: string;
  totalPassFailCredits?: number;
  batch?: number | null;
  enrollmentId?: string | null;
}

// Color scheme for each category
const categoryColors = {
  IC: { bg: "bg-info/10", text: "text-info", bar: "bg-info", border: "border-info/20" },
  IC_BASKET: { bg: "bg-accent/10", text: "text-accent", bar: "bg-accent", border: "border-accent/20" },
  DC: { bg: "bg-primary/10", text: "text-primary", bar: "bg-primary", border: "border-primary/20" },
  DE: { bg: "bg-secondary/10", text: "text-secondary", bar: "bg-secondary", border: "border-secondary/20" },
  FE: { bg: "bg-success/10", text: "text-success", bar: "bg-success", border: "border-success/20" },
  HSS: { bg: "bg-warning/10", text: "text-warning", bar: "bg-warning", border: "border-warning/20" },
  IKS: { bg: "bg-warning/10", text: "text-warning", bar: "bg-warning", border: "border-warning/20" },
  MTP: { bg: "bg-error/10", text: "text-error", bar: "bg-error", border: "border-error/20" },
  ISTP: { bg: "bg-accent/10", text: "text-accent", bar: "bg-accent", border: "border-accent/20" },
  NOT_IN_DEGREE: { bg: "bg-foreground-muted/10", text: "text-foreground-muted", bar: "bg-foreground-muted", border: "border-foreground-muted/20" },
};

const DEPARTMENT_PAGE_SIZE = 20;

type SchoolKey =
  | "SCEE" // School of Computing and Electrical Engineering
  | "SMSS" // School of Mathematical and Statistical Sciences
  | "SMME" // School of Mechanical, Materials and Energy Engineering
  | "SPS" // School of Physical Sciences
  | "SCENE" // School of Civil and Environmental Engineering
  | "SCS" // School of Chemical Sciences
  | "SBS" // School of Bio Sciences
  | "SHSS" // School of Humanities & Social Sciences
  | "COMMON"
  | "TUM" // TU Munich (Semester Exchange)
  | "TUD" // TU Darmstadt (Semester Exchange)
  | "RWTH" // RWTH Aachen (Semester Exchange)
  | "LUH" // Leibniz University Hannover (Semester Exchange)
  | "OTHER";

type SchoolFilter = "all" | SchoolKey;

const SCHOOL_META: Record<SchoolKey, { label: string; order: number; prefixes: string[] }> = {
  SCEE: {
    label: "SCEE (CSE, DSE/DSAI, EE, VL)",
    order: 10,
    prefixes: ["CS", "DS", "EE", "VL", "MV", "EC", "ECE", "ET"],
  },
  SMSS: { label: "SMSS (MNC)", order: 20, prefixes: ["MC", "MA", "ST"] },
  SMME: { label: "SMME (GE, MSE, ME)", order: 30, prefixes: ["GE", "ME", "MS", "MT", "AR", "EN", "EM", "MI"] },
  SPS: { label: "SPS (EP)", order: 40, prefixes: ["EP", "PH"] },
  SCENE: { label: "SCENE (CE)", order: 50, prefixes: ["CE"] },
  SCS: { label: "SCS (BS CS)", order: 60, prefixes: ["CY", "CH"] },
  SBS: { label: "SBS (BE)", order: 70, prefixes: ["BE", "BY", "BT", "BS"] },
  SHSS: { label: "SHSS (HS)", order: 80, prefixes: ["HS", "MB"] },
  COMMON: { label: "Common (IC/IKS/DP)", order: 90, prefixes: ["IC", "IK", "IKS", "DP", "RM"] },
  TUM: { label: "TU Munich (Semester Exchange)", order: 95, prefixes: ["IN"] },
  TUD: { label: "TU Darmstadt (Semester Exchange)", order: 96, prefixes: ["11", "16", "18", "20", "41"] },
  RWTH: { label: "RWTH Aachen (Semester Exchange)", order: 97, prefixes: ["81", "42"] },
  LUH: { label: "Leibniz University Hannover (Semester Exchange)", order: 98, prefixes: [] },
  OTHER: { label: "Other", order: 99, prefixes: [] },
};

const SCHOOL_ORDER: SchoolKey[] = Object.entries(SCHOOL_META)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([key]) => key as SchoolKey);

function getCoursePrefix(code: string): string {
  const upper = String(code ?? "").trim().toUpperCase();
  const match = upper.match(/^([A-Z]{2,4})/);
  return match?.[1] ?? "";
}

function getCourseSchoolKey(course: Pick<Course, "code" | "department">): SchoolKey {
  const dept = String(course.department ?? "").toLowerCase();
  if (dept.includes("tu darmstadt")) return "TUD";
  if (dept.includes("tu munich")) return "TUM";
  if (dept.includes("rwth aachen")) return "RWTH";
  if (dept.includes("leibniz") || dept.includes("hannover")) return "LUH";

  const prefix = getCoursePrefix(course.code);
  for (const key of SCHOOL_ORDER) {
    const meta = SCHOOL_META[key];
    if (meta.prefixes.includes(prefix)) return key;
  }

  if (dept.includes("humanities")) return "SHSS";
  if (dept.includes("comput") || dept.includes("electrical") || dept.includes("vlsi")) return "SCEE";
  if (dept.includes("mathemat") || dept.includes("statistical")) return "SMSS";
  if (dept.includes("mechanical") || dept.includes("material") || dept.includes("energy")) return "SMME";
  if (dept.includes("physical") || dept.includes("physics")) return "SPS";
  if (dept.includes("civil") || dept.includes("environment")) return "SCENE";
  if (dept.includes("chemical")) return "SCS";
  if (dept.includes("bio")) return "SBS";
  if (dept.includes("institute core") || dept.includes("indian knowledge") || dept === "dp") return "COMMON";
  return "OTHER";
}

interface CoursesClientProps {
  initialEnrollments?: Enrollment[];
  initialUser?: User | null;
  initialCatalogCount?: number;
}

export default function CoursesPage({ initialEnrollments, initialUser, initialCatalogCount }: CoursesClientProps = {}) {
  // Whether the server pre-seeded first-paint data. When true we skip the
  // initial /api/enrollments + /api/user/settings fetch (mutations still refetch).
  const hasInitialData = Array.isArray(initialEnrollments);

  const [preRegLockedSemester, setPreRegLockedSemester] = useState<number | null>(null);
  const [tab, setTab] = useState<"my-courses" | "catalog">("my-courses");
  const [enrollments, setEnrollments] = useState<Enrollment[]>(initialEnrollments ?? []);
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [dbCourseCategoryMap, setDbCourseCategoryMap] = useState<Map<string, string>>(new Map());
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(!hasInitialData);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<SchoolFilter>("all");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [addingCourse, setAddingCourse] = useState<Course | null>(null);
  const [semester, setSemester] = useState<string>("");
  const [grade, setGrade] = useState<string>("");
  const [courseType, setCourseType] = useState<string>("AUTO");
  const [isPassFail, setIsPassFail] = useState(false);
  const [isAudit, setIsAudit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedDepartments, setExpandedDepartments] = useState<string[]>([]);
  const [departmentVisibleCounts, setDepartmentVisibleCounts] = useState<Record<string, number>>({});
  const [searchResultsLimit, setSearchResultsLimit] = useState(20);
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();

  // Auto-calculate current semester from batch year (2023) + current date
  // Odd sems = Fall (Aug-Dec), Even sems = Spring (Jan-May)
  const currentSem = (() => {
    const now = new Date();
    const batch = 2023;
    const yearsElapsed = now.getFullYear() - batch;
    const isSpring = now.getMonth() + 1 <= 6;
    return isSpring ? yearsElapsed * 2 : yearsElapsed * 2 + 1;
  })();

  useEffect(() => {
    // Skip the initial enrollments/user fetch when the server already seeded them.
    if (!hasInitialData) loadData();
    fetch("/api/academic-state")
      .then(r => r.json())
      .then(d => { if (d.phase === "PRE_REGISTRATION" && d.upcomingSemester) setPreRegLockedSemester(d.upcomingSemester); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazy-load course catalog only when the catalog tab is first opened
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  useEffect(() => {
    if (tab !== "catalog" || catalogLoaded || allCourses.length > 0) return;
    setCatalogLoaded(true);
    fetch("/api/courses")
      .then(r => r.ok ? r.json() : [])
      .then(data => setAllCourses(data))
      .catch(() => {});
  }, [tab, catalogLoaded, allCourses.length]);

  useEffect(() => {
    const branch = user?.branch;
    if (!branch) return;
    const controller = new AbortController();

    const loadCourseCategoryMap = async () => {
      try {
        const res = await fetch(
          `/api/course-category-map?branch=${encodeURIComponent(branch)}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        const entries = Object.entries(data?.categoriesByCode ?? {}) as Array<[string, string]>;
        setDbCourseCategoryMap(new Map(entries));
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.warn("Failed to load course category map:", err);
      }
    };

    loadCourseCategoryMap();
    return () => controller.abort();
  }, [user?.branch]);

  const loadData = async () => {
    try {
      const [enrollmentsRes, userRes] = await Promise.all([
        // Enrollment mutations must never be followed by a browser-cached list,
        // otherwise a just-deleted course reappears until the user refreshes.
        fetch("/api/enrollments", { cache: "no-store" }),
        fetch("/api/user/settings", { cache: "no-store" }),
      ]);

      if (enrollmentsRes.ok) {
        const data = await enrollmentsRes.json();
        setEnrollments(data);
      }

      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      showToast("error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const schoolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const course of allCourses) {
      const key = getCourseSchoolKey(course);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [allCourses]);

  const schoolOptions = useMemo(
    () =>
      SCHOOL_ORDER
        .map((key) => ({ key, label: SCHOOL_META[key].label, count: schoolCounts[key] ?? 0 }))
        .filter((o) => o.count > 0),
    [schoolCounts]
  );

  const normalizeCourseCodeForSearch = (text: string) =>
    text.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Debounce the query that feeds filtering so full-catalog re-filtering
  // doesn't run on every keystroke (improves input responsiveness / INP).
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 150);
  const searchNormalized = useMemo(
    () => normalizeCourseCodeForSearch(debouncedSearchQuery),
    [debouncedSearchQuery]
  );
  const searchLower = useMemo(() => debouncedSearchQuery.trim().toLowerCase(), [debouncedSearchQuery]);

  const filteredCourses = useMemo(() => allCourses.filter((course) => {
    const matchesSearch =
      !searchLower ||
      normalizeCourseCodeForSearch(course.code).includes(searchNormalized) ||
      course.name.toLowerCase().includes(searchLower) ||
      course.department.toLowerCase().includes(searchLower);
    const matchesDept = selectedDept === "all" || getCourseSchoolKey(course) === selectedDept;
    return matchesSearch && matchesDept;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [allCourses, searchLower, searchNormalized, selectedDept]);

  const departmentGroups = useMemo(() => {
    const bySchool: Record<string, Course[]> = {};
    for (const course of filteredCourses) {
      // Internship courses are shown in the dedicated section above — skip them here
      const normCode = course.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (normCode.endsWith("399P") || normCode.endsWith("396P")) continue;
      const key = getCourseSchoolKey(course);
      const list = bySchool[key] ?? [];
      list.push(course);
      bySchool[key] = list;
    }

    return SCHOOL_ORDER
      .filter((key) => (bySchool[key]?.length ?? 0) > 0)
      .map((key) => ({
        dept: key,
        label: SCHOOL_META[key].label,
        courses: (bySchool[key] ?? []).sort((a, b) => a.code.localeCompare(b.code)),
      }));
  }, [filteredCourses]);

  const toggleDepartment = useCallback((dept: string) => {
    setExpandedDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
    setDepartmentVisibleCounts((prev) =>
      prev[dept] ? prev : { ...prev, [dept]: DEPARTMENT_PAGE_SIZE }
    );
  }, []);

  const expandAllDepartments = useCallback(() => {
    const all = departmentGroups.map((g) => g.dept);
    setExpandedDepartments(all);
    setDepartmentVisibleCounts((prev) => {
      const next = { ...prev };
      for (const dept of all) {
        if (!next[dept]) next[dept] = DEPARTMENT_PAGE_SIZE;
      }
      return next;
    });
  }, [departmentGroups]);

  const collapseAllDepartments = useCallback(() => setExpandedDepartments([]), []);

  useEffect(() => {
    if (tab !== "catalog") return;
    if (selectedDept === "all") return;

    setExpandedDepartments([selectedDept]);
    setDepartmentVisibleCounts((prev) =>
      prev[selectedDept] ? prev : { ...prev, [selectedDept]: DEPARTMENT_PAGE_SIZE }
    );
  }, [selectedDept, tab]);

  const enrolledCourseIds = useMemo(
    () => new Set(enrollments.map((e) => e.courseId)),
    [enrollments]
  );

  const availableCourses = useMemo(
    () => filteredCourses.filter((c) => !enrolledCourseIds.has(c.id)),
    [filteredCourses, enrolledCourseIds]
  );

  const totalCreditsCompleted = useMemo(
    () => enrollments
      .filter((e) => e.status === "COMPLETED" && (!e.grade || e.grade !== "F"))
      .reduce((sum, e) => addCredits(sum, e.course.credits), 0),
    [enrollments]
  );

  const totalCreditsInProgress = useMemo(
    () => enrollments
      .filter((e) => e.status === "IN_PROGRESS" || e.status === "ENROLLED")
      .reduce((sum, e) => addCredits(sum, e.course.credits), 0),
    [enrollments]
  );

  const maxPassFailCredits = 9;
  const passFailUsed = user?.totalPassFailCredits ?? 0;
  const passFailRemaining = Math.max(0, maxPassFailCredits - passFailUsed);

  const minorPlanner = useMinorPlannerSelection();
  const nonMgmtMinorCourseCodes = useMemo(() => {
    if (!minorPlanner.enabled) return new Set<string>();
    const eligible = buildNonMgmtMinorCountedCourseCodeSet(minorPlanner.codes);
    if (!minorPlanner.countedCourseCodesConfigured) return eligible;

    const selected = new Set(
      (minorPlanner.countedCourseCodes ?? [])
        .map((c) => formatCourseCode(String(c ?? "")))
        .filter((c) => Boolean(c))
    );

    const out = new Set<string>();
    selected.forEach((code) => {
      if (eligible.has(code)) out.add(code);
    });
    return out;
  }, [
    minorPlanner.enabled,
    minorPlanner.codes,
    minorPlanner.countedCourseCodes,
    minorPlanner.countedCourseCodesConfigured,
  ]);

  const applyMinorDeOverride = (category: string, enrollment: Enrollment): string => {
    if (category !== "DE") return category;
    const code = formatCourseCode(enrollment.course.code);
    if (!code) return category;
    return nonMgmtMinorCourseCodes.has(code) ? "FE" : category;
  };

  // Calculate credits by category
  const getCourseCategory = (
    enrollment: Enrollment,
    icBasketUsed?: { ic1: boolean; ic2: boolean }
  ): string => {
    if (enrollment.isPassFail) return "FE";
    // Internship courses (XX-399P / XX-396P) are always P/F FE for all branches
    if (enrollment.isInternship || /39[69]P$/i.test(enrollment.course.code)) return "FE";

    const code = enrollment.course.code.toUpperCase();
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
    const isIkCourse = /^IK\d/.test(normalizedCode);

    // Hard overrides (batch-sensitive)
    const inferredBatch = (() => {
      const batch = user?.batch;
      if (typeof batch === "number" && batch > 2000) return batch;
      const enrollmentId = String(user?.enrollmentId || "").toUpperCase();
      const match = /B(\d{2})/i.exec(enrollmentId);
      if (match) return 2000 + parseInt(match[1], 10);
      return null;
    })();
    const isBatch24Or25 = inferredBatch === 2024 || inferredBatch === 2025;

    if (normalizedCode === "IK593") return "HSS"; // IK-xxx → HSS+IKS basket
    if (normalizedCode === "IC181") return "HSS"; // IC-181 → HSS+IKS basket
    if (normalizedCode === "IC182") return isBatch24Or25 ? "HSS" : "IC"; // IC-182 B24/B25 → HSS+IKS
    // HS-xxx and IK-xxx always go to HSS+IKS regardless of branchMappings —
    // consistent with server-side creditCalculator hard rule.
    if (code.startsWith("HS-") || code.startsWith("HS") || isIkCourse) return "HSS";

    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);

    if ((isICB1 || isICB2) && user?.branch) {
      const basketBranch = normalizeBranchForIcBasket(user.branch);
      const branchCompulsion = IC_BASKET_COMPULSIONS[basketBranch] || {};

      if (isICB1 && branchCompulsion.ic1 && normalizedCode === branchCompulsion.ic1) {
        return "IC_BASKET";
      }
      if (isICB2 && branchCompulsion.ic2 && normalizedCode === branchCompulsion.ic2) {
        return "IC_BASKET";
      }
      if (isICB1 && !branchCompulsion.ic1 && icBasketUsed && !icBasketUsed.ic1) {
        icBasketUsed.ic1 = true;
        return "IC_BASKET";
      }
      if (isICB2 && !branchCompulsion.ic2 && icBasketUsed && !icBasketUsed.ic2) {
        icBasketUsed.ic2 = true;
        return "IC_BASKET";
      }

      const branchCandidates = getBranchCandidates(user.branch);
      const mapping = branchCandidates
        .map((branch) => enrollment.course.branchMappings?.find((candidate) => candidate.branch === branch))
        .find(Boolean);
      if (mapping?.courseCategory === "DC") return "DC";
      if (mapping?.courseCategory === "DE") return "DE";
      return "FE";
    }

    // First try to get from branchMappings — batch-aware via the shared canonical scorer
    // (lib/courseCategory.ts) so branch/batch precedence is identical everywhere.
    if (enrollment.course.branchMappings && enrollment.course.branchMappings.length > 0 && user?.branch) {
      const mapping = pickBranchMapping(
        enrollment.course.branchMappings as BranchMapping[],
        user.branch,
        inferredBatch
      );

      if (mapping) {
        if (mapping.courseCategory === "NA") {
          return "FE";
        }
        // IKS-mapped courses (incl. IK-xxx) → HSS+IKS basket.
        if (mapping.courseCategory === "IKS") {
          return "HSS";
        }
        return applyMinorDeOverride(mapping.courseCategory, enrollment);
      }

      // No branch-specific mapping found — apply hard prefix rules before defaulting to FE.
      // HS-xxx courses always go to HSS+IKS basket regardless of branch mappings.
      if (code.startsWith("HS-") || code.startsWith("HS")) return "HSS";
      // IK-xxx courses always go to HSS+IKS basket.
      if (isIkCourse) return "HSS";
      // CSE/DSE/DSAI: CS-xxx and DS-xxx are always DE (except internship/project codes).
      const isCSorDS2 = code.startsWith("CS") || code.startsWith("DS");
      const isCsDsException2 = ["396P","399P","010"].some(s => normalizedCode.endsWith(s)) || normalizedCode === "DS302";
      if (isCSorDS2 && !isCsDsException2 && (user?.branch === "CSE" || isDataScienceBranch(user?.branch))) {
        return applyMinorDeOverride("DE", enrollment);
      }

      // Course has branch mappings but none apply → FE
      return "FE";
    }

    if (isIkCourse) return "HSS"; // IK-xxx → HSS+IKS basket

    // Fallback to code analysis
    if (isICB1 || isICB2) return "IC_BASKET";

    // Hard rule: CSE/DSE/DSAI → all CS-xxx and DS-xxx are DE (no branchMappings at all case)
    const isCSorDS = code.startsWith("CS") || code.startsWith("DS");
    const isCsDsException = ["396P","399P","010"].some(s => normalizedCode.endsWith(s)) || normalizedCode === "DS302";
    if (isCSorDS && !isCsDsException && (user?.branch === "CSE" || isDataScienceBranch(user?.branch))) {
      return applyMinorDeOverride("DE", enrollment);
    }
    
    if (normalizedCode.startsWith("IC")) return "IC";
    if (normalizedCode.startsWith("HS")) return "HSS";

    const specialDpCategory = getSpecialDpCategory(normalizedCode);
    if (specialDpCategory) return specialDpCategory;

    // Fallback to courseType mapping
    switch (enrollment.courseType) {
      case "DE":
        return applyMinorDeOverride("DE", enrollment);
      case "FREE_ELECTIVE":
      case "PE":
        return "FE";
      case "MTP":
        return "MTP";
      case "ISTP":
        return "ISTP";
      case "CORE":
      default:
        return "DC";
    }
  };

  const { creditsByCategory, completedIcBasketUsed } = useMemo(() => {
    const credits: Record<string, number> = {
      IC: 0, IC_BASKET: 0, DC: 0, DE: 0, FE: 0, HSS: 0, IKS: 0, MTP: 0, ISTP: 0, NOT_IN_DEGREE: 0,
    };
    const icBasketUsed = { ic1: false, ic2: false };
    const hssUsed = { credits: 0 };
    const branchConfig = getAllBranches().find((b) => b.code === user?.branch);
    const hssCoreCapLocal = branchConfig?.icCredits != null && branchConfig.icCredits <= 52 ? 12 : 15;
    const hssFeCapLocal = 20;
    enrollments
      .filter((e) => e.status === "COMPLETED" && (!e.grade || e.grade !== "F"))
      .sort((a, b) => a.semester - b.semester)
      .forEach((e) => {
        if (user?.branch && e.course.branchMappings && e.course.branchMappings.length > 0) {
          const branchCandidates = getBranchCandidates(user.branch);
          const mapping = branchCandidates
            .map((b) => e.course.branchMappings?.find((m) => m.branch === b))
            .find(Boolean);
          if (mapping?.splitCategory && mapping?.splitAmount != null && mapping.splitAmount > 0) {
            const mainCr = subtractCredits(e.course.credits, mapping.splitAmount);
            const mainCat = mapping.courseCategory in credits ? mapping.courseCategory : "FE";
            const splitCat = mapping.splitCategory in credits ? mapping.splitCategory : "FE";
            credits[mainCat] = addCredits(credits[mainCat], mainCr);
            credits[splitCat] = addCredits(credits[splitCat], mapping.splitAmount);
            return;
          }
        }
        const category = getCourseCategory(e, icBasketUsed);
        if (category === "HSS" || category === "IKS") {
          const before = hssUsed.credits;
          const afterCore = Math.min(hssCoreCapLocal, before + e.course.credits);
          const hss = Math.max(0, afterCore - Math.min(hssCoreCapLocal, before));
          const afterFe = Math.min(hssFeCapLocal, before + e.course.credits);
          const fe = Math.max(0, afterFe - Math.min(hssFeCapLocal, before + hss));
          const notInDegree = Math.max(0, e.course.credits - hss - fe);
          hssUsed.credits = Math.min(hssFeCapLocal, before + e.course.credits);
          if (hss > 0) credits["HSS"] = addCredits(credits["HSS"], hss);
          if (fe > 0) credits["FE"] = addCredits(credits["FE"], fe);
          if (notInDegree > 0) credits["NOT_IN_DEGREE"] = addCredits(credits["NOT_IN_DEGREE"], notInDegree);
        } else if (category in credits) {
          credits[category] = addCredits(credits[category], e.course.credits);
        }
      });

    const deCap = branchConfig?.deCredits ?? 28;
    if (credits.DE > deCap) {
      const overflow = subtractCredits(credits.DE, deCap);
      credits.DE = deCap;
      credits.FE = addCredits(credits.FE, overflow);
    }

    return { creditsByCategory: credits, completedIcBasketUsed: icBasketUsed };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments, user?.branch]);

  // Calculate HSS+IKS credits already completed (for cap check).
  // Includes HS-xxx, IC-181, IC-182 (B24+), and IK-xxx — matching creditCalculator's addHssCredits logic.
  const hssCreditsCompleted = useMemo(() => {
    const inferredBatch = (() => {
      const b = user?.batch; if (typeof b === "number" && b > 2000) return b;
      const match = /B(\d{2})/i.exec(String(user?.enrollmentId || "").toUpperCase());
      return match ? 2000 + parseInt(match[1], 10) : null;
    })();
    return enrollments
      .filter((e) => {
        if (e.status !== "COMPLETED") return false;
        const c = e.course.code.toUpperCase().replace(/[^A-Z0-9]/g,"");
        if (e.course.code.toUpperCase().startsWith("HS-")) return true;
        if (c === "IC181") return true;
        if (c === "IC182" && inferredBatch != null && inferredBatch >= 2024) return true;
        if (/^IK\d/.test(c)) return true;
        return false;
      })
      .reduce((sum, e) => addCredits(sum, e.course.credits), 0);
  }, [enrollments, user?.batch, user?.enrollmentId]);

  const enrollmentSplits = useMemo(() => {
    const splits = new Map<string, { category: string; splitCategory: string; splitCredits: number }>();
    const branchConfig = getAllBranches().find((b) => b.code === user?.branch);
    const deCap = branchConfig?.deCredits ?? 28;
    let deUsed = 0;
    const icBasketUsed = { ic1: false, ic2: false };

    enrollments
      .filter((e) => e.status === "COMPLETED" && (!e.grade || e.grade !== "F"))
      .sort((a, b) => a.semester - b.semester)
      .forEach((e) => {
        if (user?.branch && e.course.branchMappings && e.course.branchMappings.length > 0) {
          const branchCandidates = getBranchCandidates(user.branch);
          const mapping = branchCandidates
            .map((b) => e.course.branchMappings?.find((m) => m.branch === b))
            .find(Boolean);
          if (mapping?.splitCategory && mapping?.splitAmount != null && mapping.splitAmount > 0) {
            const mainCat = mapping.courseCategory || "FE";
            splits.set(e.id, {
              category: mainCat,
              splitCategory: mapping.splitCategory,
              splitCredits: mapping.splitAmount,
            });
            if (mainCat === "DE") deUsed = addCredits(deUsed, subtractCredits(e.course.credits, mapping.splitAmount));
            return;
          }
        }

        const category = getCourseCategory(e, icBasketUsed);
        if (category === "DE") {
          const deBefore = deUsed;
          deUsed = addCredits(deUsed, e.course.credits);
          if (deBefore >= deCap) {
            splits.set(e.id, { category: "FE", splitCategory: "", splitCredits: 0 });
          } else if (deUsed > deCap) {
            const dePortionUsed = subtractCredits(deCap, deBefore);
            splits.set(e.id, {
              category: "DE",
              splitCategory: "FE",
              splitCredits: subtractCredits(e.course.credits, dePortionUsed),
            });
          }
        }
      });
    return splits;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments, user?.branch]);

  // Precompute each enrollment's display category once per render pass instead of
  // re-invoking the heavy getCourseCategory branching inside every card's render.
  // IC-basket consumption is order-dependent, so we must sort by semester and pass
  // the stateful tracker — otherwise non-compulsory ICB courses all fall to FE.
  const enrollmentCategoryById = useMemo(() => {
    const map = new Map<string, string>();
    const icBasketUsedForDisplay = { ic1: false, ic2: false };
    const sorted = [...enrollments].sort((a, b) => a.semester - b.semester);
    for (const e of sorted) {
      map.set(e.id, getCourseCategory(e, icBasketUsedForDisplay));
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments, user?.branch, user?.batch, user?.enrollmentId]);

  const determineCourseType = (course: Course): string => {
    const code = course.code.toUpperCase();
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");

    const specialDpCourseType = getSpecialDpCourseType(normalizedCode);
    if (specialDpCourseType) return specialDpCourseType;
    
    // HSS+IKS courses — BTech cap = 15, BSCS cap = 12
    // HSS+IKS basket: BTech cap = 15, BSCS cap = 12
    const hssIksCap = (user?.branch === "BSCS" || user?.branch === "BS" || user?.branch === "CH") ? 12 : 15;
    if (code.startsWith("HS-")) {
      return hssCreditsCompleted < hssIksCap ? "CORE" : "FREE_ELECTIVE";
    }

    const mappedCategory = dbCourseCategoryMap.get(normalizedCode);
    if (mappedCategory) {
      switch (mappedCategory) {
        case "DE":
          return "DE";
        case "FE":
          return "FREE_ELECTIVE";
        case "MTP":
          return "MTP";
        case "ISTP":
          return "ISTP";
        default:
          return "CORE";
      }
    }

    // Fallback heuristics
    if (normalizedCode.startsWith("IC")) return "CORE";
    if (user?.branch === "CSE" && (code.startsWith("DS") || code.startsWith("CS"))) return "DE";
    if (isDataScienceBranch(user?.branch) && (code.startsWith("DS") || code.startsWith("CS"))) return "DE";
    return "FREE_ELECTIVE";
  };

  const handleAddCourse = (course: Course) => {
    const norm = course.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const isInternshipCourse = norm.endsWith("396P") || norm.endsWith("399P");
    setAddingCourse(course);
    setSemester(/^[A-Z]+-010$/i.test(course.code) ? "8" : "");
    setGrade("");
    setCourseType(determineCourseType(course));
    setIsPassFail(isInternshipCourse);
  };

  const inferBatchYear = () => {
    if (user?.batch && user.batch > 2000) return user.batch;
    if (user?.enrollmentId) {
      const match = user.enrollmentId.match(/B(\d{2})/i);
      if (match) return 2000 + parseInt(match[1], 10);
    }
    return new Date().getFullYear() - 3;
  };

  const submitEnrollment = async () => {
    if (!addingCourse || !semester) {
      showToast("error", "Please fill in all required fields");
      return;
    }
    const semNum = parseInt(semester);
    if (preRegLockedSemester !== null && semNum >= preRegLockedSemester) {
      showToast("error", `Sem ${semNum} is locked during pre-registration. You can only add courses up to Sem ${preRegLockedSemester - 1}.`);
      return;
    }

    setSubmitting(true);
    try {
      const batchYear = inferBatchYear();
      const term = semNum % 2 === 1 ? "FALL" : "SPRING";

      // Calculate year based on semester.
      // Fall (odd) opens the academic year, Spring (even) is the next calendar year:
      // Sem 1 = batchYear (FALL), Sem 2 = batchYear+1 (SPRING), Sem 3 = batchYear+1 (FALL),
      // Sem 4 = batchYear+2 (SPRING), ... → year = batchYear + floor(semester / 2).
      const courseYear = batchYear + Math.floor(semNum / 2);
      
      // Determine final course type
      let finalCourseType = courseType;
      if (courseType === "AUTO") {
        finalCourseType = determineCourseType(addingCourse);
      }

      const status = isAudit ? "AUDIT" : grade ? "COMPLETED" : semNum < 6 ? "COMPLETED" : "IN_PROGRESS";

      console.log("Frontend: Adding course to semester", semNum, "with status", status);

      const response = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: addingCourse.id,
          semester: semNum,
          year: courseYear,
          term,
          courseType: finalCourseType,
          grade: isAudit ? undefined : (grade || undefined),
          status,
          isPassFail: !isAudit && isPassFail && finalCourseType === "FREE_ELECTIVE",
        }),
      });

      if (response.ok) {
        const result = await response.json();
        showToast("success", "Course added successfully!");
        if (result.droppedPfCourses?.length > 0) {
          showToast("warning", `P/F removed from ${result.droppedPfCourses.join(", ")} — internship occupies the P/F budget.`);
        }
        setAddingCourse(null);
        setIsAudit(false);
        await loadData();
      } else {
        const error = await response.json();
        showToast("error", error.error || "Failed to add course");
      }
    } catch (error) {
      console.error("Error adding course:", error);
      showToast("error", "Failed to add course");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteEnrollment = async (enrollmentId: string, courseName: string) => {
    const ok = await confirm({
      title: "Remove course?",
      message: `This will remove ${courseName} from your enrollments.`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "warning",
    });
    if (!ok) return;

    try {
      const response = await fetch(`/api/enrollments/${enrollmentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Update the visible list immediately, then reconcile it with a fresh
        // server response so the page reflects the delete without a manual reload.
        setEnrollments((current) => current.filter((enrollment) => enrollment.id !== enrollmentId));
        showToast("success", "Course removed successfully!");
        await loadData();
      } else {
        const error = await response.json();
        showToast("error", error.error || "Failed to remove course");
      }
    } catch (error) {
      console.error("Error removing course:", error);
      showToast("error", "Failed to remove course");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/12 via-transparent to-accent/12"
          aria-hidden="true"
        />
        <div className="relative p-6 sm:p-8">
          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Courses
          </h1>
          <p className="mt-2 text-sm sm:text-base text-foreground-secondary">
            Manage your enrollments and explore the course catalog
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Award className="w-full h-full" />}
          label="Completed"
          value={formatCredits(totalCreditsCompleted)}
          sublabel="Credits earned"
          valueColor="text-success"
          iconBg="bg-success/10"
          iconColor="text-success"
          accentBgColor="bg-success/10"
          delay={0}
        />

        <StatCard
          icon={<Clock className="w-full h-full" />}
          label="In Progress"
          value={formatCredits(totalCreditsInProgress)}
          sublabel="Credits current"
          valueColor="text-info"
          iconBg="bg-info/10"
          iconColor="text-info"
          accentBgColor="bg-info/10"
          delay={0.05}
        />

        <StatCard
          icon={<BookOpen className="w-full h-full" />}
          label="Total"
          value={enrollments.length}
          sublabel="All enrollments"
          valueColor="text-primary"
          iconBg="bg-primary/10"
          iconColor="text-primary"
          accentBgColor="bg-primary/10"
          delay={0.1}
        />
      </div>

      {/* Category Breakdown */}
          {enrollments.length > 0 && (
          <div className="bg-surface rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Credits by Category</h3>
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(creditsByCategory)
                .filter(([_, credits]) => credits > 0)
                .map(([category, credits]) => {
                  const colors = categoryColors[category as keyof typeof categoryColors];
                const labels: Record<string, string> = {
                  IC: "Institute Core",
                  IC_BASKET: "IC Basket",
                  DC: "Discipline Core",
                  DE: "Discipline Electives",
                  FE: "Free Electives",
                  HSS: "HSS+IKS",
                  IKS: "HSS+IKS",
                  MTP: "MTP",
                  ISTP: "ISTP",
                  NOT_IN_DEGREE: "Not in Degree",
                };
                return (
                  <div key={category} className={`${colors.bg} ${colors.border} rounded-lg p-4 border`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${colors.bar}`}></div>
                      <span className={`text-xs font-semibold ${colors.text}`}>
                        {labels[category]}
                      </span>
                    </div>
                    <p className={`text-2xl font-bold ${colors.text}`}>{formatCredits(credits)}</p>
                    <p className="text-xs text-foreground-secondary mt-1">credits</p>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tab Navigation with Add Button */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 p-1 bg-surface rounded-lg border border-border shadow-sm flex-1">
          <button
            onClick={() => setTab("my-courses")}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
              tab === "my-courses"
                ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg"
                : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            My Enrollments ({enrollments.length})
          </button>
          <button
            onClick={() => setTab("catalog")}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
              tab === "catalog"
                ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg"
                : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            Course Catalog ({allCourses.length || initialCatalogCount || 0})
          </button>
        </div>
        <button
          onClick={() => setTab("catalog")}
          className="dp-btn dp-btn-primary sm:self-start"
        >
          <Plus className="w-4 h-4" />
          Add Courses
        </button>
      </div>

      {/* My Courses Tab */}
      <>
        {tab === "my-courses" && (
          <div
            className="space-y-4"
          >
            {enrollments.length === 0 ? (
              <div className="text-center py-12 bg-surface rounded-xl border border-border">
                <BookOpen className="w-16 h-16 text-foreground-secondary mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No courses enrolled
                </h3>
                <p className="text-foreground-secondary mb-6">
                  Browse the catalog to start adding courses
                </p>
                <button
                  onClick={() => setTab("catalog")}
                  className="dp-btn dp-btn-primary"
                >
                  <Plus className="w-5 h-5" />
                  Browse Courses
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {Array.from(new Set(enrollments.map(e => e.semester)))
                  .sort((a, b) => a - b)
                  .map((semNum) => {
                    const semesterEnrollments = enrollments.filter(e => e.semester === semNum);
                    const semCredits = sumCredits(semesterEnrollments.map((e) => e.course.credits));
                    
                    return (
                      <div key={semNum} className="space-y-3">
                        <div className="flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent rounded-lg p-4 border-l-4 border-primary">
                          <h3 className="text-xl font-bold text-foreground">
                            Semester {semNum}
                          </h3>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-foreground-secondary">
                              {semesterEnrollments.length} courses
                            </span>
                            <span className="px-4 py-1.5 bg-primary text-white rounded-full font-bold text-sm">
                              {formatCredits(semCredits)} Credits
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid gap-3 pl-4">
                          {semesterEnrollments.map((enrollment) => (
                            <div
                              key={enrollment.id}
                              className="group bg-surface rounded-lg border border-border p-4 hover:border-primary transition-colors"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <button
                                  onClick={() => setSelectedCourse(enrollment.course)}
                                  className="flex-1 min-w-0 text-left"
                                >
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                                      {formatCourseCode(enrollment.course.code)}
                                    </h3>
                                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-semibold rounded-full border border-primary/20">
                                      {formatCredits(enrollment.course.credits)} Cr
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                                        enrollment.status === "COMPLETED"
                                          ? "bg-success/10 text-success border border-success/30"
                                          : enrollment.status === "AUDIT"
                                            ? "bg-foreground-muted/10 text-foreground-muted border border-foreground-muted/30"
                                            : "bg-info/10 text-info border border-info/30"
                                      }`}
                                    >
                                      {enrollment.status === "AUDIT" ? "Audit" : enrollment.status}
                                    </span>
                                  </div>
                                  <p className="text-foreground font-medium mb-2 text-sm">
                                    {enrollment.course.name}
                                  </p>
                                  <div className="flex flex-wrap gap-2 text-xs text-foreground-secondary mb-3">
                                    <span className="px-2 py-1 bg-surface-hover rounded">
                                      {enrollment.term} {enrollment.year}
                                    </span>
                                    <span className="px-2 py-1 bg-surface-hover rounded">
                                      {SCHOOL_META[getCourseSchoolKey(enrollment.course)].label}
                                    </span>
                                  </div>
                                  {(() => {
                                    const split = enrollmentSplits.get(enrollment.id);
                                    if (split && split.splitCategory) {
                                      const mainCat = split.category as keyof typeof categoryColors;
                                      const splitCat = split.splitCategory as keyof typeof categoryColors;
                                      const mainColors = categoryColors[mainCat] ?? categoryColors.FE;
                                      const splitColors = categoryColors[splitCat] ?? categoryColors.FE;
                                      const mainLabels: Record<string, string> = {
                                        IC: "IC", IC_BASKET: "IC Basket", DC: "DC", DE: "DE",
                                        FE: "FE", HSS: "HSS", IKS: "IKS", MTP: "MTP", ISTP: "ISTP",
                                      };
                                      const mainCr = subtractCredits(enrollment.course.credits, split.splitCredits);
                                      return (
                                        <div className="flex items-center gap-1 mb-1">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full border border-border ${mainColors.bg}`}>
                                            <span className={`font-semibold text-[10px] ${mainColors.text}`}>
                                              {mainLabels[mainCat] ?? mainCat} ({formatCredits(mainCr)})
                                            </span>
                                          </span>
                                          <span className="text-foreground-secondary text-[10px]">&</span>
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full border border-border ${splitColors.bg}`}>
                                            <span className={`font-semibold text-[10px] ${splitColors.text}`}>
                                              {mainLabels[splitCat] ?? splitCat} ({formatCredits(split.splitCredits)})
                                            </span>
                                          </span>
                                        </div>
                                      );
                                    }
                                    if (split && !split.splitCategory) {
                                      const feColors = categoryColors.FE;
                                      return (
                                        <div className="mb-1">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full border border-border ${feColors.bg}`}>
                                            <span className={`font-semibold text-[10px] ${feColors.text}`}>Free Elective</span>
                                          </span>
                                        </div>
                                      );
                                    }
                                    const cat = (enrollmentCategoryById.get(enrollment.id) ?? getCourseCategory(enrollment)) as keyof typeof categoryColors;
                                    const colors = categoryColors[cat];
                                    if (!colors) return null;
                                    const catLabels: Record<string, string> = {
                                      IC: "Institute Core", IC_BASKET: "IC Basket", DC: "Discipline Core",
                                      DE: "Discipline Elective", FE: "Free Elective", HSS: "HSS+IKS",
                                      IKS: "HSS+IKS", MTP: "MTP", ISTP: "ISTP",
                                    };
                                    return (
                                      <div className="mb-1">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border border-border ${colors.bg}`}>
                                          <span className={`font-semibold text-[10px] ${colors.text}`}>{catLabels[cat] ?? cat}</span>
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </button>
                                <div className="flex flex-col gap-2">
                                  {enrollment.grade && (
                                    <div className="text-center">
                                      <p className="text-xs text-foreground-secondary mb-1">
                                        Grade
                                      </p>
                                      <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-lg">
                                        <p className="text-xl font-bold text-white">
                                          {enrollment.grade}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteEnrollment(enrollment.id, enrollment.course.name);
                                    }}
                                    className="p-2 bg-error/10 text-error rounded-lg hover:bg-error/20 transition-colors"
                                    title="Remove course"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Course Catalog Tab */}
        {tab === "catalog" && (
          <div
            className="space-y-5"
          >
            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-foreground-secondary group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Search by course code or name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchResultsLimit(20);
                  }}
                  className="w-full pl-12 pr-4 py-3 bg-surface border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground placeholder-foreground-secondary transition-all shadow-sm"
                />
              </div>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value as SchoolFilter)}
                className="px-6 py-3 bg-surface border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground font-medium shadow-sm transition-all cursor-pointer min-w-[200px]"
              >
                <option value="all">All Schools ({schoolOptions.length})</option>
                {schoolOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Course List */}
            {filteredCourses.length === 0 ? (
              <div className="text-center py-12 bg-surface rounded-xl border border-border">
                <Filter className="w-16 h-16 text-foreground-secondary mx-auto mb-4 opacity-50" />
                <p className="text-foreground-secondary">No courses found</p>
              </div>
            ) : (
              <>
                {searchLower ? (
                  <div className="grid gap-3">
                    {filteredCourses.slice(0, searchResultsLimit).map((course) => (
                      <div
                        key={course.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedCourse(course)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedCourse(course);
                          }
                        }}
                        className="group bg-surface rounded-lg border border-border p-5 hover:border-primary transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="min-w-0">
                              <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors mb-1 truncate">
                                {formatCourseCode(course.code)} - {course.name}
                              </h3>
                              {course.description && (
                                <p className="text-sm text-foreground-secondary line-clamp-1">
                                  {course.description}
                                </p>
                              )}
                            </div>
                            <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-semibold rounded-full border border-primary/20 whitespace-nowrap">
                              {formatCredits(course.credits)} Cr
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-sm">
                        {(() => {
                          const schoolKey = getCourseSchoolKey(course);
                          return (
                            <span
                              title={SCHOOL_META[schoolKey].label}
                              className="px-3 py-1 bg-surface-hover rounded font-medium text-foreground"
                            >
                              {schoolKey}
                            </span>
                          );
                        })()}
                        <span className="px-3 py-1 bg-surface-hover rounded text-foreground-secondary">
                          L{course.level}
                        </span>
                            {enrolledCourseIds.has(course.id) ? (
                              <span className="px-3 py-1 bg-success/10 text-success rounded font-medium border border-success/30 ml-auto">
                                ✓ Enrolled
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddCourse(course);
                                }}
                                className="ml-auto px-4 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-hover font-medium transition-colors flex items-center gap-1"
                              >
                                <Plus className="w-4 h-4" />
                                Add
                              </button>
                            )}
                            <div className="flex gap-2">
                              {course.offeredInFall && (
                                <span className="px-2 py-1 bg-warning/10 text-warning rounded text-xs font-semibold">
                                  Fall
                                </span>
                              )}
                              {course.offeredInSpring && (
                                <span className="px-2 py-1 bg-success/10 text-success rounded text-xs font-semibold">
                                  Spring
                                </span>
                              )}
                              {course.offeredInSummer && (
                                <span className="px-2 py-1 bg-info/10 text-info rounded text-xs font-semibold">
                                  Summer
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredCourses.length > searchResultsLimit && (
                      <button
                        type="button"
                        onClick={() => setSearchResultsLimit((prev) => prev + 20)}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface hover:bg-surface-hover transition-colors text-sm font-medium text-foreground"
                      >
                        Show more ({filteredCourses.length - searchResultsLimit} remaining)
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-foreground-secondary">
                      <p>Tap a school to expand its courses.</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={expandAllDepartments}
                          className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-hover transition-colors"
                        >
                          Expand all
                        </button>
                        <button
                          type="button"
                          onClick={collapseAllDepartments}
                          className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-hover transition-colors"
                        >
                          Collapse all
                        </button>
                      </div>
                    </div>

                    {departmentGroups.map(({ dept, label, courses }) => {
                      const isExpanded = expandedDepartments.includes(dept);
                      const visibleCount = departmentVisibleCounts[dept] || DEPARTMENT_PAGE_SIZE;
                      const visibleCourses = courses.slice(0, visibleCount);

                      return (
                        <div key={dept} className="bg-surface rounded-xl border border-border overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleDepartment(dept)}
                            aria-expanded={isExpanded}
                            className="w-full p-4 hover:bg-surface-hover transition-colors flex items-center justify-between gap-4 text-left"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{label}</p>
                              <p className="text-xs text-foreground-secondary">
                                {courses.length} courses
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full border border-border bg-surface-hover text-foreground-secondary">
                                {courses.length}
                              </span>
                              <ChevronDown
                                className={`w-4 h-4 text-foreground-secondary transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              />
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="overflow-hidden">
                                <div className="border-t border-border p-4 space-y-3">
                                  {visibleCourses.map((course) => (
                                    <div
                                      key={course.id}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => setSelectedCourse(course)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          setSelectedCourse(course);
                                        }
                                      }}
                                      className="group bg-card rounded-lg border border-border p-4 hover:border-primary transition-colors text-left w-full cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                                    >
                                              <div>
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                          <div className="min-w-0">
                                            <h3 className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors mb-1 truncate">
                                              {formatCourseCode(course.code)} - {course.name}
                                            </h3>
                                            {course.description && (
                                              <p className="text-xs sm:text-sm text-foreground-secondary line-clamp-1">
                                                {course.description}
                                              </p>
                                            )}
                                          </div>
                                          <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20 whitespace-nowrap">
                                            {formatCredits(course.credits)} Cr
                                          </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                                          <span className="px-3 py-1 bg-surface-hover rounded font-medium text-foreground">
                                            L{course.level}
                                          </span>
                                          {enrolledCourseIds.has(course.id) ? (
                                            <span className="px-3 py-1 bg-success/10 text-success rounded font-medium border border-success/30 ml-auto">
                                              ✓ Enrolled
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddCourse(course);
                                              }}
                                              className="ml-auto px-4 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-hover font-medium transition-colors flex items-center gap-1"
                                            >
                                              <Plus className="w-4 h-4" />
                                              Add
                                            </button>
                                          )}
                                          <div className="flex gap-2">
                                            {course.offeredInFall && (
                                              <span className="px-2 py-1 bg-warning/10 text-warning rounded text-xs font-semibold">
                                                Fall
                                              </span>
                                            )}
                                            {course.offeredInSpring && (
                                              <span className="px-2 py-1 bg-success/10 text-success rounded text-xs font-semibold">
                                                Spring
                                              </span>
                                            )}
                                            {course.offeredInSummer && (
                                              <span className="px-2 py-1 bg-info/10 text-info rounded text-xs font-semibold">
                                                Summer
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}

                                  {visibleCount < courses.length && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDepartmentVisibleCounts((prev) => ({
                                          ...prev,
                                          [dept]: Math.min(
                                            (prev[dept] || DEPARTMENT_PAGE_SIZE) + DEPARTMENT_PAGE_SIZE,
                                            courses.length
                                          ),
                                        }))
                                      }
                                      className="w-full px-4 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover transition-colors text-sm font-medium text-foreground"
                                    >
                                      Show more ({courses.length - visibleCount} remaining)
                                    </button>
                                  )}
                                </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </>

      {/* Course Details Modal */}
      <>
        {selectedCourse && (
          <div
            onClick={() => setSelectedCourse(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-all duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-surface rounded-2xl p-4 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 break-all sm:break-normal">
                    {formatCourseCode(selectedCourse.code)}
                  </h2>
                  <p className="text-base sm:text-xl text-foreground-secondary">
                    {selectedCourse.name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="p-2 hover:bg-surface-hover rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-surface-hover rounded-lg p-4">
                  <p className="text-sm text-foreground-secondary mb-1">
                    Credits
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCredits(selectedCourse.credits)}
                  </p>
                </div>
                <div className="bg-surface-hover rounded-lg p-4">
                  <p className="text-sm text-foreground-secondary mb-1">Level</p>
                  <p className="text-2xl font-bold text-primary">
                    {selectedCourse.level}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold text-foreground mb-3">
                  Offerings
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedCourse.offeredInFall && (
                    <span className="px-4 py-2 bg-warning/10 text-warning rounded-lg font-medium border border-warning/20">
                      Fall
                    </span>
                  )}
                  {selectedCourse.offeredInSpring && (
                    <span className="px-4 py-2 bg-success/10 text-success rounded-lg font-medium border border-success/20">
                      Spring
                    </span>
                  )}
                  {selectedCourse.offeredInSummer && (
                    <span className="px-4 py-2 bg-info/10 text-info rounded-lg font-medium border border-info/20">
                      Summer
                    </span>
                  )}
                </div>
              </div>
              {selectedCourse.description && (
                <div className="mb-6">
                  <h3 className="font-semibold text-foreground mb-2">
                    Description
                  </h3>
                  <p className="text-foreground-secondary leading-relaxed">
                    {selectedCourse.description}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedCourse.code);
                    showToast("success", "Course code copied!");
                  }}
                  className="w-full sm:flex-1 px-6 py-3 border-2 border-border text-foreground rounded-lg hover:bg-surface-hover transition-all font-medium"
                >
                  Copy Code
                </button>
                {!enrolledCourseIds.has(selectedCourse.id) && (
                  <button
                    onClick={() => {
                      setSelectedCourse(null);
                      handleAddCourse(selectedCourse);
                    }}
                    className="w-full sm:flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all font-medium flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add Course
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </>

      {/* Add Course Modal */}
      <>
        {addingCourse && (
          <div
            onClick={() => setAddingCourse(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-all duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-surface rounded-2xl p-4 sm:p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto mt-[0.8vh] transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Add Course</h2>
                <button
                  onClick={() => setAddingCourse(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-hover transition-colors text-foreground-secondary hover:text-foreground"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {/* Course Info */}
                <div className="p-4 bg-surface-hover rounded-lg border border-border">
                  <h3 className="font-bold text-lg text-foreground mb-1">
                    {formatCourseCode(addingCourse.code)}
                  </h3>
                  <p className="text-foreground-secondary">{addingCourse.name}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-1 bg-primary/10 text-primary text-sm font-semibold rounded">
                      {formatCredits(addingCourse.credits)} Credits
                    </span>
                    <span className="px-2 py-1 bg-surface text-foreground-secondary text-sm rounded">
                      {SCHOOL_META[getCourseSchoolKey(addingCourse)].label}
                    </span>
                  </div>
                </div>

                {/* XX-010 branch mismatch warning */}
                {/^[A-Z]+-010$/i.test(addingCourse.code) && (() => {
                  const prefix = addingCourse.code.split("-")[0].toUpperCase();
                  const candidates = getBranchCandidates(user?.branch).filter((b) => b !== "COMMON");
                  if (candidates.some((c) => c.toUpperCase() === prefix)) return null;
                  return (
                    <div className="p-3 rounded-lg bg-error/10 border border-error/30 text-sm text-error font-medium">
                      ⚠️ This is a different branch&apos;s Department Project — you can only add your own branch&apos;s XX-010 course.
                    </div>
                  );
                })()}

                {/* Semester Input */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Semester Number <span className="text-error">*</span>
                  </label>
                  {(() => {
                    // XX-010 courses are locked to Semester 8 only
                    if (/^[A-Z]+-010$/i.test(addingCourse.code)) {
                      return (
                        <>
                          <select
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            className="w-full px-4 py-3 bg-background border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
                          >
                            <option value="8">Semester 8 (Spring)</option>
                          </select>
                          <p className="text-xs text-info mt-1">ℹ️ Department Projects are only in Semester 8</p>
                        </>
                      );
                    }

                    const { offeredInFall, offeredInSpring } = addingCourse;
                    const offeredBothSemesters = offeredInFall && offeredInSpring;
                    const offeredOddOnly = offeredInFall && !offeredInSpring;
                    const offeredEvenOnly = !offeredInFall && offeredInSpring;

                    // If course is offered in both semesters OR neither specified, show all semesters up to currentSem
                    if (offeredBothSemesters || (!offeredInFall && !offeredInSpring)) {
                      return (
                        <>
                          <select
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            className="w-full px-4 py-3 bg-background border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
                          >
                            <option value="">Select semester...</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8].filter((s) => s <= currentSem).map((sem) => (
                              <option key={sem} value={sem}>
                                Semester {sem} ({sem % 2 === 1 ? "Fall" : "Spring"})
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-foreground-secondary mt-1">
                            Showing up to Sem {currentSem} (current semester)
                          </p>
                        </>
                      );
                    }

                    // Odd semester only (Fall only) - semesters 1, 3, 5, 7
                    if (offeredOddOnly) {
                      return (
                        <>
                          <select
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            className="w-full px-4 py-3 bg-background border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
                          >
                            <option value="">Select semester...</option>
                            {[1, 3, 5, 7].filter((s) => s <= currentSem).map((sem) => (
                              <option key={sem} value={sem}>
                                Semester {sem} (Fall)
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-warning mt-1">
                            ⚠️ Fall semesters only — up to Sem {currentSem}
                          </p>
                        </>
                      );
                    }

                    // Even semester only (Spring only) - semesters 2, 4, 6, 8
                    if (offeredEvenOnly) {
                      return (
                        <>
                          <select
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            className="w-full px-4 py-3 bg-background border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
                          >
                            <option value="">Select semester...</option>
                            {[2, 4, 6, 8].filter((s) => s <= currentSem).map((sem) => (
                              <option key={sem} value={sem}>
                                Semester {sem} (Spring)
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-info mt-1">
                            ℹ️ Spring semesters only — up to Sem {currentSem}
                          </p>
                        </>
                      );
                    }

                    // Fallback (shouldn't reach here)
                    return (
                      <>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={semester}
                          onChange={(e) => setSemester(e.target.value)}
                          placeholder="e.g., 3"
                          className="w-full px-4 py-3 bg-background border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
                        />
                        <p className="text-xs text-foreground-secondary mt-1">
                          Which semester did you take this course?
                        </p>
                      </>
                    );
                  })()}
                </div>

                {/* Grade Input */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Grade (Optional)
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    disabled={isAudit}
                    className="w-full px-4 py-3 bg-background border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">No grade yet</option>
                    <option value="A+">A+</option>
                    <option value="A">A</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B">B</option>
                    <option value="B-">B-</option>
                    <option value="C+">C+</option>
                    <option value="C">C</option>
                    <option value="C-">C-</option>
                    <option value="D">D</option>
                    <option value="F">F</option>
                    <option value="P">P (Pass)</option>
                    <option value="NP">NP (Not Pass)</option>
                  </select>
                </div>

                {/* Course Type */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Course Type
                  </label>
                  <select
                    value={courseType}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCourseType(next);
                      if (next !== "FREE_ELECTIVE") setIsPassFail(false);
                    }}
                    className="w-full px-4 py-3 bg-background border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
                  >
                    <option value="AUTO">Auto-detect (Recommended)</option>
                    <option value="CORE">Core (IC/DC)</option>
                    <option value="DE">Discipline Elective (DE)</option>
                    <option value="FREE_ELECTIVE">Free Elective (FE)</option>
                    <option value="PE">Program Elective (PE)</option>
                    <option value="ISTP">ISTP</option>
                    <option value="MTP">MTP</option>
                  </select>
                  <p className="text-xs text-foreground-secondary mt-1">
                    {courseType === "AUTO" && (() => {
                      const code = addingCourse.code.toUpperCase();
                      const normalizedCode = code.replace(/[^A-Z0-9]/g, "");

                      if (code.startsWith("HS-")) {
                        const cap = (user?.branch === "BSCS" || user?.branch === "BS" || user?.branch === "CH") ? 12 : 15;
                        return hssCreditsCompleted < cap ? (
                          <span className="text-success">→ Will count as HSS+IKS/Core ({formatCredits(subtractCredits(cap, hssCreditsCompleted))} cr remaining)</span>
                        ) : (
                          <span className="text-info">→ Will count as Free Elective (HSS+IKS cap reached)</span>
                        );
                      }

                      const catMeta: Record<string, { label: string; color: string }> = {
                        IC:   { label: "Institute Core",                        color: "text-info"      },
                        ICB:  { label: "IC Basket",                             color: "text-accent"    },
                        DC:   { label: "Discipline Core",                       color: "text-primary"   },
                        DE:   { label: "Discipline Elective",                   color: "text-secondary" },
                        FE:   { label: "Free Elective",                         color: "text-success"   },
                        HSS:  { label: "Humanities & Social Sciences",          color: "text-warning"   },
                        IKS:  { label: "Indian Knowledge System",               color: "text-warning"   },
                        MTP:  { label: "Major Technical Project",               color: "text-error"     },
                        ISTP: { label: "Interactive Socio-Technical Practicum", color: "text-accent"    },
                      };

                      const rawCat = dbCourseCategoryMap.get(normalizedCode);
                      if (rawCat && catMeta[rawCat]) {
                        const { label, color } = catMeta[rawCat];
                        return <span>→ Will count as <span className={`font-semibold ${color}`}>{label}</span></span>;
                      }

                      if (normalizedCode.startsWith("IC")) {
                        return <span>→ Will count as <span className="font-semibold text-info">Institute Core</span></span>;
                      }
                      if ((user?.branch === "CSE" || isDataScienceBranch(user?.branch)) && (code.startsWith("DS") || code.startsWith("CS"))) {
                        return <span>→ Will count as <span className="font-semibold text-secondary">Discipline Elective</span></span>;
                      }

                      return <span className="text-foreground-muted">→ No mapping for your branch — will count as <span className="font-semibold text-success">Free Elective</span></span>;
                    })()}
                  </p>
                </div>

                {/* Pass/Fail Option (FE only) */}
                {(() => {
                  const inferredType = courseType === "AUTO"
                    ? determineCourseType(addingCourse)
                    : courseType;
                  const isFE = inferredType === "FREE_ELECTIVE";
                  const canUsePF = isFE && passFailRemaining > 0;

                  return (
                    <>
                      <div className="p-4 bg-surface-hover rounded-lg border border-border">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">Pass/Fail (P/F)</p>
                            <p className="text-xs text-foreground-secondary">
                              You can take up to {maxPassFailCredits} P/F credits. Remaining: {passFailRemaining}.
                            </p>
                            {!isFE && (
                              <p className="text-xs text-foreground-secondary mt-1">Only Free Electives can be taken as P/F.</p>
                            )}
                          </div>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isPassFail}
                              onChange={(e) => setIsPassFail(e.target.checked)}
                              disabled={!canUsePF || isAudit}
                              className="h-4 w-4"
                            />
                            <span className="text-sm text-foreground">Take as P/F</span>
                          </label>
                        </div>
                      </div>
                      <div className="p-4 bg-surface-hover rounded-lg border border-border">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">Audit</p>
                            <p className="text-xs text-foreground-secondary">
                              Attended but not credited — appears in transcript with 0 counted credits.
                            </p>
                          </div>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isAudit}
                              onChange={(e) => {
                                setIsAudit(e.target.checked);
                                if (e.target.checked) {
                                  setIsPassFail(false);
                                  setGrade("");
                                }
                              }}
                              className="h-4 w-4"
                            />
                            <span className="text-sm text-foreground">Take as Audit</span>
                          </label>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setAddingCourse(null)}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 border-2 border-border text-foreground rounded-lg hover:bg-surface-hover transition-all font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitEnrollment}
                  disabled={submitting || !semester || (() => {
                    if (!/^[A-Z]+-010$/i.test(addingCourse.code)) return false;
                    const prefix = addingCourse.code.split("-")[0].toUpperCase();
                    const candidates = getBranchCandidates(user?.branch).filter((b) => b !== "COMMON");
                    return !candidates.some((c) => c.toUpperCase() === prefix);
                  })()}
                  className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Adding..." : "Add Course"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    </div>
  );
}
