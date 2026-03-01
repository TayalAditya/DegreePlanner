"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { getAllDefaultCourses, type DefaultCourse } from "@/lib/defaultCurriculum";
import { formatCourseCode } from "@/lib/utils";

interface ProgressChartProps {
  progress: any;
  isLoading: boolean;
  enrollments?: any[];
  userBranch?: string;
}

const COLORS = {
  IC: "#3b82f6", // blue
  IC_BASKET: "#22d3ee", // cyan
  DC: "#a855f7", // purple
  DE: "#ec4899", // pink
  FE: "#10b981", // green
  HSS: "#f97316", // orange
  IKS: "#f59e0b", // amber
  MTP: "#ef4444", // red
  ISTP: "#14b8a6", // teal
  core: "#4f46e5", // indigo
  de: "#06b6d4", // cyan
  pe: "#8b5cf6", // purple
  freeElective: "#10b981", // emerald
  mtp: "#f59e0b", // amber
  istp: "#ef4444", // red
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

const normalizeCourseCode = (code: string) =>
  String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const normalizeBranchForIcBasket = (branch?: string) => {
  const upper = String(branch || "").toUpperCase();
  if (upper === "BE") return "BIO";
  if (upper === "MSE") return "MS";
  if (upper === "MEVLSI" || upper === "VL") return "VLSI";
  return upper;
};

const INCLUDE_CURRENT_SEM_KEY = "degreePlanner.progress.includeCurrentSemesterCredits";

export function ProgressChart({ progress, isLoading, enrollments, userBranch }: ProgressChartProps) {
  const includeCurrentSemesterCredits = useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => {};
      const onStorage = (e: StorageEvent) => {
        if (e.key === INCLUDE_CURRENT_SEM_KEY) callback();
      };
      const onLocal = () => callback();
      window.addEventListener("storage", onStorage);
      window.addEventListener("degreePlanner:storage", onLocal);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("degreePlanner:storage", onLocal);
      };
    },
    () => {
      if (typeof window === "undefined") return false;
      try {
        return localStorage.getItem(INCLUDE_CURRENT_SEM_KEY) === "true";
      } catch {
        return false;
      }
    },
    () => false
  );

  const setIncludeCurrentSemesterCredits = (next: boolean | ((prev: boolean) => boolean)) => {
    const nextValue = typeof next === "function"
      ? next(includeCurrentSemesterCredits)
      : next;

    try {
      localStorage.setItem(INCLUDE_CURRENT_SEM_KEY, String(nextValue));
    } catch {
      // ignore
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("degreePlanner:storage"));
    }
  };
  const [remainingOpen, setRemainingOpen] = useState(false);

  const totals = useMemo(() => {
    const requiredTotal = Number(progress?.required?.total || 0);
    const completedTotal = Number(progress?.completed?.total || 0);
    const inProgressTotal = Number(progress?.inProgress?.total || 0);

    const countedTotal = Math.min(
      requiredTotal,
      completedTotal + (includeCurrentSemesterCredits ? inProgressTotal : 0)
    );

    const remainingTotal = Math.max(0, requiredTotal - countedTotal);
    const percentage =
      requiredTotal > 0 ? Math.round((countedTotal / requiredTotal) * 100) : 0;

    return {
      requiredTotal,
      completedTotal,
      inProgressTotal,
      countedTotal,
      remainingTotal,
      percentage,
    };
  }, [progress, includeCurrentSemesterCredits]);

  const categoryCredits: Record<string, number> = {
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

  const getCourseCategory = (enrollment: any, icBasketUsed?: any, branch?: string): keyof typeof categoryCredits => {
    const code = enrollment.course?.code?.toUpperCase() || "";
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);

    // IC Basket compulsion logic - check BEFORE branchMappings
    if ((isICB1 || isICB2) && (branch || userBranch)) {
      const checkBranch = normalizeBranchForIcBasket((branch || userBranch) as string);
      const branchCompulsion = IC_BASKET_COMPULSIONS[checkBranch] || {};
      
      // Check if this course matches branch's IC-I compulsion
      if (isICB1 && branchCompulsion.ic1 && normalizedCode === branchCompulsion.ic1.replace(/[^A-Z0-9]/g, "")) {
        return "IC_BASKET";
      }
      
      // Check if this course matches branch's IC-II compulsion
      if (isICB2 && branchCompulsion.ic2 && normalizedCode === branchCompulsion.ic2.replace(/[^A-Z0-9]/g, "")) {
        return "IC_BASKET";
      }
      
      // No compulsion for this basket type - first course counts as IC_BASKET
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
      
      // Additional IC basket courses → FE
      return "FE";
    }

    // HS-xxx courses always go to HSS — never let branch mapping override
    if (normalizedCode.startsWith("HS")) return "HSS";

    const mappings = enrollment.course?.branchMappings || [];
    if (mappings.length > 0) {
      const branchAliases = userBranch === "CSE" ? ["CSE", "CS"] : userBranch === "CS" ? ["CS", "CSE"] : [userBranch];
      const mapping = mappings.find((m: any) => branchAliases.includes(m.branch) || m.branch === "COMMON")
        || (userBranch === "GE"
          ? mappings.find((m: any) => m.branch?.startsWith("GE"))
          : undefined);

      if (mapping && mapping.courseCategory in categoryCredits) {
        return mapping.courseCategory as keyof typeof categoryCredits;
      }

      if (mapping?.courseCategory === "NA") {
        return "FE";
      }
    }

    if (normalizedCode === "IC181") return "IKS";
    if (normalizedCode.startsWith("IC")) return "IC";
    if (normalizedCode.startsWith("HS")) return "HSS";
    if (normalizedCode.startsWith("IKS") || normalizedCode.startsWith("IK")) return "IKS";

    // Special DP codes (ISTP/MTP don't contain "ISTP"/"MTP" in the code)
    if (normalizedCode === "DP301P") return "ISTP";
    if (normalizedCode === "DP498P" || normalizedCode === "DP499P") return "MTP";
    if (normalizedCode.includes("MTP")) return "MTP";
    if (normalizedCode.includes("ISTP")) return "ISTP";
    
    // Check courseType AFTER branchMappings
    if (enrollment.courseType === "DE") return "DE";
    if (enrollment.courseType === "FREE_ELECTIVE" || enrollment.courseType === "PE") return "FE";
    
    // Branch-specific course patterns (only if no explicit courseType)
    if (userBranch === "CSE" && (code.startsWith("DS") || code.startsWith("CS"))) return "DE";
    if (userBranch === "DSE" && (code.startsWith("DS") || code.startsWith("CS"))) return "DE";

    return "DC";
  };

  const completedCodes = useMemo(() => {
    const set = new Set<string>();
    (enrollments || []).forEach((e: any) => {
      if (e?.status === "COMPLETED" && (!e?.grade || e.grade !== "F")) {
        set.add(normalizeCourseCode(e?.course?.code));
      }
    });
    return set;
  }, [enrollments]);

  const inProgressCodes = useMemo(() => {
    const set = new Set<string>();
    (enrollments || []).forEach((e: any) => {
      if (e?.status === "IN_PROGRESS") {
        set.add(normalizeCourseCode(e?.course?.code));
      }
    });
    return set;
  }, [enrollments]);

  if (enrollments && enrollments.length > 0) {
    const shouldCount = (e: any) => {
      if (e?.status === "COMPLETED") return !e?.grade || e.grade !== "F";
      if (includeCurrentSemesterCredits && e?.status === "IN_PROGRESS") return true;
      return false;
    };

    // Sort by semester to process in order
    const sortedEnrollments = [...enrollments]
      .filter(shouldCount)
      .sort((a: any, b: any) => (a.semester || 0) - (b.semester || 0));
    
    // Track which IC basket slots have been used
    const icBasketUsed = { ic1: false, ic2: false };

    sortedEnrollments.forEach((e: any) => {
      const category = getCourseCategory(e, icBasketUsed, userBranch);
      categoryCredits[category] += e.course?.credits || 0;
    });

    // DE overflow → FE: excess DE beyond requirement counts as Free Electives
    const requiredDE = Number(progress?.required?.de || 0);
    if (requiredDE > 0 && categoryCredits.DE > requiredDE) {
      const overflow = categoryCredits.DE - requiredDE;
      categoryCredits.DE -= overflow;
      categoryCredits.FE = (categoryCredits.FE || 0) + overflow;
    }
  }

  const categoryData = Object.entries(categoryCredits)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name,
      value,
      color: COLORS[name as keyof typeof COLORS],
    }));

  const data = categoryData.length > 0
    ? categoryData
    : [
        {
          name: "Core",
          value: Number(progress?.completed?.core || 0),
          total: Number(progress?.required?.core || 0),
          color: COLORS.core,
        },
        {
          name: "DE",
          value: Number(progress?.completed?.de || 0),
          total: Number(progress?.required?.de || 0),
          color: COLORS.de,
        },
        {
          name: "PE",
          value: Number(progress?.completed?.pe || 0),
          total: Number(progress?.required?.pe || 0),
          color: COLORS.pe,
        },
        {
          name: "Free Elective",
          value: Number(progress?.completed?.freeElective || 0),
          total: Number(progress?.required?.freeElective || 0),
          color: COLORS.freeElective,
        },
      ].filter((item) => item.total > 0);

  const remainingBreakdown = useMemo(() => {
    const required = progress?.required || {};
    const completed = progress?.completed || {};
    const inProgress = progress?.inProgress || {};

    const rows: Array<{
      key: string;
      label: string;
      required: number;
      completed: number;
      inProgress: number;
      counted: number;
      remaining: number;
    }> = [
      { key: "core", label: "Core (IC + DC)", required: required.core, completed: completed.core, inProgress: inProgress.core },
      { key: "de", label: "Discipline Electives (DE)", required: required.de, completed: completed.de, inProgress: inProgress.de },
      { key: "pe", label: "Program Electives / Research", required: required.pe, completed: completed.pe, inProgress: inProgress.pe },
      { key: "freeElective", label: "Free Electives (FE)", required: required.freeElective, completed: completed.freeElective, inProgress: inProgress.freeElective },
      { key: "mtp", label: "MTP", required: required.mtp, completed: completed.mtp, inProgress: inProgress.mtp },
      { key: "istp", label: "ISTP", required: required.istp, completed: completed.istp, inProgress: inProgress.istp },
    ]
      .map((r) => {
        const req = Number(r.required || 0);
        const comp = Number(r.completed || 0);
        const prog = Number(r.inProgress || 0);
        const counted = Math.min(req, comp + (includeCurrentSemesterCredits ? prog : 0));
        const remaining = Math.max(0, req - counted);
        return { ...r, required: req, completed: comp, inProgress: prog, counted, remaining };
      })
      .filter((r) => r.required > 0);

    return rows;
  }, [progress, includeCurrentSemesterCredits]);

  const pendingCourseSections = useMemo(() => {
    if (isLoading) {
      return { note: "Loading progress…", sections: [] as any[] };
    }
    if (!userBranch) {
      return { note: "Set your branch to see course-level remaining details.", sections: [] as any[] };
    }

    const branch = String(userBranch || "").toUpperCase();
    const requiredMtp = Number(progress?.required?.mtp || 0);
    const requiredIstp = Number(progress?.required?.istp || 0);

    const allDefault = getAllDefaultCourses(branch, 8);

    const byNormalized = <T extends DefaultCourse>(list: T[]) => {
      const map = new Map<string, T>();
      list.forEach((c) => {
        const norm = normalizeCourseCode(c.code);
        const existing = map.get(norm);
        if (!existing || (c.semester || 0) < (existing.semester || 0)) {
          map.set(norm, c);
        }
      });
      return Array.from(map.values()).sort((a, b) => (a.semester || 0) - (b.semester || 0));
    };

    const fixedIc = byNormalized(allDefault.filter((c) => c.category === "IC"));
    const fixedIks = byNormalized(allDefault.filter((c) => c.category === "IKS"));
    const fixedDc = byNormalized(allDefault.filter((c) => c.category === "DC"));

    const mtpCandidates = byNormalized(allDefault.filter((c) => c.category === "MTP"));
    const mtpRequiredCodes = (() => {
      if (requiredMtp <= 0) return new Set<string>();
      if (requiredMtp <= 3) return new Set(["DP498P"]);
      return new Set(["DP498P", "DP499P"]);
    })();
    const fixedMtp = mtpCandidates.filter((c) => mtpRequiredCodes.has(normalizeCourseCode(c.code)));

    const fixedIstp = requiredIstp > 0 ? byNormalized(allDefault.filter((c) => c.category === "ISTP")) : [];

    const classify = (courses: DefaultCourse[]) => {
      const pending: DefaultCourse[] = [];
      const inProg: DefaultCourse[] = [];

      courses.forEach((c) => {
        const norm = normalizeCourseCode(c.code);
        if (completedCodes.has(norm)) return;
        if (inProgressCodes.has(norm)) inProg.push(c);
        else pending.push(c);
      });

      return { pending, inProg };
    };

    const ic = classify(fixedIc);
    const iks = classify(fixedIks);
    const dc = classify(fixedDc);
    const mtp = classify(fixedMtp);
    const istp = classify(fixedIstp);

    return {
      note: "Course lists use the default B23 curriculum. Electives (DE/FE) are credit-based and may vary.",
      sections: [
        { id: "icbasket", title: "IC Basket", kind: "icbasket" as const },
        { id: "ic", title: "Institute Core (IC)", kind: "list" as const, ...ic },
        { id: "iks", title: "IKS", kind: "list" as const, ...iks },
        { id: "dc", title: "Discipline Core (DC)", kind: "list" as const, ...dc },
        ...(requiredIstp > 0 ? [{ id: "istp", title: "ISTP", kind: "list" as const, ...istp }] : []),
        ...(requiredMtp > 0 ? [{ id: "mtp", title: "MTP", kind: "list" as const, ...mtp }] : []),
      ],
    };
  }, [completedCodes, inProgressCodes, isLoading, progress, userBranch]);

  if (isLoading) {
    return (
      <div className="bg-surface dark:bg-surface rounded-lg border border-border p-6 animate-pulse">
        <div className="h-4 bg-background-secondary dark:bg-background rounded w-1/2 mb-4"></div>
        <div className="h-64 bg-background-secondary dark:bg-background rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-surface dark:bg-surface rounded-lg border border-border p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          {progress.programName} Progress
        </h3>
        <div className="flex items-center justify-between sm:justify-end gap-4">
          <span className="text-2xl font-bold text-primary">{totals.percentage}%</span>
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

      <div className="mb-4">
        <div className="flex justify-between text-sm text-foreground-secondary mb-2">
          <span>
            {totals.countedTotal} / {totals.requiredTotal} credits
            {includeCurrentSemesterCredits ? " (incl. current sem)" : ""}
          </span>
          <button
            type="button"
            onClick={() => setRemainingOpen((v) => !v)}
            className="font-semibold text-foreground hover:text-primary transition-colors"
          >
            {totals.remainingTotal} remaining
          </button>
        </div>
        <div className="w-full bg-background-secondary dark:bg-background rounded-full h-3">
          <div
            className="bg-primary h-3 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, totals.percentage)}%` }}
          ></div>
        </div>
      </div>

      {remainingOpen && (
        <div className="mb-4 rounded-lg border border-border bg-surface-hover/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Remaining breakdown</p>
              <p className="text-xs text-foreground-secondary mt-0.5">{pendingCourseSections.note}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-foreground-secondary rotate-180 flex-shrink-0" />
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {remainingBreakdown.map((r) => (
              <div key={r.key} className="rounded-lg border border-border bg-surface px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{r.label}</p>
                    <p className="text-foreground-secondary">
                      {r.counted} / {r.required} credits
                      {r.inProgress > 0 && includeCurrentSemesterCredits && (
                        <span className="text-yellow-600 dark:text-yellow-400"> (+{r.inProgress} in progress)</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-foreground-secondary">Remaining</p>
                    <p className="font-semibold text-foreground">{r.remaining}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {pendingCourseSections.sections.map((section: any) => (
              <details
                key={section.id}
                className="group rounded-lg border border-border bg-surface"
                open={section.kind === "icbasket"}
              >
                <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{section.title}</p>
                    {section.kind === "list" ? (
                      <p className="text-xs text-foreground-secondary">
                        {section.pending.length} pending
                        {section.inProg.length > 0 ? ` • ${section.inProg.length} in progress` : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-foreground-secondary">IC-I + IC-II basket status</p>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-foreground-secondary transition-transform duration-200 group-open:rotate-180" />
                </summary>

                <div className="px-3 pb-3">
                  {section.kind === "icbasket" ? (
                    <ICBasketStatus
                      branch={userBranch}
                      completedCodes={completedCodes}
                      inProgressCodes={inProgressCodes}
                      includeCurrentSemesterCredits={includeCurrentSemesterCredits}
                    />
                  ) : (
                    <CourseList
                      pending={section.pending}
                      inProgress={section.inProg}
                      showInProgress={true}
                      completedCodes={completedCodes}
                      inProgressCodes={inProgressCodes}
                    />
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {categoryData.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(categoryCredits).map(([key, value]) => (
            <span
              key={key}
              className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-surface-hover text-foreground-secondary"
            >
              {key}: {value}
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={70}
              innerRadius={40}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [`${value} credits`, name]} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "12px" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-foreground">{totals.percentage}%</span>
          <span className="text-xs text-foreground-secondary">
            {totals.countedTotal} / {totals.requiredTotal}
          </span>
        </div>
      </div>
    </div>
  );
}

function CourseList({
  pending,
  inProgress,
  showInProgress,
  completedCodes,
  inProgressCodes,
}: {
  pending: DefaultCourse[];
  inProgress: DefaultCourse[];
  showInProgress: boolean;
  completedCodes: Set<string>;
  inProgressCodes: Set<string>;
}) {
  const rows = [
    ...pending.map((c) => ({ ...c, status: "PENDING" as const })),
    ...(showInProgress ? inProgress.map((c) => ({ ...c, status: "IN_PROGRESS" as const })) : []),
  ];

  if (rows.length === 0) {
    return <p className="text-xs text-foreground-secondary">Nothing pending here.</p>;
  }

  const badge = (status: "PENDING" | "IN_PROGRESS" | "COMPLETED") => {
    if (status === "IN_PROGRESS") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-[11px] font-semibold">
          In progress
        </span>
      );
    }
    if (status === "COMPLETED") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 text-[11px] font-semibold">
          Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-400 text-[11px] font-semibold">
        Pending
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[640px] w-full text-xs">
        <thead className="text-foreground-secondary">
          <tr className="border-b border-border">
            <th className="py-2 pr-4 text-left whitespace-nowrap">Sem</th>
            <th className="py-2 pr-4 text-left whitespace-nowrap">Code</th>
            <th className="py-2 pr-4 text-left min-w-[18rem]">Course</th>
            <th className="py-2 pr-4 text-right whitespace-nowrap">Credits</th>
            <th className="py-2 text-left whitespace-nowrap">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const norm = normalizeCourseCode(c.code);
            const status = completedCodes.has(norm)
              ? ("COMPLETED" as const)
              : inProgressCodes.has(norm)
                ? ("IN_PROGRESS" as const)
                : ("PENDING" as const);

            return (
              <tr key={`${norm}|${c.semester}`} className="border-b border-border/60 last:border-0">
                <td className="py-2 pr-4 text-foreground whitespace-nowrap">{c.semester}</td>
                <td className="py-2 pr-4 font-semibold text-foreground whitespace-nowrap">
                  {formatCourseCode(c.code)}
                </td>
                <td className="py-2 pr-4 text-foreground-secondary">{c.name}</td>
                <td className="py-2 pr-4 text-right text-foreground whitespace-nowrap">{c.credits}</td>
                <td className="py-2 whitespace-nowrap">{badge(status)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ICBasketStatus({
  branch,
  completedCodes,
  inProgressCodes,
  includeCurrentSemesterCredits,
}: {
  branch?: string;
  completedCodes: Set<string>;
  inProgressCodes: Set<string>;
  includeCurrentSemesterCredits: boolean;
}) {
  const effectiveBranch = normalizeBranchForIcBasket(branch);
  const compulsion = IC_BASKET_COMPULSIONS[effectiveBranch] || {};

  const ICB1 = [
    { code: "IC-131", name: "Applied Chemistry for Engineers", credits: 3 },
    { code: "IC-136", name: "Understanding Biotechnology and its Applications", credits: 3 },
    { code: "IC-230", name: "Environmental Science", credits: 3 },
  ];

  const ICB2 = [
    { code: "IC-121", name: "Mechanics of Particles and Waves", credits: 3 },
    { code: "IC-240", name: "Mechanics of Rigid Bodies", credits: 3 },
    { code: "IC-241", name: "Material Science for Engineers", credits: 3 },
    { code: "IC-253", name: "Data Structures and Algorithms", credits: 3 },
  ];

  const statusFor = (codeNorm: string) => {
    if (completedCodes.has(codeNorm)) return "COMPLETED" as const;
    if (inProgressCodes.has(codeNorm)) return "IN_PROGRESS" as const;
    return "PENDING" as const;
  };

  const anyTakenFrom = (options: { code: string }[]) => {
    for (const opt of options) {
      const norm = normalizeCourseCode(opt.code);
      if (completedCodes.has(norm)) return { status: "COMPLETED" as const, code: opt.code };
      if (inProgressCodes.has(norm)) return { status: "IN_PROGRESS" as const, code: opt.code };
    }
    return { status: "PENDING" as const, code: null as string | null };
  };

  const slot = (
    title: string,
    compulsoryCode: string | undefined,
    options: { code: string; name: string; credits: number }[]
  ) => {
    const compulsoryNorm = compulsoryCode ? normalizeCourseCode(compulsoryCode) : null;

    const compulsoryStatus = compulsoryNorm ? statusFor(compulsoryNorm) : null;
    const filled = compulsoryNorm
      ? {
          status: compulsoryStatus || ("PENDING" as const),
          code: compulsoryStatus === "PENDING" ? null : compulsoryCode || null,
        }
      : anyTakenFrom(options);

    const isSatisfied =
      filled.status === "COMPLETED" || (includeCurrentSemesterCredits && filled.status === "IN_PROGRESS");

    return (
      <div className="rounded-lg border border-border bg-surface-hover/50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {compulsoryCode ? (
              <p className="text-xs text-foreground-secondary mt-0.5">
                Compulsory: <span className="font-semibold text-foreground">{formatCourseCode(compulsoryCode)}</span>
              </p>
            ) : (
              <p className="text-xs text-foreground-secondary mt-0.5">Pick any one course from the basket.</p>
            )}
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              isSatisfied
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-red-500/10 text-red-700 dark:text-red-400"
            }`}
          >
            {isSatisfied ? "Satisfied" : "Pending"}
          </span>
        </div>

        {!isSatisfied && (
          <div className="mt-2 text-xs text-foreground-secondary">
            {compulsoryCode ? (
              <p>
                Still needed: <span className="font-semibold text-foreground">{formatCourseCode(compulsoryCode)}</span>
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {options.map((o) => (
                  <div key={o.code} className="rounded-lg border border-border bg-surface px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{formatCourseCode(o.code)}</p>
                        <p className="text-foreground-secondary">{o.name}</p>
                      </div>
                      <p className="text-foreground font-semibold whitespace-nowrap">{o.credits} cr</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {filled.code && (
          <p className="mt-2 text-xs text-foreground-secondary">
            Detected: <span className="font-semibold text-foreground">{formatCourseCode(filled.code)}</span>{" "}
            {filled.status === "IN_PROGRESS" ? (
              <span className="text-yellow-600 dark:text-yellow-400">(in progress)</span>
            ) : null}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {slot("IC-I Basket", compulsion.ic1, ICB1)}
      {slot("IC-II Basket", compulsion.ic2, ICB2)}
      <p className="text-xs text-foreground-secondary">
        Note: Additional IC basket courses beyond your compulsory/first pick count as FE for progress.
      </p>
    </div>
  );
}
