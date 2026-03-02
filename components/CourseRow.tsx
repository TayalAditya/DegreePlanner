"use client";

import { ReactNode } from "react";

interface CourseRowProps {
  code: string;
  name: string;
  credits?: number;
  semester?: number;
  status?: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  category?: string;
  categoryBadge?: ReactNode;
  onClick?: () => void;
  className?: string;
}

const statusBadge = (status?: string) => {
  switch (status) {
    case "IN_PROGRESS":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-[11px] font-semibold">
          In progress
        </span>
      );
    case "COMPLETED":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 text-[11px] font-semibold">
          Completed
        </span>
      );
    case "PENDING":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-400 text-[11px] font-semibold">
          Pending
        </span>
      );
    default:
      return null;
  }
};

export function CourseRow({
  code,
  name,
  credits,
  semester,
  status,
  categoryBadge,
  onClick,
  className = "",
}: CourseRowProps) {
  return (
    <tr
      className={`border-b border-border/60 last:border-0 hover:bg-surface-hover/40 transition-colors ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
      onClick={onClick}
    >
      {semester !== undefined && (
        <td className="py-2 pr-4 text-foreground whitespace-nowrap text-xs sm:text-sm">
          {semester}
        </td>
      )}
      <td className="py-2 pr-4 font-semibold text-foreground whitespace-nowrap text-xs sm:text-sm">
        {code}
      </td>
      <td className="py-2 pr-4 text-foreground-secondary text-xs sm:text-sm min-w-0">
        <span className="truncate block">{name}</span>
      </td>
      {credits !== undefined && (
        <td className="py-2 pr-4 text-right text-foreground whitespace-nowrap font-medium text-xs sm:text-sm">
          {credits}
        </td>
      )}
      {status && (
        <td className="py-2 whitespace-nowrap text-xs sm:text-sm">
          {statusBadge(status)}
        </td>
      )}
      {categoryBadge && <td className="py-2 whitespace-nowrap">{categoryBadge}</td>}
    </tr>
  );
}
