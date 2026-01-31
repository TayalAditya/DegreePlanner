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
      <div className="bg-surface dark:bg-surface rounded-lg border border-border p-6 animate-pulse">
        <div className="h-4 bg-background-secondary dark:bg-background rounded w-1/2 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-background-secondary dark:bg-background rounded"></div>
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
      color: "indigo",
    },
    {
      name: "Discipline Electives (DE)",
      completed: progress.completed.de,
      required: progress.required.de,
      inProgress: progress.inProgress.de,
      color: "cyan",
    },
    {
      name: "Program Electives (PE)",
      completed: progress.completed.pe,
      required: progress.required.pe,
      inProgress: progress.inProgress.pe,
      color: "purple",
    },
    {
      name: "Free Electives",
      completed: progress.completed.freeElective,
      required: progress.required.freeElective,
      inProgress: progress.inProgress.freeElective,
      color: "emerald",
    },
  ].filter((cat) => cat.required > 0);

  const getStatusIcon = (completed: number, required: number, inProgress: number) => {
    if (completed >= required) {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    } else if (completed + inProgress >= required) {
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
    return <Circle className="w-5 h-5 text-gray-300" />;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        Credit Breakdown
      </h3>

      <div className="space-y-4">
        {categories.map((category) => {
          const percentage = Math.min(
            100,
            (category.completed / category.required) * 100
          );
          return (
            <div key={category.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(
                    category.completed,
                    category.required,
                    category.inProgress
                  )}
                  <span className="font-medium text-foreground">
                    {category.name}
                  </span>
                </div>
                <span className="text-sm text-foreground-secondary">
                  {category.completed} / {category.required}
                  {category.inProgress > 0 && (
                    <span className="text-yellow-600 dark:text-yellow-400">
                      {" "}
                      (+{category.inProgress})
                    </span>
                  )}
                </span>
              </div>
              <div className="w-full bg-background-secondary dark:bg-background rounded-full h-2">
                <div
                  className={`bg-${category.color}-600 dark:bg-${category.color}-500 h-2 rounded-full transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-foreground">
            Total Credits
          </span>
          <span className="text-2xl font-bold text-primary">
            {progress.completed.total} / {progress.required.total}
          </span>
        </div>
      </div>
    </div>
  );
}
