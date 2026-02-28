"use client";

import { useEffect, useState } from "react";
import { CheckCircle, ChevronDown, Clock, Target } from "lucide-react";
import { formatCourseCode } from "@/lib/utils";

interface Enrollment {
  id: string;
  semester: number;
  year: number;
  courseType: string;
  status: string;
  grade?: string;
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

interface User {
  branch?: string;
  doingMTP?: boolean;
  doingISTP?: boolean;
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
    FE: number;
    HSS: number;
    IKS: number;
    MTP: number;
    ISTP: number;
  };
  semesterWiseCredits: { semester: number; credits: number }[];
}

// Color scheme for each category
const categoryColors = {
  IC: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", bar: "bg-blue-500" },
  IC_BASKET: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", bar: "bg-cyan-500" },
  DC: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", bar: "bg-purple-500" },
  DE: { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400", bar: "bg-pink-500" },
  FE: { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", bar: "bg-green-500" },
  HSS: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", bar: "bg-orange-500" },
  IKS: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  MTP: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", bar: "bg-red-500" },
  ISTP: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", bar: "bg-teal-500" },
};

const categoryLabels = {
  IC: "Institute Core",
  IC_BASKET: "IC Basket",
  DC: "Discipline Core",
  DE: "Discipline Electives",
  FE: "Free Electives",
  HSS: "Humanities & Social Sciences",
  IKS: "Indian Knowledge System",
  MTP: "Major Technical Project",
  ISTP: "Interactive Socio-Technical Practicum",
};

const ICB1_CODES = new Set([
  "IC131",
  "IC136",
  "IC230",
]);

const ICB2_CODES = new Set([
  "IC121",
  "IC240",
  "IC241",
  "IC253",
]);

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

export default function ProgressPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [totalCreditsRequired, setTotalCreditsRequired] = useState(160);
  const [programCredits, setProgramCredits] = useState<ProgramCredits>({});
  const [loading, setLoading] = useState(true);

  type CourseCategory = keyof typeof categoryLabels;
  type ICBasketUsed = { ic1: boolean; ic2: boolean };

  const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const getCourseCategory = (enrollment: Enrollment, icBasketUsed?: any): CourseCategory => {
    const code = enrollment.course.code.toUpperCase();
    const normalizedCode = normalizeCode(code);
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);

    // IC Basket compulsion logic - check BEFORE branchMappings
    if ((isICB1 || isICB2) && user?.branch) {
      const branchCompulsion = IC_BASKET_COMPULSIONS[user.branch] || {};
      
      if (isICB1 && branchCompulsion.ic1 && normalizedCode === branchCompulsion.ic1.replace(/[^A-Z0-9]/g, "")) {
        return "IC_BASKET";
      }
      
      if (isICB2 && branchCompulsion.ic2 && normalizedCode === branchCompulsion.ic2.replace(/[^A-Z0-9]/g, "")) {
        return "IC_BASKET";
      }
      
      // First course of each basket type counts as IC_BASKET (if not compulsory)
      if (icBasketUsed) {
        if (isICB1 && !icBasketUsed.ic1) {
          icBasketUsed.ic1 = true;
          return "IC_BASKET";
        }
        
        if (isICB2 && !icBasketUsed.ic2) {
          icBasketUsed.ic2 = true;
          return "IC_BASKET";
        }
      }
      
      return "FE";
    }

    if (enrollment.course.branchMappings && enrollment.course.branchMappings.length > 0 && user?.branch) {
      const mappingBranch = user.branch === "CSE" ? "CS" : user.branch;
      const mapping = enrollment.course.branchMappings.find(
        (m) => m.branch === mappingBranch || m.branch === "COMMON"
      ) || (user.branch === "GE"
        ? enrollment.course.branchMappings.find((m) => m.branch.startsWith("GE"))
        : undefined);

      if (mapping && mapping.courseCategory in categoryLabels) {
        return mapping.courseCategory as CourseCategory;
      }
    }

    if (user?.branch === "CSE" && code.startsWith("DS")) return "DE";
    if (user?.branch === "DSE" && (code.startsWith("DS") || code.startsWith("CS"))) return "DE";

    if (normalizedCode === "IC181") return "IKS";
    if (normalizedCode.startsWith("IC")) return "IC";
    if (normalizedCode.startsWith("HS")) return "HSS";
    if (normalizedCode.startsWith("IK")) return "IKS";
    if (normalizedCode.includes("MTP")) return "MTP";
    if (normalizedCode.includes("ISTP")) return "ISTP";

    switch (enrollment.courseType) {
      case "DE":
        return "DE";
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

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const [enrollmentsRes, programsRes, userRes] = await Promise.all([
        fetch("/api/enrollments"),
        fetch("/api/programs"),
        fetch("/api/user/settings"),
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
        }
      }
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
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

    const creditsByCategory = {
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

    const creditsInProgressByCategory = {
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

    sortedCompleted.forEach((e) => {
      const category = getCourseCategory(e, icBasketUsed);
      creditsByCategory[category] += e.course.credits;
    });

    sortedInProgress.forEach((e) => {
      const category = getCourseCategory(e, icBasketUsed);
      creditsInProgressByCategory[category] += e.course.credits;
    });

    const totalCreditsEarned = completedEnrollments.reduce(
      (sum, e) => sum + e.course.credits,
      0
    );

    const totalCreditsInProgress = inProgressEnrollments.reduce(
      (sum, e) => sum + e.course.credits,
      0
    );

    const icCredits = programCredits.icCredits ?? 60;
    const mtpIstpTotal = programCredits.mtpIstpCredits ?? 12;
    const icBasketRequired = 6;
    const hssRequired = 12;
    const iksRequired = 3;
    
    // Adjust MTP/ISTP based on user preferences
    let mtpRequired = 8;
    let istpRequired = 4;
    let deAdjustment = 0;  // DE credit adjustment when MTP/ISTP deselected
    let feAdjustment = 0;  // FE credit adjustment when ISTP deselected
    
    // If user deselected MTP, add 8 credits to DE
    if (user?.doingMTP === false) {
      mtpRequired = 0;
      deAdjustment = 8;
    }
    
    // If user deselected ISTP, add 4 credits to FE
    if (user?.doingISTP === false) {
      istpRequired = 0;
      feAdjustment = 4;
    }

    const creditsRequiredByCategory = {
      IC: Math.max(0, icCredits - icBasketRequired - hssRequired - iksRequired),
      IC_BASKET: icBasketRequired,
      DC: programCredits.dcCredits ?? 0,
      DE: (programCredits.deCredits ?? 0) + deAdjustment,
      FE: (programCredits.feCredits ?? 0) + feAdjustment,
      HSS: hssRequired,
      IKS: iksRequired,
      MTP: mtpRequired,
      ISTP: istpRequired,
    };

    // Group by semester
    const semesterMap = new Map<number, number>();
    completedEnrollments.forEach((e) => {
      const current = semesterMap.get(e.semester) || 0;
      semesterMap.set(e.semester, current + e.course.credits);
    });

    const semesterWiseCredits = Array.from(semesterMap.entries())
      .map(([semester, credits]) => ({ semester, credits }))
      .sort((a, b) => a.semester - b.semester);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const progress = calculateProgress();
  const activeEnrollments = enrollments.filter(
    (e) =>
      (e.status === "COMPLETED" && (!e.grade || e.grade !== "F")) ||
      e.status === "IN_PROGRESS"
  );

  const sortedActiveEnrollments = [...activeEnrollments].sort(
    (a, b) =>
      (a.semester || 0) - (b.semester || 0) ||
      normalizeCode(a.course.code).localeCompare(normalizeCode(b.course.code))
  );

  const icBasketUsedForDisplay: ICBasketUsed = { ic1: false, ic2: false };

  const semesterCourses = sortedActiveEnrollments
    .map((e) => ({
      id: e.id,
      semester: e.semester,
      code: formatCourseCode(e.course.code),
      name: e.course.name,
      credits: e.course.credits,
      status: e.status,
      grade: e.grade,
      category: getCourseCategory(e, icBasketUsedForDisplay),
    }))
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
  const completionPercentage = Math.round(
    (progress.totalCreditsEarned / progress.totalCreditsRequired) * 100
  );

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
              {progress.totalCreditsEarned} / {progress.totalCreditsRequired} credits completed
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl sm:text-4xl font-bold text-primary">{completionPercentage}%</p>
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
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-green-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-foreground-secondary">Completed</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground">
                {progress.totalCreditsEarned}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-3 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 sm:w-6 sm:h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-foreground-secondary">In Progress</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground">
                {progress.totalCreditsInProgress}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-3 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-orange-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-4 h-4 sm:w-6 sm:h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-foreground-secondary">Remaining</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground">
                {progress.totalCreditsRequired -
                  progress.totalCreditsEarned -
                  progress.totalCreditsInProgress}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Credits by Category */}
      <div className="bg-surface rounded-lg border border-border p-4 sm:p-6">
        <h3 className="text-base sm:text-xl font-semibold text-foreground mb-6">Credits by Category</h3>
        <div className="space-y-5">
          {Object.entries(progress.creditsByCategory).map(([category, credits]) => {
            const inProgress = progress.creditsInProgressByCategory[category as keyof typeof progress.creditsInProgressByCategory];
            const total = credits + inProgress;
            const colors = categoryColors[category as keyof typeof categoryColors];
            const label = categoryLabels[category as keyof typeof categoryLabels];
            const required = progress.creditsRequiredByCategory[category as keyof typeof progress.creditsRequiredByCategory];
            const denominator = required > 0 ? required : Math.max(total, 1);
            
            // Skip if no credits (0 completed and 0 in progress)
            if (total === 0) return null;
            
            return (
              <div key={category} className="group">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 mb-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-3 h-3 rounded-full ${colors.bar}`}></div>
                    <span className={`min-w-0 font-semibold ${colors.text} break-words`}>
                      {label}
                    </span>
                  </div>
                  <span className="text-foreground font-bold sm:text-right">
                    {credits} {inProgress > 0 && <span className="text-blue-500">(+{inProgress})</span>}
                  </span>
                </div>
                <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full ${colors.bar} rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${Math.min((total / denominator) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Show helpful message if no credits */}
        {Object.values(progress.creditsByCategory).every(v => v === 0) && 
         Object.values(progress.creditsInProgressByCategory).every(v => v === 0) && (
          <div className="text-center py-8 text-foreground-secondary">
            <p>No courses enrolled yet. Start adding courses to see your progress!</p>
          </div>
        )}
      </div>

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
              const completedCredits = courses
                .filter((c) => c.status === "COMPLETED")
                .reduce((sum, c) => sum + c.credits, 0);
              const inProgressCredits = courses
                .filter((c) => c.status === "IN_PROGRESS")
                .reduce((sum, c) => sum + c.credits, 0);
              const totalCredits = completedCredits + inProgressCredits;

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
                        {courses.length} courses • {completedCredits}
                        {inProgressCredits > 0 ? (
                          <span className="text-blue-500"> (+{inProgressCredits})</span>
                        ) : null}{" "}
                        credits{inProgressCredits > 0 ? ` • ${totalCredits} total` : ""}
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-foreground-secondary transition-transform duration-200 group-open:rotate-180" />
                  </summary>

                  <div className="px-4 pb-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-foreground-secondary">
                        <tr className="border-b border-border">
                          <th className="py-2 pr-4 text-left whitespace-nowrap">Code</th>
                          <th className="py-2 pr-4 text-left min-w-[16rem]">Course</th>
                          <th className="py-2 pr-4 text-right whitespace-nowrap">Credits</th>
                          <th className="py-2 pr-4 text-left whitespace-nowrap">Status</th>
                          <th className="py-2 text-left whitespace-nowrap">Counts As</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courses.map((c) => {
                          const colors = categoryColors[c.category as CourseCategory];
                          const label = categoryLabels[c.category as CourseCategory];
                          const statusBadge =
                            c.status === "COMPLETED"
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400";
                          const statusText =
                            c.status === "COMPLETED"
                              ? `Completed${c.grade ? ` (${c.grade})` : ""}`
                              : "In Progress";

                          return (
                            <tr key={c.id} className="border-b border-border/60 last:border-0">
                              <td className="py-2 pr-4 font-semibold text-foreground whitespace-nowrap">
                                {c.code}
                              </td>
                              <td className="py-2 pr-4 text-foreground-secondary">
                                {c.name}
                              </td>
                              <td className="py-2 pr-4 text-right text-foreground whitespace-nowrap">
                                {c.credits}
                              </td>
                              <td className="py-2 pr-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full ${statusBadge}`}>
                                  <span className="font-semibold">{statusText}</span>
                                </span>
                              </td>
                              <td className="py-2 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-border ${colors.bg}`}>
                                  <span className={`font-semibold ${colors.text}`}>{label}</span>
                                </span>
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
            {progress.semesterWiseCredits.map(({ semester, credits }) => (
              <div
                key={semester}
                className="bg-primary/10 rounded-lg p-4 text-center border border-primary/20"
              >
                <p className="text-sm text-foreground-secondary mb-1">Sem {semester}</p>
                <p className="text-2xl font-bold text-primary">{credits}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
