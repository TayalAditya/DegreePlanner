"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProgressSkeleton } from "./loading";
import { CheckCircle, ChevronDown, ChevronRight, Clock, Loader2, Target, Trash2, X } from "lucide-react";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";
import {
  addCredits,
  formatCourseCode,
  formatCredits,
  minCredits,
  subtractCredits,
  sumCredits,
} from "@/lib/utils";
import { ICB1_CODES, ICB2_CODES, IC_BASKET_COMPULSIONS, normalizeBranchForIcBasket } from "@/lib/icBasketConfig";
import { getBranchCandidates, getCurriculumBranchCode, isDataScienceBranch } from "@/lib/branchInfo";
import { buildNonMgmtMinorCountedCourseCodeSet, useMinorPlannerSelection } from "@/lib/minorPlannerClient";
import { normalizeCourseCode } from "@/lib/parseTranscript";
import { getSpecialDpCategory } from "@/lib/specialCourseCategories";
import {
  getMtpComponent,
  MTP_COMPONENT_CREDITS,
  MTP_TOTAL_CREDITS,
} from "@/lib/mtpConfig";

interface Enrollment {
  id: string;
  semester: number;
  year: number;
  courseType: string;
  status: string;
  grade?: string;
  isInternship?: boolean;
  course: {
    code: string;
    name: string;
    credits: number;
    department: string;
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
  doingMTP?: boolean;
  doingMTP2?: boolean;
  doingISTP?: boolean;
  batch?: number | null;
  enrollmentId?: string | null;
}

interface ProgramCredits {
  icCredits?: number;
  dcCredits?: number;
  deCredits?: number;
  feCredits?: number;
  mtpIstpCredits?: number;
}

interface ProgressData {
  totalCreditsEarned: number;
  totalCreditsInProgress: number;
  totalCreditsRequired: number;
  creditsByCategory: {
    IC: number;
    IC_BASKET: number;
    DC: number;
    DE: number;
    PE: number;
    FE: number;
    HSS: number;
    IKS: number;
    MTP: number;
    ISTP: number;
  };
  creditsInProgressByCategory: {
    IC: number;
    IC_BASKET: number;
    DC: number;
    DE: number;
    PE: number;
    FE: number;
    HSS: number;
    IKS: number;
    MTP: number;
    ISTP: number;
  };
  creditsRequiredByCategory: {
    IC: number;
    IC_BASKET: number;
    DC: number;
    DE: number;
    PE: number;
    FE: number;
    HSS: number;
    IKS: number;
    MTP: number;
    ISTP: number;
  };
  semesterWiseCredits: { semester: number; credits: number; inProgressCredits: number }[];
}

// Color scheme for each category
const categoryColors = {
  IC: { bg: "bg-info/10", text: "text-info", bar: "bg-info" },
  IC_BASKET: { bg: "bg-accent/10", text: "text-accent", bar: "bg-accent" },
  DC: { bg: "bg-primary/10", text: "text-primary", bar: "bg-primary" },
  DE: { bg: "bg-secondary/10", text: "text-secondary", bar: "bg-secondary" },
  PE: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  FE: { bg: "bg-success/10", text: "text-success", bar: "bg-success" },
  HSS: { bg: "bg-warning/10", text: "text-warning", bar: "bg-warning" },
  IKS: { bg: "bg-warning/10", text: "text-warning", bar: "bg-warning" },
  MTP: { bg: "bg-error/10", text: "text-error", bar: "bg-error" },
  ISTP: { bg: "bg-accent/10", text: "text-accent", bar: "bg-accent" },
  AUDIT: { bg: "bg-foreground-muted/10", text: "text-foreground-muted", bar: "bg-foreground-muted" },
};

const categoryLabels = {
  IC: "Institute Core",
  IC_BASKET: "IC Basket",
  DC: "Discipline Core",
  DE: "Discipline Electives",
  PE: "Research & Communication",
  FE: "Free Electives",
  HSS: "Humanities & Social Sciences + IKS",
  IKS: "Indian Knowledge System",
  MTP: "Major Technical Project",
  ISTP: "Interactive Socio-Technical Practicum",
  AUDIT: "Audit (NC)",
};


// HSS_CORE_CAP is now dynamic (set inside calculateProgress based on program); module-level kept for ProgressChart display only.
const HSS_CORE_CAP_DEFAULT = 15; // BTech default
const HSS_FE_CAP = 20;

export default function ProgressPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [totalCreditsRequired, setTotalCreditsRequired] = useState(160);
  const [programCredits, setProgramCredits] = useState<ProgramCredits>({});
  const [loading, setLoading] = useState(true);
  const [includeCurrentSemesterCredits, setIncludeCurrentSemesterCredits] = useState(false);
  const [remainingOpen, setRemainingOpen] = useState(false);
  const [primaryProgramId, setPrimaryProgramId] = useState<string | null>(null);
  const [deletingEnrollmentId, setDeletingEnrollmentId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [programCourses, setProgramCourses] = useState<any[]>([]);
  const categoryDetailRef = useRef<HTMLDivElement | null>(null);
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();

  type CourseCategory = keyof typeof categoryLabels;
  type ICBasketUsed = { ic1: boolean; ic2: boolean };

  // Must ignore Samarth suffix noise like "_New" so course-type matching works consistently
  const normalizeCode = (code: string) => normalizeCourseCode(code);

  // Shared inferredBatch — used in calculateProgress and in render-level display loops
  const inferredBatch = useMemo(() => {
    if (typeof user?.batch === "number" && user.batch > 2000) return user.batch;
    const enrollmentId = String(user?.enrollmentId || "").toUpperCase();
    const match = /B(\d{2})/i.exec(enrollmentId);
    if (match) return 2000 + Number.parseInt(match[1], 10);
    return null;
  }, [user?.batch, user?.enrollmentId]);

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

  const applyMinorDeOverride = (category: CourseCategory, enrollment: Enrollment): CourseCategory => {
    if (category !== "DE") return category;
    const code = formatCourseCode(enrollment.course.code);
    if (!code) return category;
    return nonMgmtMinorCourseCodes.has(code) ? "FE" : category;
  };

  const mappingBranchAliases = useMemo(() => {
    if (!user?.branch) return [];
    return getBranchCandidates(user.branch).filter((branch) => branch !== "COMMON");
  }, [user?.branch]);

  const pickRelevantBranchMapping = (
    branch: string | undefined,
    mappings: Enrollment["course"]["branchMappings"] | undefined
  ) => {
    if (!branch || !mappings || mappings.length === 0) return undefined;
    const userBatch = typeof user?.batch === "number" ? user.batch :
      (() => { const m = /B(\d{2})/i.exec(String(user?.enrollmentId ?? "")); return m ? 2000+parseInt(m[1]) : null; })();
    const batchStr = userBatch ? String(userBatch) : "";

    // Helper: return mapping only if batch matches (exact) or is global (empty/null)
    // Skips mappings for a different specific batch.
    const pick = (m: (typeof mappings)[0]) => {
      if (!m.batch || m.batch === "") return m;   // global — always valid
      if (m.batch === batchStr) return m;           // exact batch match
      return null;                                   // different batch — skip
    };

    const candidates = [branch, ...mappingBranchAliases, ...(branch === "GE" ? ["GE"] : []), "COMMON"];
    for (const c of candidates) {
      // Prefer batch-specific over global for same branch
      const batchSpecific = mappings.find((m) => m.branch === c && m.batch === batchStr);
      if (batchSpecific) return batchSpecific;
      const global = mappings.find((m) => m.branch === c && (!m.batch || m.batch === ""));
      if (global) return global;
    }
    return undefined;
  };

  const getCourseCategory = (enrollment: Enrollment, icBasketUsed?: any, hssUsed?: { credits: number }): CourseCategory => {
    // Internship courses (XX-399P / XX-396P) are always P/F FE for all branches
    if (enrollment.isInternship || /39[69]P$/i.test(enrollment.course.code)) return "FE";

    const code = enrollment.course.code.toUpperCase();
    const normalizedCode = normalizeCode(code);
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);
    const isIkCourse = /^IK\d/.test(normalizedCode);
    const credits = enrollment.course.credits || 0;

    // IC Basket compulsion logic - check BEFORE branchMappings
    if ((isICB1 || isICB2) && user?.branch) {
      const basketBranch = normalizeBranchForIcBasket(user.branch);
      const branchCompulsion = IC_BASKET_COMPULSIONS[basketBranch] || {};
      
      if (isICB1 && branchCompulsion.ic1 && normalizedCode === branchCompulsion.ic1.replace(/[^A-Z0-9]/g, "")) {
        return "IC_BASKET";
      }
      
      if (isICB2 && branchCompulsion.ic2 && normalizedCode === branchCompulsion.ic2.replace(/[^A-Z0-9]/g, "")) {
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
      
      // Some IC basket courses are mapped as DC or DE for certain branches (e.g. MSE: IC-240 → DC, EP: IC-253 → DE).
      // Respect explicit branch mappings before defaulting to FE.
      if (enrollment.course.branchMappings && enrollment.course.branchMappings.length > 0) {
        const mapping = pickRelevantBranchMapping(user.branch, enrollment.course.branchMappings);

        if (mapping?.courseCategory === "DC") return "DC";
        if (mapping?.courseCategory === "DE") return applyMinorDeOverride("DE", enrollment);
      }

      return "FE";
    }

    // HS-xxx courses always go to HSS — never let branch mapping override
    if (normalizedCode.startsWith("HS")) {
      if (hssUsed) {
        // Cap at HSS_FE_CAP=20; accumulateSplitAware splits [0-12]→core [12-20]→FE [20+]→ignored
        hssUsed.credits = Math.min(HSS_FE_CAP, addCredits(hssUsed.credits, credits));
      }
      return "HSS";
    }

    // Hard overrides (batch-sensitive)
    const inferredBatch = (() => {
      const batch = user?.batch;
      if (typeof batch === "number" && batch > 2000) return batch;
      const enrollmentId = String(user?.enrollmentId || "").toUpperCase();
      const match = /B(\d{2})/i.exec(enrollmentId);
      if (match) return 2000 + Number.parseInt(match[1], 10);
      return null;
    })();
    const isBatch24Or25 = inferredBatch === 2024 || inferredBatch === 2025;

    // IKS courses (IC-181, IC-182, IK-xxx) → HSS+IKS basket WITHOUT consuming HS cap space.
    // HS cap (0-15 core, 15-20 FE, 20+ ignored) applies only to HS-xxx; IKS always count fully.
    if (normalizedCode === "IK593") return "HSS";
    if (normalizedCode === "IC181" || (normalizedCode === "IC182" && isBatch24Or25)) return "HSS";
    if (normalizedCode === "IC182") return "IC"; // B23 IC182 stays IC

    // Hard rule: CSE/DSE/DSAI → all CS-xxx and DS-xxx are DE, regardless of how they
    // were enrolled or what COMMON branchMappings exist. Branch-specific mappings still win
    // (e.g. a CSE-specific DC override), but COMMON mappings must not override this.
    const isCSorDS = code.startsWith("CS") || code.startsWith("DS");
    const isCsDsException = ["396P","399P","010"].some(s => normalizedCode.endsWith(s)) || normalizedCode === "DS302";
    if (isCSorDS && !isCsDsException && (user?.branch === "CSE" || isDataScienceBranch(user?.branch))) {
      // Check if there's a branch-specific (non-COMMON) override (e.g. DC for some course)
      const specificMapping = enrollment.course.branchMappings?.find(
        m => {
          const branch = m.branch || "";
          return branch !== "COMMON" && (
            branch === (user?.branch || "") ||
            mappingBranchAliases.includes(branch)
          );
        }
      );
      if (specificMapping && specificMapping.courseCategory in categoryLabels) {
        if (specificMapping.courseCategory === "IKS") return "HSS";
        return applyMinorDeOverride(specificMapping.courseCategory as CourseCategory, enrollment);
      }
      return applyMinorDeOverride("DE", enrollment);
    }

    if (enrollment.course.branchMappings && enrollment.course.branchMappings.length > 0 && user?.branch) {
      const mapping = pickRelevantBranchMapping(user.branch, enrollment.course.branchMappings);

      if (mapping?.courseCategory === "NA") {
        return "FE";
      }

      // COMMON mapping should not override an explicit FREE_ELECTIVE enrollment.
      if (mapping && mapping.branch === "COMMON" && enrollment.courseType === "FREE_ELECTIVE") {
        return "FE";
      }

      if (mapping && mapping.courseCategory in categoryLabels) {
        // IK-xxx / IKS-mapped → HSS+IKS basket without consuming HS cap.
        if (mapping.courseCategory === "IKS") return "HSS";
        const resolvedCat = applyMinorDeOverride(mapping.courseCategory as CourseCategory, enrollment);
        // Apply HSS cap for non-HS-prefix courses mapped to HSS (e.g. German intensive courses)
        if (resolvedCat === "HSS" && hssUsed) {
          hssUsed.credits = Math.min(HSS_FE_CAP, addCredits(hssUsed.credits, credits));
        }
        return resolvedCat;
      }
    }

    if (isIkCourse) return "HSS"; // IK-xxx → HSS+IKS basket without consuming HS cap

    if (normalizedCode.startsWith("IC")) return "IC";

    const specialDpCategory = getSpecialDpCategory(normalizedCode);
    if (specialDpCategory) return specialDpCategory;

    switch (enrollment.courseType) {
      case "DE":
        return applyMinorDeOverride("DE", enrollment);
      case "PE":
        return getCurriculumBranchCode(user?.branch || "") === "BSCS" ? "PE" : "FE";
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

  useEffect(() => {
    fetchProgress();
  }, []);

  const deleteEnrollment = async (enrollmentId: string, label: string) => {
    const ok = await confirm({
      title: "Remove course?",
      message: `Remove ${label} from your progress?`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "danger",
    });

    if (!ok) return;

    setDeletingEnrollmentId(enrollmentId);
    try {
      const res = await fetch(`/api/enrollments/${enrollmentId}`, { method: "DELETE" });

      let body: any = null;
      try {
        body = await res.json();
      } catch {
        // ignore
      }

      if (!res.ok) {
        throw new Error(body?.error || "Failed to remove course.");
      }

      setEnrollments((cur) => cur.filter((e) => e.id !== enrollmentId));
      showToast("success", "Course removed");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to remove course.");
    } finally {
      setDeletingEnrollmentId(null);
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem(
        "degreePlanner.progress.includeCurrentSemesterCredits"
      );
      if (stored !== null) setIncludeCurrentSemesterCredits(stored === "true");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "degreePlanner.progress.includeCurrentSemesterCredits",
        String(includeCurrentSemesterCredits)
      );
    } catch {
      // ignore
    }
  }, [includeCurrentSemesterCredits]);

  const fetchProgress = async () => {
    try {
      const [enrollmentsRes, programsRes, userRes, programCoursesRes] = await Promise.all([
        fetch("/api/enrollments"),
        fetch("/api/programs"),
        fetch("/api/user/settings"),
        fetch("/api/programs/courses"),
      ]);
      if (enrollmentsRes.ok) {
        const data = await enrollmentsRes.json();
        setEnrollments(data);
      }
      if (programsRes.ok) {
        const data = await programsRes.json();
        // Find primary major program
        const primary = (data.programs || data).find(
          (p: {
            isPrimary?: boolean;
            programType?: string;
            program?: {
              totalCreditsRequired?: number;
              type?: string;
              icCredits?: number;
              dcCredits?: number;
              deCredits?: number;
              feCredits?: number;
              mtpIstpCredits?: number;
            };
          }) => p.isPrimary || p.programType === "MAJOR"
        );
        if (primary?.program?.totalCreditsRequired) {
          setTotalCreditsRequired(primary.program.totalCreditsRequired);
        }
        if (primary?.program) {
          setProgramCredits({
            icCredits: primary.program.icCredits,
            dcCredits: primary.program.dcCredits,
            deCredits: primary.program.deCredits,
            feCredits: primary.program.feCredits,
            mtpIstpCredits: primary.program.mtpIstpCredits,
          });
          if (primary.program.id) {
            setPrimaryProgramId(primary.program.id);
          }
        }
      }
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
      }
      if (programCoursesRes.ok) {
        const data = await programCoursesRes.json();
        setProgramCourses(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch progress:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (): ProgressData => {
    const completedEnrollments = enrollments.filter(
      (e) => e.status === "COMPLETED" && (!e.grade || e.grade !== "F")
    );
    const inProgressEnrollments = enrollments.filter(
      (e) => e.status === "IN_PROGRESS"
    );

    const compareEnrollments = (a: Enrollment, b: Enrollment) =>
      (a.semester || 0) - (b.semester || 0) ||
      normalizeCode(a.course.code).localeCompare(normalizeCode(b.course.code));

    // Sort by semester+code to apply IC basket first-course logic deterministically
    const sortedCompleted = [...completedEnrollments].sort(compareEnrollments);
    const sortedInProgress = [...inProgressEnrollments].sort(compareEnrollments);
    const icBasketUsed: ICBasketUsed = { ic1: false, ic2: false };
    const hssUsed = { credits: 0 };

    const creditsByCategory = {
      IC: 0,
      IC_BASKET: 0,
      DC: 0,
      DE: 0,
      PE: 0,
      FE: 0,
      HSS: 0,
      IKS: 0,
      MTP: 0,
      ISTP: 0,
    };

    const creditsInProgressByCategory = {
      IC: 0,
      IC_BASKET: 0,
      DC: 0,
      DE: 0,
      PE: 0,
      FE: 0,
      HSS: 0,
      IKS: 0,
      MTP: 0,
      ISTP: 0,
    };

    // HSS+IKS combined basket: BTech = 15, BSCS = 12 — must be declared before accumulateSplitAware uses it
    const HSS_CORE_CAP = (programCredits.icCredits ?? 60) <= 52 ? 12 : 15;

    // inferredBatch is defined at component level (avoids temporal dead zone in closures)
    const accumulateSplitAware = (
      map: Record<string, number>,
      e: Enrollment,
      icBkt?: any,
      hssU?: { credits: number }
    ) => {
      const mapping = pickRelevantBranchMapping(user?.branch, e.course.branchMappings);
      if (mapping?.splitCategory && mapping.splitAmount != null && mapping.splitAmount > 0) {
        const mainCr = subtractCredits(e.course.credits, mapping.splitAmount);
        const mainCat = mapping.courseCategory in map ? mapping.courseCategory : "FE";
        const splitCat = mapping.splitCategory in map ? mapping.splitCategory : "FE";
        map[mainCat] = addCredits(map[mainCat], mainCr);
        map[splitCat] = addCredits(map[splitCat], mapping.splitAmount);
        return;
      }
      // IKS courses go through same HSS+IKS cap as HS-xxx — overflow → FE
      const eCode = normalizeCode(e.course.code);
      const isIksType = eCode === "IC181" || eCode === "IK593" || /^IK\d/.test(eCode) ||
        (eCode === "IC182" && (inferredBatch === 2024 || inferredBatch === 2025));
      if (isIksType) {
        const before = hssU?.credits ?? 0;
        if (hssU) hssU.credits = Math.min(HSS_CORE_CAP, before + e.course.credits);
        const after = hssU?.credits ?? before;
        const corePortion = Math.max(0, Math.min(HSS_CORE_CAP, after) - Math.min(HSS_CORE_CAP, before));
        const fePortion = Math.max(0, Math.min(HSS_FE_CAP, after) - Math.max(HSS_CORE_CAP, before));
        if (corePortion > 0) map["HSS"] = addCredits(map["HSS"] ?? 0, corePortion);
        if (fePortion > 0) map["FE"] = addCredits(map["FE"] ?? 0, fePortion);
        return;
      }
      const hssBefore = hssU?.credits ?? 0;
      const category = getCourseCategory(e, icBkt, hssU);
      const hssAfter = hssU?.credits ?? hssBefore;
      if (category === "HSS") {
        const corePortion = Math.max(0, Math.min(HSS_CORE_CAP, hssAfter) - Math.min(HSS_CORE_CAP, hssBefore));
        const fePortion = Math.max(0, Math.min(HSS_FE_CAP, hssAfter) - Math.max(HSS_CORE_CAP, hssBefore));
        if (corePortion > 0) map["HSS"] = addCredits(map["HSS"] ?? 0, corePortion);
        if (fePortion > 0) map["FE"] = addCredits(map["FE"] ?? 0, fePortion);
      } else {
        // IKS should always be merged into HSS — safety net for any edge case
        const effectiveCat = category === "IKS" ? "HSS" : category;
        map[effectiveCat] = addCredits(map[effectiveCat] ?? 0, e.course.credits);
      }
    };

    sortedCompleted.forEach((e) => accumulateSplitAware(creditsByCategory, e, icBasketUsed, hssUsed));

    sortedInProgress.forEach((e) => accumulateSplitAware(creditsInProgressByCategory, e, icBasketUsed, hssUsed));

    const totalCreditsEarned = sumCredits(completedEnrollments.map((e) => e.course.credits));

    const totalCreditsInProgress = sumCredits(inProgressEnrollments.map((e) => e.course.credits));

    const icCredits = programCredits.icCredits ?? 60;
    const icBasketRequired = 6;
    const iksRequired = 0; // IKS merged into HSS+IKS combined basket

    const isBatch22 = inferredBatch === 2022;
    
    // Adjust MTP/ISTP based on user preferences (and ignore skips if already completed)
    const doingMTP1Pref = user?.doingMTP ?? true;
    const doingMTP2Pref = user?.doingMTP2 ?? true;
    const doingISTPPref = user?.doingISTP ?? true;

    const istpCreditsCompleted = creditsByCategory.ISTP;
    const completedMtpComponents = new Set(
      sortedCompleted
        .map((enrollment) => getMtpComponent(enrollment.course.code))
        .filter((component): component is 1 | 2 => component !== null)
    );
    const mtp1Completed = completedMtpComponents.has(1);
    const mtp2Completed = completedMtpComponents.has(2);
    const istpCompleted = istpCreditsCompleted >= 4;
    const isBSProgram = getCurriculumBranchCode(user?.branch || "") === "BSCS";

    let mtpRequired = MTP_TOTAL_CREDITS;
    let istpRequired = isBSProgram ? 0 : 4;
    let deAdjustment = 0; // DE credit adjustment when skipping MTP/MTP-2
    let feAdjustment = 0; // FE credit adjustment when skipping ISTP

    if (!isBSProgram && !istpCompleted && !doingISTPPref) {
      istpRequired = 0;
      if (isBatch22) {
        deAdjustment += 3;
        feAdjustment += 1;
      } else {
        feAdjustment += 4;
      }
    }

    if (!doingMTP1Pref && !mtp1Completed) {
      mtpRequired = Math.max(0, subtractCredits(mtpRequired, MTP_COMPONENT_CREDITS));
      deAdjustment += MTP_COMPONENT_CREDITS;
    }

    if (!doingMTP2Pref && !mtp2Completed) {
      mtpRequired = Math.max(0, subtractCredits(mtpRequired, MTP_COMPONENT_CREDITS));
      deAdjustment += MTP_COMPONENT_CREDITS;
    }

    const creditsRequiredByCategory = {
      IC: Math.max(0, icCredits - icBasketRequired - HSS_CORE_CAP - iksRequired),
      IC_BASKET: icBasketRequired,
      DC: programCredits.dcCredits ?? 0,
      DE: (programCredits.deCredits ?? 0) + deAdjustment,
      PE: isBSProgram
        ? Math.max(0, (programCredits.mtpIstpCredits ?? 0) - MTP_TOTAL_CREDITS)
        : 0,
      FE: (programCredits.feCredits ?? 0) + feAdjustment,
      HSS: HSS_CORE_CAP,
      IKS: iksRequired,
      MTP: mtpRequired,
      ISTP: istpRequired,
    };

    // Group by semester (include IN_PROGRESS when toggle is ON)
    const semesterMap = new Map<number, { completed: number; inProgress: number }>();
    completedEnrollments.forEach((e) => {
      const cur = semesterMap.get(e.semester) || { completed: 0, inProgress: 0 };
      semesterMap.set(e.semester, { ...cur, completed: addCredits(cur.completed, e.course.credits) });
    });
    if (includeCurrentSemesterCredits) {
      inProgressEnrollments.forEach((e) => {
        const cur = semesterMap.get(e.semester) || { completed: 0, inProgress: 0 };
        semesterMap.set(e.semester, { ...cur, inProgress: addCredits(cur.inProgress, e.course.credits) });
      });
    }

    const semesterWiseCredits = Array.from(semesterMap.entries())
      .map(([semester, { completed, inProgress }]) => ({
        semester,
        credits: completed,
        inProgressCredits: inProgress,
      }))
      .sort((a, b) => a.semester - b.semester);

    // DE overflow → FE: same rule as creditCalculator.ts
    const deRequired = creditsRequiredByCategory.DE;
    if (creditsByCategory.DE > deRequired) {
      const overflow = subtractCredits(creditsByCategory.DE, deRequired);
      creditsByCategory.DE = deRequired;
      creditsByCategory.FE = addCredits(creditsByCategory.FE, overflow);
    }
    const deStillNeeded = Math.max(0, subtractCredits(deRequired, creditsByCategory.DE));
    if (creditsInProgressByCategory.DE > deStillNeeded) {
      const overflow = subtractCredits(creditsInProgressByCategory.DE, deStillNeeded);
      creditsInProgressByCategory.DE = deStillNeeded;
      creditsInProgressByCategory.FE = addCredits(creditsInProgressByCategory.FE, overflow);
    }

    return {
      totalCreditsEarned,
      totalCreditsInProgress,
      totalCreditsRequired,
      creditsByCategory,
      creditsInProgressByCategory,
      creditsRequiredByCategory,
      semesterWiseCredits,
    };
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const progress = useMemo(() => calculateProgress(), [enrollments, user, programCredits, nonMgmtMinorCourseCodes, mappingBranchAliases, includeCurrentSemesterCredits]);

  if (loading) {
    return <ProgressSkeleton />;
  }
  const activeEnrollments = enrollments.filter(
    (e) =>
      (e.status === "COMPLETED" && (!e.grade || e.grade !== "F")) ||
      e.status === "IN_PROGRESS" ||
      e.status === "AUDIT"
  );

  const sortedActiveEnrollments = [...activeEnrollments].sort(
    (a, b) =>
      (a.semester || 0) - (b.semester || 0) ||
      normalizeCode(a.course.code).localeCompare(normalizeCode(b.course.code))
  );

  const icBasketUsedForDisplay: ICBasketUsed = { ic1: false, ic2: false };
  const hssUsedForDisplay = { credits: 0 };
  const deUsedForDisplay = { credits: 0 };
  const deCapForDisplay = progress?.creditsRequiredByCategory?.DE ?? 28;

  const semesterCourses = sortedActiveEnrollments
    .map((e) => {
      if (e.status === "AUDIT") {
        return {
          id: e.id,
          semester: e.semester,
          code: formatCourseCode(e.course.code),
          name: e.course.name,
          credits: e.course.credits,
          status: e.status,
          grade: e.grade,
          category: "AUDIT" as CourseCategory,
          splitCategory: undefined as string | undefined,
          splitCredits: undefined as number | undefined,
        };
      }

      // Check for branch-mapping-defined splits (e.g. 12.45308: 3cr DC + 1.66cr FE)
      const mapping = pickRelevantBranchMapping(user?.branch, e.course.branchMappings);
      if (mapping?.splitCategory && mapping.splitAmount != null && mapping.splitAmount > 0) {
        const mainCr = subtractCredits(e.course.credits, mapping.splitAmount);
        const mainCat = (mapping.courseCategory in categoryLabels ? mapping.courseCategory : "FE") as CourseCategory;
        const splitCat = (mapping.splitCategory in categoryLabels ? mapping.splitCategory : "FE") as string;
        if (mainCat === "DE" && e.status === "COMPLETED" && (!e.grade || e.grade !== "F")) {
          deUsedForDisplay.credits = addCredits(deUsedForDisplay.credits, mainCr);
        }
        return {
          id: e.id,
          semester: e.semester,
          code: formatCourseCode(e.course.code),
          name: e.course.name,
          credits: e.course.credits,
          status: e.status,
          grade: e.grade,
          category: mainCat,
          splitCategory: splitCat,
          splitCredits: mapping.splitAmount,
        };
      }

      // IKS courses always count fully in HSS — no cap split for display
      const eCode2 = normalizeCode(e.course.code);
      const isIksDisplay = eCode2 === "IC181" || eCode2 === "IK593" || /^IK\d/.test(eCode2) ||
        (eCode2 === "IC182" && (inferredBatch === 2024 || inferredBatch === 2025));
      const hssBefore = hssUsedForDisplay.credits;
      if (isIksDisplay) {
        hssUsedForDisplay.credits = Math.min(progress?.creditsRequiredByCategory?.HSS ?? HSS_FE_CAP, hssBefore + (e.course.credits || 0));
      }
      let category = getCourseCategory(e, icBasketUsedForDisplay, hssUsedForDisplay);
      if (!isIksDisplay && eCode2.startsWith("HS") && category !== "HSS") {
        category = "HSS";
        hssUsedForDisplay.credits = Math.min(HSS_FE_CAP, hssBefore + (e.course.credits || 0));
      }

      // HSS overflow split
      const hssAfter = hssUsedForDisplay.credits;
      const hssPortionUsed = isIksDisplay
        ? Math.max(0, hssAfter - hssBefore)
        : subtractCredits(hssAfter, hssBefore);
      const hssSplitCredits = category === "HSS" && hssPortionUsed < e.course.credits
        ? subtractCredits(e.course.credits, hssPortionUsed)
        : undefined;
      if (hssSplitCredits !== undefined) {
        return {
          id: e.id,
          semester: e.semester,
          code: formatCourseCode(e.course.code),
          name: e.course.name,
          credits: e.course.credits,
          status: e.status,
          grade: e.grade,
          category,
          splitCategory: "FE" as string,
          splitCredits: hssSplitCredits,
        };
      }

      // DE overflow split: when cumulative DE exceeds the cap, extra goes to FE
      const isCompleted = e.status === "COMPLETED" && (!e.grade || e.grade !== "F");
      if (category === "DE" && isCompleted) {
        const deBefore = deUsedForDisplay.credits;
        deUsedForDisplay.credits = addCredits(deBefore, e.course.credits);
        if (deBefore >= deCapForDisplay) {
          return {
            id: e.id,
            semester: e.semester,
            code: formatCourseCode(e.course.code),
            name: e.course.name,
            credits: e.course.credits,
            status: e.status,
            grade: e.grade,
            category: "FE" as CourseCategory,
            splitCategory: undefined as string | undefined,
            splitCredits: undefined as number | undefined,
          };
        }
        if (deUsedForDisplay.credits > deCapForDisplay) {
          const dePortionUsed = subtractCredits(deCapForDisplay, deBefore);
          const deSplitCredits = subtractCredits(e.course.credits, dePortionUsed);
          return {
            id: e.id,
            semester: e.semester,
            code: formatCourseCode(e.course.code),
            name: e.course.name,
            credits: e.course.credits,
            status: e.status,
            grade: e.grade,
            category,
            splitCategory: "FE" as string,
            splitCredits: deSplitCredits,
          };
        }
      }

      return {
        id: e.id,
        semester: e.semester,
        code: formatCourseCode(e.course.code),
        name: e.course.name,
        credits: e.course.credits,
        status: e.status,
        grade: e.grade,
        category,
        splitCategory: undefined as string | undefined,
        splitCredits: undefined as number | undefined,
      };
    })
    .reduce<Record<number, any[]>>((acc, course) => {
      const sem = course.semester || 0;
      const list = acc[sem] || [];
      list.push(course);
      acc[sem] = list;
      return acc;
    }, {});

  const semesters = Object.keys(semesterCourses)
    .map((s) => Number(s))
    .sort((a, b) => a - b);
  const latestSemester = semesters.length > 0 ? semesters[semesters.length - 1] : null;
  const totalCountedCredits = minCredits(
    progress.totalCreditsRequired,
    addCredits(
      progress.totalCreditsEarned,
      includeCurrentSemesterCredits ? progress.totalCreditsInProgress : 0
    )
  );
  const remainingCredits = Math.max(0, subtractCredits(progress.totalCreditsRequired, totalCountedCredits));
  const completionPercentage =
    progress.totalCreditsRequired > 0
      ? Math.round((totalCountedCredits / progress.totalCreditsRequired) * 100)
      : 0;

  const remainingBreakdown = (Object.keys(categoryLabels) as CourseCategory[])
    .filter((c) => c !== "AUDIT")
    .map((category) => {
      const required = progress.creditsRequiredByCategory[category] ?? 0;
      const completed = progress.creditsByCategory[category] ?? 0;
      const inProgress = progress.creditsInProgressByCategory[category] ?? 0;
      const countedRaw = addCredits(completed, includeCurrentSemesterCredits ? inProgress : 0);
      const counted = required > 0 ? minCredits(required, countedRaw) : countedRaw;
      const remaining = required > 0 ? Math.max(0, subtractCredits(required, counted)) : 0;
      const colors = categoryColors[category];
      const label = categoryLabels[category];

      return {
        category,
        label,
        colors,
        required,
        completed,
        inProgress,
        counted,
        remaining,
      };
    })
    .filter((row) => row.required > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Academic Progress</h1>
        <p className="text-foreground-secondary mt-2 text-sm sm:text-base">
          Track your degree completion and credit requirements
        </p>
      </div>

      {/* Overall Progress */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Overall Progress</h2>
            <p className="text-foreground-secondary">
              {formatCredits(totalCountedCredits)} / {formatCredits(progress.totalCreditsRequired)} credits
              {includeCurrentSemesterCredits ? " (incl. current semester)" : " completed"}
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <p className="text-3xl sm:text-4xl font-bold text-primary">{completionPercentage}%</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={includeCurrentSemesterCredits}
                onClick={() => setIncludeCurrentSemesterCredits((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full border border-border transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
                  includeCurrentSemesterCredits ? "bg-primary" : "bg-border"
                }`}
              >
                <span className="sr-only">Include current semester credits</span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    includeCurrentSemesterCredits ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-xs text-foreground-secondary">Include current sem</span>
            </div>
          </div>
        </div>
        <div className="w-full bg-surface rounded-full h-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-surface rounded-lg border border-border p-3 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-success/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-success" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-foreground-secondary">Completed</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground">
                {formatCredits(progress.totalCreditsEarned)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-3 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-info/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 sm:w-6 sm:h-6 text-info" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-foreground-secondary">In Progress</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground">
                {formatCredits(progress.totalCreditsInProgress)}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRemainingOpen((v) => !v)}
          aria-expanded={remainingOpen}
          className="bg-surface rounded-lg border border-border p-3 sm:p-6 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-warning/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-4 h-4 sm:w-6 sm:h-6 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-foreground-secondary">Remaining</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground">
                {formatCredits(remainingCredits)}
              </p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-foreground-secondary transition-transform duration-200 ${remainingOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </div>
          <p className="text-xs text-foreground-secondary">
            {remainingOpen ? "Hide breakdown" : "View breakdown"}
          </p>
        </button>
      </div>

      {remainingOpen && (
        <div className="bg-surface rounded-lg border border-border p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-foreground">
                Remaining breakdown
              </h3>
              <p className="text-xs text-foreground-secondary mt-1">
                Required vs counted credits by category
                {includeCurrentSemesterCredits ? " (including current semester)" : ""}.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {remainingBreakdown.map((r) => (
              <div key={r.category} className="rounded-lg border border-border bg-surface-hover/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${r.colors.text}`}>
                      {r.label}
                    </p>
                    <p className="text-xs text-foreground-secondary mt-0.5">
                      {formatCredits(r.counted)} / {formatCredits(r.required)} credits
                      {includeCurrentSemesterCredits && r.inProgress > 0 && (
                        <span className="text-info"> (+{formatCredits(r.inProgress)} in progress)</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] text-foreground-secondary">Remaining</p>
                    <p className="text-sm font-semibold text-foreground">{formatCredits(r.remaining)}</p>
                  </div>
                </div>
                <div className="mt-3 h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className={`h-full ${r.colors.bar} rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${r.required > 0 ? Math.min(100, (r.counted / r.required) * 100) : 0}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Credits by Category */}
      {(() => {
        // Map a ProgramCourse (not yet enrolled) to a display category key
        const inferProgramCourseCategory = (pc: any): string => {
          const code = String(pc.course?.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
          const ct: string = pc.courseType ?? "";
          if (ct === "MTP") return "MTP";
          if (ct === "ISTP") return "ISTP";
          if (ct === "DE") return "DE";
          if (ct === "PE") return "PE";
          if (ct === "FREE_ELECTIVE") return "FE";
          // CORE: differentiate by code prefix
          if (code.startsWith("HS")) return "HSS";
          if (code === "IC181" || code === "IK593" || /^IK\d/.test(code)) return "HSS";
          const isBatch24Or25 = inferredBatch === 2024 || inferredBatch === 2025;
          if (code === "IC182" && isBatch24Or25) return "HSS";
          if (code.startsWith("IC")) {
            // Check IC basket
            const { ICB1_CODES: b1, ICB2_CODES: b2 } = { ICB1_CODES, ICB2_CODES };
            if ((b1.has(code) || b2.has(code)) && user?.branch) return "IC_BASKET";
            return "IC";
          }
          return "DC";
        };

        // Enrolled course codes (normalized) for dedup
        const enrolledCodes = new Set(
          enrollments
            .filter(e => e.status === "COMPLETED" || e.status === "IN_PROGRESS")
            .map(e => normalizeCode(e.course.code))
        );

        // Build "to be taken" by category from program courses
        const toBeTakenByCat: Record<string, { code: string; name: string; credits: number; semester: number | null }[]> = {};
        for (const pc of programCourses) {
          const code = normalizeCode(pc.course?.code ?? "");
          if (!code || enrolledCodes.has(code)) continue;
          const cat = inferProgramCourseCategory(pc);
          if (!toBeTakenByCat[cat]) toBeTakenByCat[cat] = [];
          toBeTakenByCat[cat].push({
            code: formatCourseCode(pc.course.code),
            name: pc.course.name,
            credits: pc.course.credits,
            semester: pc.semester ?? null,
          });
        }

        // Build flat list of all courses grouped by their computed category
        const coursesByCat: Record<string, { code: string; name: string; credits: number; status: string; grade?: string; semester: number; splitCategory?: string; splitCredits?: number }[]> = {};
        for (const sem of Object.values(semesterCourses)) {
          for (const c of sem as any[]) {
            // Primary category
            if (!coursesByCat[c.category]) coursesByCat[c.category] = [];
            coursesByCat[c.category].push(c);
            // Split category (e.g. HSS + FE split)
            if (c.splitCategory) {
              if (!coursesByCat[c.splitCategory]) coursesByCat[c.splitCategory] = [];
              // Avoid duplicate entry; mark as split
              coursesByCat[c.splitCategory].push({ ...c, _isSplit: true } as any);
            }
          }
        }

        const hasAnyCourses = Object.values(progress.creditsByCategory).some(v => v > 0) ||
          Object.values(progress.creditsInProgressByCategory).some(v => v > 0);

        return (
          <div className="bg-surface rounded-lg border border-border p-4 sm:p-6">
            <h3 className="text-base sm:text-xl font-semibold text-foreground mb-2">Credits by Category</h3>
            <p className="text-xs text-foreground-secondary mb-5">Tap a category to see your courses in that basket.</p>
            <div className="space-y-3">
              {Object.entries(progress.creditsByCategory).map(([category, credits]) => {
                const inProgress = progress.creditsInProgressByCategory[category as keyof typeof progress.creditsInProgressByCategory];
                const total = addCredits(credits, inProgress);
                const colors = categoryColors[category as keyof typeof categoryColors];
                const label = categoryLabels[category as keyof typeof categoryLabels];
                const required = progress.creditsRequiredByCategory[category as keyof typeof progress.creditsRequiredByCategory];
                const denominator = required > 0 ? required : Math.max(total, 1);
                const isSelected = selectedCategory === category;

                if (total === 0) return null;

                const catCourses = coursesByCat[category] ?? [];
                const doneCourses = catCourses.filter(c => c.status === "COMPLETED");
                const pendingCourses = catCourses.filter(c => c.status === "IN_PROGRESS");
                const toBeTaken = toBeTakenByCat[category] ?? [];

                return (
                  <div key={category}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory(isSelected ? null : category);
                        if (!isSelected) {
                          setTimeout(() => categoryDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
                        }
                      }}
                      className={`w-full text-left rounded-lg border transition-colors p-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${isSelected ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-surface-hover"}`}
                      aria-expanded={isSelected}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 mb-2">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colors.bar}`}></div>
                          <span className={`min-w-0 font-semibold ${colors.text} break-words`}>{label}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-foreground font-bold sm:text-right">
                            {formatCredits(credits)}
                            {inProgress > 0 && <span className="text-info"> (+{formatCredits(inProgress)})</span>}
                            {required > 0 ? `/${formatCredits(required)}` : null}
                          </span>
                          {isSelected
                            ? <X className="w-4 h-4 text-foreground-secondary" />
                            : <ChevronRight className="w-4 h-4 text-foreground-secondary" />}
                        </div>
                      </div>
                      <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full ${colors.bar} rounded-full transition-all duration-500 ease-out`}
                          style={{ width: `${Math.min((total / denominator) * 100, 100)}%` }}
                        />
                      </div>
                    </button>

                    {isSelected && (
                      <div ref={categoryDetailRef} className="mt-1 mb-2 rounded-lg border border-border bg-surface-hover/60 p-4">
                        {doneCourses.length === 0 && pendingCourses.length === 0 && toBeTaken.length === 0 ? (
                          <p className="text-sm text-foreground-secondary">No courses in this basket yet.</p>
                        ) : (
                          <div className="space-y-5">

                            {/* Completed */}
                            {doneCourses.length > 0 && (
                              <div>
                                <p className="text-xs font-bold text-success mb-2 uppercase tracking-wide flex items-center gap-1.5">
                                  <CheckCircle className="w-3.5 h-3.5" /> Completed ({doneCourses.length})
                                </p>
                                <div className="space-y-1.5">
                                  {doneCourses.map((c, i) => (
                                    <div key={`${c.code}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono text-xs font-semibold text-foreground flex-shrink-0">{c.code}</span>
                                        <span className="text-foreground-secondary truncate">{c.name}</span>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-xs text-foreground-secondary">{formatCredits(c.credits)} cr</span>
                                        {c.grade && <span className="text-xs font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded">{c.grade}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* In Progress */}
                            {pendingCourses.length > 0 && (
                              <div>
                                <p className="text-xs font-bold text-info mb-2 uppercase tracking-wide flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5" /> In Progress ({pendingCourses.length})
                                </p>
                                <div className="space-y-1.5">
                                  {pendingCourses.map((c, i) => (
                                    <div key={`${c.code}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono text-xs font-semibold text-foreground flex-shrink-0">{c.code}</span>
                                        <span className="text-foreground-secondary truncate">{c.name}</span>
                                      </div>
                                      <span className="text-xs text-foreground-secondary flex-shrink-0">{formatCredits(c.credits)} cr</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* To Be Taken */}
                            {toBeTaken.length > 0 && (
                              <div>
                                <p className="text-xs font-bold text-foreground-secondary mb-2 uppercase tracking-wide flex items-center gap-1.5">
                                  <Target className="w-3.5 h-3.5" /> To Be Taken ({toBeTaken.length})
                                </p>
                                <div className="space-y-1.5">
                                  {toBeTaken.map((c, i) => (
                                    <div key={`${c.code}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono text-xs font-semibold text-foreground-secondary flex-shrink-0">{c.code}</span>
                                        <span className="text-foreground-secondary truncate">{c.name}</span>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-xs text-foreground-secondary">{formatCredits(c.credits)} cr</span>
                                        {c.semester != null && (
                                          <span className="text-xs text-foreground-secondary bg-border px-1.5 py-0.5 rounded">Sem {c.semester}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!hasAnyCourses && (
              <div className="text-center py-8 text-foreground-secondary">
                <p>No courses enrolled yet. Start adding courses to see your progress!</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Courses by Semester */}
      <div className="bg-surface rounded-lg border border-border p-4 sm:p-6">
        <h3 className="text-base sm:text-xl font-semibold text-foreground mb-2">
          Courses (Semester-wise)
        </h3>
        <p className="text-xs text-foreground-secondary mb-4">
          Collapsed by semester so this page doesn&apos;t become huge as you add more courses.
        </p>

        {semesters.length === 0 ? (
          <p className="text-foreground-secondary text-sm">
            No courses found yet.
          </p>
        ) : (
          <div className="space-y-3">
            {semesters.map((sem) => {
              const courses = semesterCourses[sem] || [];
              const completedCredits = sumCredits(courses
                .filter((c) => c.status === "COMPLETED")
                .map((c) => c.credits));
              const inProgressCredits = sumCredits(courses
                .filter((c) => c.status === "IN_PROGRESS")
                .map((c) => c.credits));
              const totalCredits = addCredits(completedCredits, inProgressCredits);

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
                        {courses.length} courses • {formatCredits(completedCredits)}
                        {inProgressCredits > 0 ? (
                          <span className="text-info"> (+{formatCredits(inProgressCredits)})</span>
                        ) : null}{" "}
                        credits{inProgressCredits > 0 ? ` • ${formatCredits(totalCredits)} total` : ""}
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-foreground-secondary transition-transform duration-200 group-open:rotate-180" />
                  </summary>

                  <div className="px-4 pb-4 overflow-x-auto">
                    <table className="min-w-[760px] w-full text-sm">
                      <thead className="text-foreground-secondary">
                        <tr className="border-b border-border">
                          <th className="py-2 pr-4 text-left whitespace-nowrap">Code</th>
                          <th className="py-2 pr-4 text-left min-w-[16rem]">Course</th>
                          <th className="py-2 pr-4 text-right whitespace-nowrap">Credits</th>
                          <th className="py-2 pr-4 text-left whitespace-nowrap">Status</th>
                          <th className="py-2 text-left whitespace-nowrap">Counts As</th>
                          <th className="py-2 text-right whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courses.map((c) => {
                          const colors = categoryColors[c.category as CourseCategory];
                          const label = categoryLabels[c.category as CourseCategory];
                          const statusBadge =
                            c.status === "COMPLETED"
                              ? "bg-success/10 text-success"
                              : c.status === "AUDIT"
                                ? "bg-foreground-muted/10 text-foreground-muted"
                                : "bg-info/10 text-info";
                          const statusText =
                            c.status === "COMPLETED"
                              ? `Completed${c.grade ? ` (${c.grade})` : ""}`
                              : c.status === "AUDIT"
                                ? "Audit"
                                : "In Progress";

                          return (
                            <tr key={c.id} className="border-b border-border/60 last:border-0">
                              <td className="py-2 pr-4 font-semibold text-foreground whitespace-nowrap">
                                {c.code}
                              </td>
                              <td className="py-2 pr-4 text-foreground-secondary">
                                {c.name}
                              </td>
                              <td className={`py-2 pr-4 text-right whitespace-nowrap ${c.status === "AUDIT" ? "text-foreground-muted line-through" : "text-foreground"}`}>
                                {formatCredits(c.credits)}
                              </td>
                              <td className="py-2 pr-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full ${statusBadge}`}>
                                  <span className="font-semibold">{statusText}</span>
                                </span>
                              </td>
                              <td className="py-2 whitespace-nowrap">
                                {c.splitCategory ? (() => {
                                  const mainCat = c.category as CourseCategory;
                                  const splitCat = c.splitCategory as CourseCategory;
                                  const mainColors = categoryColors[mainCat] ?? categoryColors.FE;
                                  const splitColors = categoryColors[splitCat] ?? categoryColors.FE;
                                  const mainLabel = categoryLabels[mainCat] ?? mainCat;
                                  const splitLabel = categoryLabels[splitCat] ?? splitCat;
                                  const mainCr = subtractCredits(c.credits, c.splitCredits ?? 0);
                                  return (
                                    <span className="inline-flex items-center gap-1">
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full border border-border ${mainColors.bg}`}>
                                        <span className={`font-semibold text-xs ${mainColors.text}`}>
                                          {mainLabel} ({formatCredits(mainCr)})
                                        </span>
                                      </span>
                                      <span className="text-foreground-secondary text-xs">&amp;</span>
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full border border-border ${splitColors.bg}`}>
                                        <span className={`font-semibold text-xs ${splitColors.text}`}>
                                          {splitLabel} ({formatCredits(c.splitCredits ?? 0)})
                                        </span>
                                      </span>
                                    </span>
                                  );
                                })() : (
                                  <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-border ${colors.bg}`}>
                                    <span className={`font-semibold ${colors.text}`}>{label}</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => deleteEnrollment(c.id, `${c.code} — ${c.name}`)}
                                  className="dp-icon-btn min-h-0 min-w-0 w-8 h-8 border-transparent bg-transparent hover:bg-surface-hover text-error"
                                  disabled={deletingEnrollmentId !== null}
                                  aria-label={`Remove ${c.code}`}
                                >
                                  {deletingEnrollmentId === c.id ? (
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

        <p className="mt-3 text-xs text-foreground-secondary">
          Note: IC Basket courses can show up as FE based on your branch compulsion + first-course logic.
        </p>
      </div>

      {/* Semester-wise Progress */}
      {progress.semesterWiseCredits.length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h3 className="text-xl font-semibold text-foreground mb-4">
            Semester-wise Credits
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {progress.semesterWiseCredits.map(({ semester, credits, inProgressCredits }) => {
              const hasPending = inProgressCredits > 0;
              return (
                <div
                  key={semester}
                  className={`rounded-lg p-4 text-center border ${
                    hasPending
                      ? "bg-info/10 border-info/30"
                      : "bg-primary/10 border-primary/20"
                  }`}
                >
                  <p className="text-sm text-foreground-secondary mb-1">Sem {semester}</p>
                  <p className={`text-2xl font-bold ${hasPending ? "text-info" : "text-primary"}`}>
                    {formatCredits(addCredits(credits, inProgressCredits))}
                  </p>
                  {hasPending && credits > 0 && (
                    <p className="text-[10px] text-foreground-secondary mt-0.5">
                      {formatCredits(credits)} done + {formatCredits(inProgressCredits)} wip
                    </p>
                  )}
                  {hasPending && credits === 0 && (
                    <p className="text-[10px] text-info/70 mt-0.5">in progress</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
