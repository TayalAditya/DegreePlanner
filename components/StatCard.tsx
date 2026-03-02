"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

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

const colorMap = {
  primary: "text-primary",
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  error: "text-error",
  secondary: "text-secondary",
  accent: "text-accent",
};

const bgColorMap = {
  primary: "bg-primary/10",
  success: "bg-success/10",
  info: "bg-info/10",
  warning: "bg-warning/10",
  error: "bg-error/10",
  secondary: "bg-secondary/10",
  accent: "bg-accent/10",
};

const borderColorMap = {
  primary: "hover:border-primary/30",
  success: "hover:border-success/30",
  info: "hover:border-info/30",
  warning: "hover:border-warning/30",
  error: "hover:border-error/30",
  secondary: "hover:border-secondary/30",
  accent: "hover:border-accent/30",
};

export function StatCard({
  icon,
  label,
  value,
  sublabel,
  iconBg = "bg-primary/10",
  iconColor = "text-primary",
  valueColor = "text-primary",
  accentBgColor = "bg-primary/10",
  onClick,
  delay = 0,
}: StatCardProps) {
  const accentColorKey = valueColor.replace("text-", "") as keyof typeof borderColorMap;
  const borderClass = borderColorMap[accentColorKey] || "hover:border-primary/30";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="h-full"
    >
      <div
        onClick={onClick}
        className={`relative overflow-hidden bg-surface rounded-xl shadow-sm border border-border p-5 sm:p-6 transition-all duration-300 hover:shadow-md ${borderClass} ${
          onClick ? "cursor-pointer hover:-translate-y-1" : ""
        }`}
      >
        {/* Gradient background blur effect */}
        <div
          className={`pointer-events-none absolute -top-10 -right-10 w-28 h-28 ${accentBgColor} rounded-full blur-2xl opacity-50`}
          aria-hidden="true"
        />

        <div className="relative flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-foreground-secondary font-medium mb-1 sm:mb-2">
              {label}
            </p>
            <p className={`text-2xl sm:text-3xl md:text-4xl font-bold ${valueColor}`}>
              {value}
            </p>
            {sublabel && (
              <p className="text-xs text-foreground-secondary mt-1 sm:mt-2">
                {sublabel}
              </p>
            )}
          </div>

          <div
            className={`w-11 h-11 sm:w-14 sm:h-14 ${iconBg} dark:bg-opacity-40 rounded-xl flex items-center justify-center flex-shrink-0`}
          >
            <div className={`w-5 h-5 sm:w-7 sm:h-7 ${iconColor}`}>
              {icon}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
