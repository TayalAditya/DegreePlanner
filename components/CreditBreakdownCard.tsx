"use client";

import { CheckCircle2, Circle, AlertCircle } from "lucide-react";

interface CreditBreakdownCardProps {
  progress: any;
  isLoading: boolean;
}

export function CreditBreakdownCard({
  progress,
  isLoading,
}: CreditBreakdownCardProps) {
  if (isLoading) {
    return (
      <div className="bg-surface rounded-lg border border-border p-6 animate-pulse">
        <div className="h-4 bg-background-secondary rounded w-1/2 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-background-secondary rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const categories = [
    {
      name: "Core Courses",
      completed: progress.completed.core,
      required: progress.required.core,
      inProgress: progress.inProgress.core,
      color: "primary",
    },
    {
      name: "Discipline Electives (DE)",
      completed: progress.completed.de,
      required: progress.required.de,
      inProgress: progress.inProgress.de,
      color: "secondary",
    },
    {
      name: "Program Electives (PE)",
      completed: progress.completed.pe,
      required: progress.required.pe,
      inProgress: progress.inProgress.pe,
      color: "info",
    },
    {
      name: "Free Electives",
      completed: progress.completed.freeElective,
      required: progress.required.freeElective,
      inProgress: progress.inProgress.freeElective,
      color: "success",
    },
    {
      name: "MTP",
      completed: progress.completed.mtp,
      required: progress.required.mtp,
      inProgress: progress.inProgress.mtp,
      color: "error",
    },
    {
      name: "ISTP",
      completed: progress.completed.istp,
      required: progress.required.istp,
      inProgress: progress.inProgress.istp,
      color: "accent",
    },
  ].filter((cat) => cat.required > 0);

  const barClasses: Record<string, string> = {
    primary: "bg-primary",
    secondary: "bg-secondary",
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-error",
    accent: "bg-accent",
  };

  const getStatusIcon = (completed: number, required: number, inProgress: number) => {
    if (completed >= required) {
      return <CheckCircle2 className="w-5 h-5 text-success" />;
    } else if (completed + inProgress >= required) {
      return <AlertCircle className="w-5 h-5 text-warning" />;
    }
    return <Circle className="w-5 h-5 text-foreground-muted" />;
  };

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <span className="w-1 h-6 bg-primary rounded-full"></span>
        <h3 className="text-base sm:text-lg font-semibold text-foreground">
          Credit Breakdown
        </h3>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {categories.map((category) => {
          const percentage = Math.min(
            100,
            (category.completed / category.required) * 100
          );
          return (
            <div key={category.name} className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  {getStatusIcon(
                    category.completed,
                    category.required,
                    category.inProgress
                  )}
                  <span className="font-medium text-foreground text-xs sm:text-sm truncate">
                    {category.name}
                  </span>
                </div>
                <span className="text-xs sm:text-sm text-foreground-secondary flex-shrink-0">
                  {category.completed} / {category.required}
                  {category.inProgress > 0 && (
                    <span className="text-warning">
                      {" "}
                      (+{category.inProgress})
                    </span>
                  )}
                </span>
              </div>
              <div className="w-full bg-background-secondary rounded-full h-2.5 sm:h-3 overflow-hidden">
                <div
                  className={`${barClasses[category.color] || "bg-foreground-muted/40"} h-full rounded-full transition-all duration-700`}
                  style={{ width: `${percentage}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round(percentage)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border/60">
        <div className="flex justify-between items-center">
          <span className="text-sm sm:text-base font-semibold text-foreground">
            Total Credits
          </span>
          <span className="text-xl sm:text-2xl font-bold text-primary">
            {progress.completed.total} / {progress.required.total}
          </span>
        </div>
      </div>
    </div>
  );
}
