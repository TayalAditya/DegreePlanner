"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface ProgressChartProps {
  progress: any;
  isLoading: boolean;
}

const COLORS = {
  core: "#4f46e5", // indigo
  de: "#06b6d4", // cyan
  pe: "#8b5cf6", // purple
  freeElective: "#10b981", // emerald
  mtp: "#f59e0b", // amber
  istp: "#ef4444", // red
};

export function ProgressChart({ progress, isLoading }: ProgressChartProps) {
  if (isLoading) {
    return (
      <div className="bg-surface dark:bg-surface rounded-lg border border-border p-6 animate-pulse">
        <div className="h-4 bg-background-secondary dark:bg-background rounded w-1/2 mb-4"></div>
        <div className="h-64 bg-background-secondary dark:bg-background rounded"></div>
      </div>
    );
  }

  const data = [
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

      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, value }) => `${name}: ${value}`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
