"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

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

export function ProgressChart({ progress, isLoading, enrollments, userBranch }: ProgressChartProps) {
  if (isLoading) {
    return (
      <div className="bg-surface dark:bg-surface rounded-lg border border-border p-6 animate-pulse">
        <div className="h-4 bg-background-secondary dark:bg-background rounded w-1/2 mb-4"></div>
        <div className="h-64 bg-background-secondary dark:bg-background rounded"></div>
      </div>
    );
  }

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

  const getCourseCategory = (enrollment: any): keyof typeof categoryCredits => {
    const code = enrollment.course?.code?.toUpperCase() || "";
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);

    // Branch-specific basket rules
    if (userBranch) {
      // Sem 1: ICB1 is compulsory. If ICB2 taken → FE
      if ((enrollment.semester || 0) === 1 && isICB2) return "FE";
      
      // Sem 2: Branch-specific
      if ((enrollment.semester || 0) === 2) {
        if (userBranch === "CSE") {
          // CSE Sem 2: IC253 (DSA) is compulsory. Other ICB2 → FE
          if (isICB2 && normalizedCode !== "IC253") return "FE";
        } else {
          // Other branches Sem 2: ICB2 is compulsory. If ICB1 taken → FE
          if (isICB1) return "FE";
        }
      }
    }

    if (isICB1 || isICB2) return "IC_BASKET";

    const mappings = enrollment.course?.branchMappings || [];
    if (mappings.length > 0) {
      // Map branch code: CSE → CS (since database uses CS code)
      const mappingBranch = userBranch === "CSE" ? "CS" : userBranch;
      const mapping = (mappingBranch
        ? mappings.find((m: any) => m.branch === mappingBranch) || mappings.find((m: any) => m.branch === "COMMON")
        : undefined) || (mappings.length === 1 ? mappings[0] : undefined);

      if (mapping && mapping.courseCategory in categoryCredits) {
        return mapping.courseCategory as keyof typeof categoryCredits;
      }
    }

    // Branch-specific course patterns
    if (userBranch === "CSE" && code.startsWith("DS")) return "DE";
    if (userBranch === "DSE" && code.startsWith("CS")) return "DE";

    if (normalizedCode === "IC181") return "IKS";
    if (normalizedCode.startsWith("IC")) return "IC";
    if (normalizedCode.startsWith("HS")) return "HSS";
    if (normalizedCode.startsWith("IKS") || normalizedCode.startsWith("IK")) return "IKS";
    if (normalizedCode.includes("MTP")) return "MTP";
    if (normalizedCode.includes("ISTP")) return "ISTP";
    if (enrollment.courseType === "DE") return "DE";
    if (enrollment.courseType === "FREE_ELECTIVE" || enrollment.courseType === "PE") return "FE";
    return "DC";
  };

  if (enrollments && enrollments.length > 0) {
    enrollments
      .filter((e: any) => e.status === "COMPLETED" && (!e.grade || e.grade !== "F"))
      .forEach((e: any) => {
        const category = getCourseCategory(e);
        categoryCredits[category] += e.course?.credits || 0;
      });
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
          value: progress.completed.core,
          total: progress.required.core,
          color: COLORS.core,
        },
        {
          name: "DE",
          value: progress.completed.de,
          total: progress.required.de,
          color: COLORS.de,
        },
        {
          name: "PE",
          value: progress.completed.pe,
          total: progress.required.pe,
          color: COLORS.pe,
        },
        {
          name: "Free Elective",
          value: progress.completed.freeElective,
          total: progress.required.freeElective,
          color: COLORS.freeElective,
        },
      ].filter((item) => item.total > 0);

  return (
    <div className="bg-surface dark:bg-surface rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          {progress.programName} Progress
        </h3>
        <span className="text-2xl font-bold text-primary">
          {progress.percentage}%
        </span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm text-foreground-secondary mb-2">
          <span>
            {progress.completed.total} / {progress.required.total} credits
          </span>
          <span>{progress.remaining.total} remaining</span>
        </div>
        <div className="w-full bg-background-secondary dark:bg-background rounded-full h-3">
          <div
            className="bg-primary h-3 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, progress.percentage)}%` }}
          ></div>
        </div>
      </div>

      {categoryData.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(categoryCredits).map(([key, value]) => (
            <span
              key={key}
              className="px-2 py-1 rounded-full text-xs font-semibold bg-surface-hover text-foreground-secondary"
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
          <span className="text-xl font-bold text-foreground">{progress.percentage}%</span>
          <span className="text-xs text-foreground-secondary">
            {progress.completed.total} / {progress.required.total}
          </span>
        </div>
      </div>
    </div>
  );
}
