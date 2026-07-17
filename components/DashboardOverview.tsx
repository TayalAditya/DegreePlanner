"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import Link from "next/link";
import { BookOpen, TrendingUp, AlertCircle } from "lucide-react";
import { addCredits, formatCourseCode, formatCredits, minCredits, subtractCredits, sumCredits } from "@/lib/utils";
import { ICB1_CODES, ICB2_CODES, IC_BASKET_COMPULSIONS, normalizeBranchForIcBasket } from "@/lib/icBasketConfig";
import { getBranchCandidates, isDataScienceBranch } from "@/lib/branchInfo";
import { pickBranchMapping, type BranchMapping } from "@/lib/courseCategory";
import { buildNonMgmtMinorCountedCourseCodeSet, useMinorPlannerSelection } from "@/lib/minorPlannerClient";
import { getSpecialDpCategory } from "@/lib/specialCourseCategories";

interface DashboardOverviewProps {
  userId: string;
  initialUserSettings?: any;
  initialAcademicState?: any;
  initialEnrollments?: any;
}


const HSS_CORE_CAP = 15; // Dynamic in practice; 15 BTech / 12 BSCS — component uses program data

const HSS_FE_CAP = 20;

const categoryLabels = {
  IC: "Institute Core",
  IC_BASKET: "IC Basket",
  DC: "Discipline Core",
  DE: "Discipline Elective",
  FE: "Free Elective",
  HSS: "HSS+IKS",
  IKS: "HSS+IKS",
  NOT_IN_DEGREE: "Not in Degree",
  MTP: "MTP",
  ISTP: "ISTP",
} as const;

const categoryColors: Record<keyof typeof categoryLabels, { bg: string; text: string }> = {
  IC: { bg: "bg-info/10", text: "text-info" },
  IC_BASKET: { bg: "bg-accent/10", text: "text-accent" },
  DC: { bg: "bg-primary/10", text: "text-primary" },
  DE: { bg: "bg-secondary/10", text: "text-secondary" },
  FE: { bg: "bg-success/10", text: "text-success" },
  HSS: { bg: "bg-warning/10", text: "text-warning" },
  IKS: { bg: "bg-warning/10", text: "text-warning" },
  NOT_IN_DEGREE: { bg: "bg-foreground-muted/10", text: "text-foreground-muted" },
  MTP: { bg: "bg-error/10", text: "text-error" },
  ISTP: { bg: "bg-accent/10", text: "text-accent" },
};

type DashboardCategory = keyof typeof categoryLabels;
type CreditAllocation = { category: DashboardCategory; credits: number };

function splitHssIksCredits(before: number, credits: number, coreCap: number) {
  const hss = Math.max(0, Math.min(credits, coreCap - before));
  const fe = Math.max(
    0,
    Math.min(credits - hss, HSS_FE_CAP - Math.max(coreCap, before))
  );
  return { hss, fe, notInDegree: Math.max(0, credits - hss - fe) };
}

export function DashboardOverview({ userId, initialUserSettings, initialAcademicState, initialEnrollments }: DashboardOverviewProps) {
  const hssCoreCap = Number(initialUserSettings?.programIcCredits ?? 60) <= 52 ? 12 : HSS_CORE_CAP;
  const hasInitialEnrollments = Array.isArray(initialEnrollments);
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["enrollments", userId],
    queryFn: async () => {
      const res = await fetch("/api/enrollments");
      if (!res.ok) throw new Error("Failed to fetch enrollments");
      return res.json();
    },
    // Seeded from the server render so the dashboard paints without a client
    // fetch; revalidates in the background after staleTime.
    initialData: hasInitialEnrollments ? initialEnrollments : undefined,
    staleTime: hasInitialEnrollments ? 30_000 : 0,
  });

  const { data: userSettings } = useQuery({
    queryKey: ["user-settings"],
    queryFn: async () => {
      const res = await fetch("/api/user/settings");
      if (!res.ok) throw new Error("Failed to fetch user settings");
      return res.json();
    },
    initialData: initialUserSettings,
    staleTime: initialUserSettings ? 3600_000 : 0,
  });

  const { data: academicState } = useQuery({
    queryKey: ["academic-state"],
    queryFn: async () => {
      const res = await fetch("/api/academic-state");
      if (!res.ok) return null;
      return res.json();
    },
    initialData: initialAcademicState,
    staleTime: initialAcademicState ? 3600_000 : 0,
  });

  const allEnrollments = enrollments || [];
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

  const latestInProgressSemester =
    allEnrollments.length > 0
      ? Math.max(
          0,
          ...allEnrollments
            .filter((e: any) => e.status === "IN_PROGRESS")
            .map((e: any) => e.semester || 0)
        )
      : 0;

  const latestAnySemester =
    allEnrollments.length > 0
      ? Math.max(0, ...allEnrollments.map((e: any) => e.semester || 0))
      : 0;

  const currentSemester =
    typeof academicState?.currentSemester === "number"
      ? academicState.currentSemester
      : latestInProgressSemester > 0
      ? latestInProgressSemester
      : latestAnySemester > 0
        ? latestAnySemester
        : 1;

  const currentSemesterEnrollments = allEnrollments.filter(
    (e: any) => e.semester === currentSemester && e.status === "IN_PROGRESS"
  );

  const completedCourses = allEnrollments.filter(
    (e: any) => e.status === "COMPLETED"
  );

  const completedEnrollments = allEnrollments.filter(
    (e: any) => e.status === "COMPLETED" && (!e.grade || e.grade !== "F")
  );

  const normalizeCourseCode = (text: string) =>
    String(text ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  const compareEnrollments = (a: any, b: any) =>
    (a.semester || 0) - (b.semester || 0) ||
    normalizeCourseCode(a.course?.code).localeCompare(normalizeCourseCode(b.course?.code));

  const sortedEnrollments = [...completedEnrollments].sort(compareEnrollments);

  const mappingBranchAliases = useMemo(() => {
    const raw = userSettings?.branch;
    if (!raw) return [];
    return getBranchCandidates(raw).filter((branch) => branch !== "COMMON");
  }, [userSettings?.branch]);

  // Batch-aware resolution via the shared canonical scorer (lib/courseCategory.ts).
  // getBranchCandidates() already covers branch aliases, GE, and COMMON (lowest priority),
  // so this subsumes the previous manual exact/direct/ge/common fallback chain.
  const pickRelevantBranchMapping = (
    branch: string | undefined,
    mappings: any[] | undefined,
    batchYear?: number | null
  ) => {
    if (!branch || !mappings || mappings.length === 0) return undefined;
    return pickBranchMapping(mappings as BranchMapping[], branch, batchYear);
  };

  const getCourseCategory = (
    enrollment: any,
    icBasketUsed?: { ic1: boolean; ic2: boolean }
  ): keyof typeof categoryLabels => {
    if (enrollment.isPassFail) return "FE";
    // Internship courses (XX-399P / XX-396P) are always P/F FE for all branches
    if (enrollment.isInternship || /39[69]P$/i.test(enrollment.course?.code ?? "")) return "FE";

    const applyMinorDeOverride = (category: keyof typeof categoryLabels): keyof typeof categoryLabels => {
      if (category !== "DE") return category;
      const code = formatCourseCode(enrollment.course?.code ?? "");
      if (!code) return category;
      return nonMgmtMinorCourseCodes.has(code) ? "FE" : category;
    };

    const code = enrollment.course?.code?.toUpperCase() || "";
    const normalizedCode = normalizeCourseCode(code);
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);
    const isIkCourse = /^IK\d/.test(normalizedCode);
    const credits = enrollment.course?.credits || 0;

    const inferredBatch = (() => {
      const batch = userSettings?.batch;
      if (typeof batch === "number" && batch > 2000) return batch;
      const enrollmentId = String(userSettings?.enrollmentId || "").toUpperCase();
      const match = /B(\d{2})/i.exec(enrollmentId);
      if (match) return 2000 + Number.parseInt(match[1], 10);
      return null;
    })();
    const isBatch24Or25 = inferredBatch === 2024 || inferredBatch === 2025;

    // IC Basket compulsion logic - check BEFORE branchMappings
    if ((isICB1 || isICB2) && userSettings?.branch) {
      const basketBranch = normalizeBranchForIcBasket(userSettings.branch);
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
      
       // Some IC basket courses are mapped as DC for certain branches (e.g. MSE: IC-240).
       // Respect explicit branch mappings before defaulting to FE.
       if (enrollment.course?.branchMappings && enrollment.course.branchMappings.length > 0) {
        const mapping = pickRelevantBranchMapping(userSettings.branch, enrollment.course.branchMappings, inferredBatch);

        if (mapping?.courseCategory === "DC") {
          return "DC";
        }
      }

      return "FE";
    }

    // HS-xxx courses always go to HSS — but track cap for correct FE conversion
    if (normalizedCode.startsWith("HS")) return "HSS";

    // Hard overrides (batch-sensitive)
    if (normalizedCode === "IK593") return "HSS"; // IK-xxx → HSS+IKS
    if (normalizedCode === "IC181") return "HSS"; // → HSS+IKS
    if (normalizedCode === "IC182") return isBatch24Or25 ? "HSS" : "IC";

    if (enrollment.course?.branchMappings && enrollment.course.branchMappings.length > 0 && userSettings?.branch) {
      const mapping = pickRelevantBranchMapping(userSettings.branch, enrollment.course.branchMappings, inferredBatch);

      if (mapping?.courseCategory === "NA") {
        return "FE";
      }

      if (mapping && ["IC", "IC_BASKET", "DC", "DE", "FE", "HSS", "IKS", "MTP", "ISTP"].includes(mapping.courseCategory)) {
        // IKS-mapped / IK-xxx → HSS+IKS combined basket.
        if (mapping.courseCategory === "IKS") {
          return "HSS";
        }
        return applyMinorDeOverride(mapping.courseCategory as keyof typeof categoryLabels);
      }

      // Mappings exist but none matched this student's branch → FE
      return "FE";
    }

    if (isIkCourse) return "HSS"; // IK-xxx → HSS+IKS basket, no cap consumed

    // Branch-specific course patterns
    if (userSettings?.branch === "CSE" && normalizedCode.startsWith("DS")) return applyMinorDeOverride("DE");
    if (isDataScienceBranch(userSettings?.branch) && (normalizedCode.startsWith("DS") || normalizedCode.startsWith("CS"))) return applyMinorDeOverride("DE");

    if (normalizedCode.startsWith("IC")) return "IC";

    const specialDpCategory = getSpecialDpCategory(normalizedCode);
    if (specialDpCategory) return specialDpCategory;

    if (enrollment.courseType === "MTP") return "MTP";
    if (enrollment.courseType === "ISTP") return "ISTP";
    if (enrollment.courseType === "DE") return applyMinorDeOverride("DE");
    if (enrollment.courseType === "FREE_ELECTIVE" || enrollment.courseType === "PE") return "FE";
    if (enrollment.courseType === "CORE") return "DC";
    return "FE";
  };

  // All course categorization is O(enrollments) with stateful IC-basket/HSS
  // accumulators. It's pure over (enrollments, userSettings, minor overrides),
  // so memoize it — otherwise every background refetch or minor-planner storage
  // event re-runs the whole categorization on the main thread, hurting INP/LCP
  // on mobile. getCourseCategory closes over the same inputs listed as deps.
  const {
    currentSemesterCourses,
    currentSemesterBreakdown,
    currentSemesterTotalCredits,
    semesterStatsList,
  } = useMemo(() => {
    const activeEnrollmentsForCategory = allEnrollments.filter(
      (e: any) =>
        (e.status === "COMPLETED" && (!e.grade || e.grade !== "F")) ||
        e.status === "IN_PROGRESS"
    );

    const sortedActiveEnrollments = [...activeEnrollmentsForCategory].sort(compareEnrollments);
    const icBasketUsedForCategory = { ic1: false, ic2: false };
    const hssIksUsedForCategory = { credits: 0 };
    const categorizedById = new Map<
      string,
      { category: DashboardCategory; creditAllocations: CreditAllocation[] }
    >();

    sortedActiveEnrollments.forEach((e: any) => {
      const category = getCourseCategory(e, icBasketUsedForCategory);
      const credits = Number(e.course?.credits || 0);
      let creditAllocations: CreditAllocation[] = [{ category, credits }];

      if (category === "HSS") {
        const before = hssIksUsedForCategory.credits;
        const { hss, fe, notInDegree } = splitHssIksCredits(before, credits, hssCoreCap);
        creditAllocations = [];
        if (hss > 0) creditAllocations.push({ category: "HSS", credits: hss });
        if (fe > 0) creditAllocations.push({ category: "FE", credits: fe });
        if (notInDegree > 0) {
          creditAllocations.push({ category: "NOT_IN_DEGREE", credits: notInDegree });
        }
        hssIksUsedForCategory.credits = addCredits(before, hss, fe);
      }

      categorizedById.set(e.id, {
        category: creditAllocations[0]?.category ?? category,
        creditAllocations,
      });
    });

    const curSemCourses = currentSemesterEnrollments
      .map((e: any) => {
        const categorized = categorizedById.get(e.id);
        const fallbackCategory = getCourseCategory(e);
        return {
          ...e,
          category: categorized?.category ?? fallbackCategory,
          creditAllocations: categorized?.creditAllocations ?? [
            { category: fallbackCategory, credits: Number(e.course?.credits || 0) },
          ],
        };
      })
      .sort(compareEnrollments);

    const curSemBreakdown = curSemCourses.reduce(
      (acc: Record<string, { credits: number; count: number }>, e: any) => {
        for (const allocation of e.creditAllocations as CreditAllocation[]) {
          const existing = acc[allocation.category] || { credits: 0, count: 0 };
          acc[allocation.category] = {
            credits: addCredits(existing.credits, allocation.credits),
            count: existing.count + 1,
          };
        }
        return acc;
      },
      {}
    );

    const curSemTotalCredits = sumCredits(
      curSemCourses.map((e: any) => e.course?.credits || 0)
    );

    const semesterStats = sortedEnrollments.reduce((acc: Record<number, any>, e: any) => {
      const sem = e.semester || 0;
      if (!acc[sem]) {
        acc[sem] = {
          semester: sem,
          total: 0,
          IC: 0,
          IC_BASKET: 0,
          DC: 0,
          DE: 0,
          FE: 0,
          HSS: 0,
          IKS: 0,
          NOT_IN_DEGREE: 0,
          MTP: 0,
          ISTP: 0,
        };
      }
      const categorized = categorizedById.get(e.id);
      const allocations = categorized?.creditAllocations ?? [];
      allocations.forEach((allocation) => {
        acc[sem][allocation.category] = addCredits(
          acc[sem][allocation.category] || 0,
          allocation.credits
        );
      });
      acc[sem].total = addCredits(acc[sem].total, e.course?.credits || 0);
      return acc;
    }, {});

    const semStatsList = Object.values(semesterStats).sort(
      (a: any, b: any) => a.semester - b.semester
    );

    return {
      currentSemesterCourses: curSemCourses,
      currentSemesterBreakdown: curSemBreakdown,
      currentSemesterTotalCredits: curSemTotalCredits,
      semesterStatsList: semStatsList,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEnrollments, userSettings, nonMgmtMinorCourseCodes, mappingBranchAliases, currentSemester]);

  return (
    <div className="space-y-6">

      {/* B24 GE: prompt to choose specialization (still on plain "GE") */}
      {userSettings?.batch === 2024 && userSettings?.branch === "GE" && (
        <div className="flex items-start gap-3 border border-warning/30 bg-warning/10 p-4 sm:p-5">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Choose your General Engineering specialization
            </p>
            <p className="text-sm text-foreground-secondary mt-1">
              Pick AI &amp; Robotics, Mechatronics &amp; AI, Communications Technology, or stay on
              Open Specialization. This sets your Discipline Core / Elective tracking — you can
              change it later.
            </p>
            <Link
              href="/dashboard/settings"
              className="inline-block mt-2 text-sm font-medium text-primary hover:underline"
            >
              Set specialization →
            </Link>
          </div>
        </div>
      )}

      {/* Current Semester */}
      <section className="border border-border bg-surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-3 sm:mb-5">
          <h3 className="text-base sm:text-lg font-semibold text-foreground">
            Current Semester (In Progress)
          </h3>
        </div>

        {enrollmentsLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-background-secondary dark:bg-background rounded w-1/3"></div>
            <div className="h-10 bg-background-secondary dark:bg-background rounded"></div>
            <div className="h-10 bg-background-secondary dark:bg-background rounded"></div>
          </div>
        ) : currentSemesterCourses.length === 0 ? (
          <div className="text-center py-6">
            <AlertCircle className="mx-auto mb-3 h-6 w-6 text-warning" />
            <p className="text-foreground font-semibold mb-1">No active courses found</p>
            <p className="text-sm text-foreground-secondary">
              Add courses in <span className="font-semibold text-foreground">My Courses</span> to see this semester&apos;s plan.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-sm text-foreground-secondary">
                Semester <span className="font-semibold text-foreground">{currentSemester}</span> •{" "}
                <span className="font-semibold text-foreground">{currentSemesterCourses.length}</span> courses •{" "}
                <span className="font-semibold text-foreground">{formatCredits(currentSemesterTotalCredits)}</span> credits
              </p>
              <a
                href="/dashboard/progress"
                className="text-sm font-semibold text-primary hover:text-primary-hover transition-colors"
              >
                View full progress →
              </a>
            </div>

            <div className="flex flex-wrap gap-2 min-w-0">
              {(Object.keys(categoryLabels) as (keyof typeof categoryLabels)[])
                .filter((key) => (currentSemesterBreakdown[key]?.count || 0) > 0)
                .map((key) => {
                  const meta = currentSemesterBreakdown[key];
                  const colors = categoryColors[key];
                  return (
                    <span
                      key={key}
                      title={categoryLabels[key]}
                      className={`inline-flex max-w-full items-center gap-2 border border-border px-2 py-1 ${colors.bg}`}
                    >
                      <span className={`font-semibold text-xs ${colors.text} truncate`}>{key}</span>
                      <span className="text-xs text-foreground-secondary whitespace-nowrap">
                        {formatCredits(meta.credits)}cr ({meta.count})
                      </span>
                    </span>
                  );
                })}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[640px] w-full text-sm">
                <thead className="text-foreground-secondary">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 text-left whitespace-nowrap">Code</th>
                    <th className="py-2 pr-4 text-left min-w-[16rem]">Course</th>
                    <th className="py-2 pr-4 text-right whitespace-nowrap">Credits</th>
                    <th className="py-2 text-left whitespace-nowrap">Counts As</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSemesterCourses.map((e: any) => {
                    const allocations = e.creditAllocations as CreditAllocation[];
                    return (
                      <tr key={e.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-4 font-semibold text-foreground whitespace-nowrap">
                          {formatCourseCode(e.course?.code)}
                        </td>
                        <td className="py-2 pr-4 text-foreground-secondary">
                          {e.course?.name}
                        </td>
                        <td className="py-2 pr-4 text-right text-foreground whitespace-nowrap">
                          {formatCredits(e.course?.credits || 0)}
                        </td>
                        <td className="py-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 flex-wrap">
                            {allocations.map((allocation) => {
                              const colors = categoryColors[allocation.category];
                              return (
                                <span
                                  key={`${allocation.category}-${allocation.credits}`}
                                  className={`inline-flex items-center gap-1 border border-border px-2 py-1 ${colors.bg}`}
                                >
                                  <span className={`font-semibold ${colors.text}`}>
                                    {categoryLabels[allocation.category]}
                                  </span>
                                  <span className="text-xs text-foreground-secondary">
                                    ({formatCredits(allocation.credits)})
                                  </span>
                                </span>
                              );
                            })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {enrollmentsLoading ? (
        <div className="animate-pulse border border-border bg-surface p-4 sm:p-5">
          <div className="h-6 bg-background-secondary dark:bg-background rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border bg-surface-hover p-4">
                <div className="h-4 bg-background-secondary dark:bg-background rounded w-1/2 mb-2"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-background-secondary dark:bg-background rounded w-1/3"></div>
                  <div className="h-3 bg-background-secondary dark:bg-background rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : semesterStatsList.length > 0 ? (
      <section className="border border-border bg-surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-3 sm:mb-5">
          <h3 className="text-base sm:text-lg font-semibold text-foreground">
            Semester-wise Credits (Completed)
          </h3>
        </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {semesterStatsList.map((sem: any) => (
              <div
                key={sem.semester}
                className="border border-border bg-surface-hover p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-foreground">Semester {sem.semester}</p>
                  <span className="text-sm font-semibold text-primary">
                    {formatCredits(subtractCredits(sem.total, sem.NOT_IN_DEGREE))}
                    {sem.NOT_IN_DEGREE > 0 && (
                      <span className="text-foreground-muted font-normal"> +{formatCredits(sem.NOT_IN_DEGREE)}</span>
                    )}
                    {" "}credits
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-foreground-secondary">
                  <span>IC: {sem.IC}</span>
                  <span>IC Basket: {sem.IC_BASKET}</span>
                  <span>DC: {sem.DC}</span>
                  <span>DE: {sem.DE}</span>
                  <span>FE: {sem.FE}</span>
                  {(sem.HSS + sem.IKS > 0) && <span>HSS+IKS: {addCredits(sem.HSS, sem.IKS)}</span>}
                  {sem.NOT_IN_DEGREE > 0 && <span>Not in Degree: {sem.NOT_IN_DEGREE}</span>}
                  {(sem.MTP > 0 || sem.ISTP > 0) && (
                    <>
                      {sem.MTP > 0 && <span>MTP: {sem.MTP}</span>}
                      {sem.ISTP > 0 && <span>ISTP: {sem.ISTP}</span>}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
      </section>
      ) : null}

    </div>
  );
}
