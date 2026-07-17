"use client";

import { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  iconBg?: string;
  iconColor?: string;
  valueColor?: string;
  accentBgColor?: string;
  onClick?: () => void;
  delay?: number;
}

export function StatCard({
  icon,
  label,
  value,
  sublabel,
  iconBg: _iconBg = "bg-primary/10",
  iconColor = "text-primary",
  valueColor = "text-primary",
  accentBgColor: _accentBgColor = "bg-primary/10",
  onClick,
  delay: _delay = 0,
}: StatCardProps) {
  return (
    <div className="h-full">
      <div
        onClick={onClick}
        className={`h-full bg-surface px-4 py-4 sm:px-5 sm:py-5 ${
          onClick ? "cursor-pointer transition-colors hover:bg-background-secondary" : ""
        }`}
      >
        <div className="flex h-full items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-foreground-secondary">
              {label}
            </p>
            <p className={`text-2xl font-semibold tracking-tight sm:text-3xl ${valueColor}`}>
              {value}
            </p>
            {sublabel && (
              <p className="mt-1 text-xs text-foreground-secondary">
                {sublabel}
              </p>
            )}
          </div>

          <div className={`mt-1 h-5 w-5 flex-shrink-0 ${iconColor}`}>{icon}</div>
        </div>
      </div>
    </div>
  );
}
