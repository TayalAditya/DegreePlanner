"use client";

import { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  iconColor?: string;
  iconBg?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  iconColor = "text-warning",
  iconBg = "bg-warning/10",
}: EmptyStateProps) {
  return (
    <div className="text-center py-8 sm:py-12">
      <div
        className={`w-12 h-12 sm:w-14 sm:h-14 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5`}
      >
        <div className={`w-6 h-6 sm:w-7 sm:h-7 ${iconColor}`}>{icon}</div>
      </div>
      <p className="text-base sm:text-lg font-semibold text-foreground mb-1 sm:mb-2">
        {title}
      </p>
      <p className="text-xs sm:text-sm text-foreground-secondary max-w-sm mx-auto mb-4 sm:mb-6">
        {description}
      </p>
      {action && (
        <a
          href={action.href || "#"}
          onClick={(e) => {
            if (action.onClick) {
              e.preventDefault();
              action.onClick();
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}
