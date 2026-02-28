"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, TrendingUp, AlertCircle } from "lucide-react";
import { formatCourseCode } from "@/lib/utils";

interface DashboardOverviewProps {
  userId: string;
}

const ICB1_CODES = new Set(["IC131", "IC136", "IC230"]);
const ICB2_CODES = new Set(["IC121", "IC240", "IC241", "IC253"]);

const IC_BASKET_COMPULSIONS: Record<string, { ic1?: string; ic2?: string }> = {
  BIO: { ic1: "IC136", ic2: "IC240" },
  CE: { ic1: "IC230", ic2: "IC240" },
  CS: { ic2: "IC253" },
  CSE: { ic2: "IC253" },
  DSE: { ic2: "IC253" },
  EP: { ic1: "IC230", ic2: "IC121" },
  ME: { ic2: "IC240" },
  CH: { ic1: "IC131", ic2: "IC121" },
  MNC: { ic1: "IC136", ic2: "IC253" },
  MS: { ic1: "IC131", ic2: "IC240" },
  GE: { ic1: "IC230", ic2: "IC240" },
  EE: {},
  VLSI: {},
};

const categoryLabels = {
  IC: "Institute Core",
  IC_BASKET: "IC Basket",
  DC: "Discipline Core",
  DE: "Discipline Elective",
  FE: "Free Elective",
  HSS: "HSS",
  IKS: "IKS",
  MTP: "MTP",
  ISTP: "ISTP",
} as const;

const categoryColors: Record<keyof typeof categoryLabels, { bg: string; text: string }> = {
  IC: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  IC_BASKET: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400" },
  DC: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400" },
  DE: { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400" },
  FE: { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400" },
  HSS: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400" },
  IKS: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  MTP: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400" },
  ISTP: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400" },
};

export function DashboardOverview({ userId }: DashboardOverviewProps) {
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["enrollments", userId],
    queryFn: async () => {
      const res = await fetch("/api/enrollments");
      if (!res.ok) throw new Error("Failed to fetch enrollments");
      return res.json();
    },
  });

  const { data: userSettings } = useQuery({
    queryKey: ["user-settings"],
    queryFn: async () => {
      const res = await fetch("/api/user/settings");
      if (!res.ok) throw new Error("Failed to fetch user settings");
      return res.json();
    },
  });

  const allEnrollments = enrollments || [];

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
    latestInProgressSemester > 0
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

  const getCourseCategory = (
    enrollment: any,
    icBasketUsed?: { ic1: boolean; ic2: boolean }
  ): keyof typeof categoryLabels => {
    const code = enrollment.course?.code?.toUpperCase() || "";
    const normalizedCode = normalizeCourseCode(code);
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);

    // IC Basket compulsion logic - check BEFORE branchMappings
    if ((isICB1 || isICB2) && userSettings?.branch) {
      const branchCompulsion = IC_BASKET_COMPULSIONS[userSettings.branch] || {};
      
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
      
      return "FE";
    }

    if (enrollment.course?.branchMappings && enrollment.course.branchMappings.length > 0 && userSettings?.branch) {
      const mappingBranch = userSettings.branch === "CSE" ? "CS" : userSettings.branch;
      const mapping = enrollment.course.branchMappings.find(
        (m: any) => m.branch === mappingBranch || m.branch === "COMMON"
      ) || (userSettings.branch === "GE"
        ? enrollment.course.branchMappings.find((m: any) => m.branch.startsWith("GE"))
        : undefined);

      if (mapping?.courseCategory === "NA") {
        return "FE";
      }

      if (mapping && ["IC", "IC_BASKET", "DC", "DE", "FE", "HSS", "IKS", "MTP", "ISTP"].includes(mapping.courseCategory)) {
        return mapping.courseCategory as keyof typeof categoryLabels;
      }
    }

    // Branch-specific course patterns
    if (userSettings?.branch === "CSE" && normalizedCode.startsWith("DS")) return "DE";
    if (userSettings?.branch === "DSE" && (normalizedCode.startsWith("DS") || normalizedCode.startsWith("CS"))) return "DE";

    if (normalizedCode === "IC181") return "IKS";
    if (normalizedCode.startsWith("IC")) return "IC";
    if (normalizedCode.startsWith("HS")) return "HSS";
    if (normalizedCode.startsWith("IKS") || normalizedCode.startsWith("IK")) return "IKS";

    // Special DP codes (ISTP/MTP don't contain "ISTP"/"MTP" in the code)
    if (normalizedCode === "DP301P") return "ISTP";
    if (normalizedCode === "DP498P" || normalizedCode === "DP499P") return "MTP";
    if (normalizedCode.includes("MTP")) return "MTP";
    if (normalizedCode.includes("ISTP")) return "ISTP";

    if (enrollment.courseType === "MTP") return "MTP";
    if (enrollment.courseType === "ISTP") return "ISTP";
    if (enrollment.courseType === "DE") return "DE";
    if (enrollment.courseType === "FREE_ELECTIVE" || enrollment.courseType === "PE") return "FE";
    return "DC";
  };

  const activeEnrollmentsForCategory = allEnrollments.filter(
    (e: any) =>
      (e.status === "COMPLETED" && (!e.grade || e.grade !== "F")) ||
      e.status === "IN_PROGRESS"
  );

  const sortedActiveEnrollments = [...activeEnrollmentsForCategory].sort(compareEnrollments);
  const icBasketUsedForCategory = { ic1: false, ic2: false };
  const categorizedById = new Map<string, keyof typeof categoryLabels>();

  sortedActiveEnrollments.forEach((e: any) => {
    categorizedById.set(e.id, getCourseCategory(e, icBasketUsedForCategory));
  });

  const currentSemesterCourses = currentSemesterEnrollments
    .map((e: any) => ({
      ...e,
      category: categorizedById.get(e.id) || getCourseCategory(e),
    }))
    .sort(compareEnrollments);

  const currentSemesterBreakdown = currentSemesterCourses.reduce(
    (acc: Record<string, { credits: number; count: number }>, e: any) => {
      const category = e.category as keyof typeof categoryLabels;
      const credits = e.course?.credits || 0;
      const existing = acc[category] || { credits: 0, count: 0 };
      acc[category] = { credits: existing.credits + credits, count: existing.count + 1 };
      return acc;
    },
    {}
  );

  const currentSemesterTotalCredits = currentSemesterCourses.reduce(
    (sum: number, e: any) => sum + (e.course?.credits || 0),
    0
  );

  const icBasketUsedForSemesterStats = { ic1: false, ic2: false };

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
        MTP: 0,
        ISTP: 0,
      };
    }
    const category = getCourseCategory(e, icBasketUsedForSemesterStats);
    acc[sem][category] = (acc[sem][category] || 0) + (e.course?.credits || 0);
    acc[sem].total += e.course?.credits || 0;
    return acc;
  }, {});

  const semesterStatsList = Object.values(semesterStats).sort(
    (a: any, b: any) => a.semester - b.semester
  );

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="relative overflow-hidden bg-surface rounded-xl shadow-sm border border-border p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-primary/10 rounded-full blur-2xl"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-foreground-secondary font-medium mb-1">Current Semester</p>
              <p className="text-3xl sm:text-4xl font-bold text-primary">
                {currentSemester}
              </p>
            </div>
            <div className="w-11 h-11 sm:w-14 sm:h-14 bg-primary/10 dark:bg-primary/20 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-surface rounded-xl shadow-sm border border-border p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-success/10 rounded-full blur-2xl"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-foreground-secondary font-medium mb-1">This Semester</p>
              <p className="text-3xl sm:text-4xl font-bold text-success">
                {currentSemesterEnrollments?.length || 0}
              </p>
            </div>
            <div className="w-11 h-11 sm:w-14 sm:h-14 bg-success/10 dark:bg-success/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 sm:w-7 sm:h-7 text-success" />
            </div>
          </div>
          <p className="text-xs text-foreground-secondary mt-2">Active courses</p>
        </div>

        <div className="relative overflow-hidden bg-surface rounded-xl shadow-sm border border-border p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-info/10 rounded-full blur-2xl"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-foreground-secondary font-medium mb-1">Completed</p>
              <p className="text-3xl sm:text-4xl font-bold text-info">
                {completedCourses?.length || 0}
              </p>
            </div>
            <div className="w-11 h-11 sm:w-14 sm:h-14 bg-info/10 dark:bg-info/20 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 sm:w-7 sm:h-7 text-info" />
            </div>
          </div>
          <p className="text-xs text-foreground-secondary mt-2">Total courses</p>
        </div>
      </div>

      {/* Current Semester */}
      <div className="bg-surface rounded-xl shadow-sm border border-border p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4 flex items-center">
          <span className="w-1 h-6 bg-primary rounded-full mr-3"></span>
          Current Semester (In Progress)
        </h3>

        {enrollmentsLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-background-secondary dark:bg-background rounded w-1/3"></div>
            <div className="h-10 bg-background-secondary dark:bg-background rounded"></div>
            <div className="h-10 bg-background-secondary dark:bg-background rounded"></div>
          </div>
        ) : currentSemesterCourses.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-warning/10 dark:bg-warning/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-warning" />
            </div>
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
                <span className="font-semibold text-foreground">{currentSemesterTotalCredits}</span> credits
              </p>
              <a
                href="/dashboard/progress"
                className="text-sm font-semibold text-primary hover:text-primary-hover transition-colors"
              >
                View full progress →
              </a>
            </div>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(categoryLabels) as (keyof typeof categoryLabels)[])
                .filter((key) => (currentSemesterBreakdown[key]?.count || 0) > 0)
                .map((key) => {
                  const meta = currentSemesterBreakdown[key];
                  const colors = categoryColors[key];
                  return (
                    <span
                      key={key}
                      title={categoryLabels[key]}
                      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-border ${colors.bg}`}
                    >
                      <span className={`font-semibold text-xs ${colors.text}`}>{key}</span>
                      <span className="text-xs text-foreground-secondary">
                        {meta.credits}cr ({meta.count})
                      </span>
                    </span>
                  );
                })}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
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
                    const category = e.category as keyof typeof categoryLabels;
                    const colors = categoryColors[category];
                    return (
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
                          <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-border ${colors.bg}`}>
                            <span className={`font-semibold ${colors.text}`}>
                              {categoryLabels[category]}
                            </span>
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
      </div>

      {enrollmentsLoading ? (
        <div className="bg-surface rounded-xl shadow-sm border border-border p-4 sm:p-6 animate-pulse">
          <div className="h-6 bg-background-secondary dark:bg-background rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border rounded-lg p-4 bg-surface-hover">
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
        <div className="bg-surface rounded-xl shadow-sm border border-border p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4 flex items-center">
            <span className="w-1 h-6 bg-primary rounded-full mr-3"></span>
            Semester-wise Credits (Completed)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {semesterStatsList.map((sem: any) => (
              <div
                key={sem.semester}
                className="border border-border rounded-lg p-4 bg-surface-hover"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-foreground">Semester {sem.semester}</p>
                  <span className="text-sm font-semibold text-primary">{sem.total} credits</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-foreground-secondary">
                  <span>IC: {sem.IC}</span>
                  <span>IC Basket: {sem.IC_BASKET}</span>
                  <span>DC: {sem.DC}</span>
                  <span>DE: {sem.DE}</span>
                  <span>FE: {sem.FE}</span>
                  <span>HSS: {sem.HSS}</span>
                  <span>IKS: {sem.IKS}</span>
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
        </div>
      ) : null}

    </div>
  );
}
