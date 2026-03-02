"use client";

interface CategoryBadgeProps {
  category: string;
  credits?: number;
  count?: number;
  bgColor?: string;
  textColor?: string;
  className?: string;
}

const categoryColors: Record<string, { bg: string; text: string }> = {
  IC: { bg: "bg-info/10", text: "text-info" },
  IC_BASKET: { bg: "bg-accent/10", text: "text-accent" },
  DC: { bg: "bg-primary/10", text: "text-primary" },
  DE: { bg: "bg-secondary/10", text: "text-secondary" },
  FE: { bg: "bg-success/10", text: "text-success" },
  HSS: { bg: "bg-warning/10", text: "text-warning" },
  IKS: { bg: "bg-warning/10", text: "text-warning" },
  MTP: { bg: "bg-error/10", text: "text-error" },
  ISTP: { bg: "bg-accent/10", text: "text-accent" },
};

export function CategoryBadge({
  category,
  credits,
  count,
  bgColor,
  textColor,
  className = "",
}: CategoryBadgeProps) {
  const colors = categoryColors[category as keyof typeof categoryColors] || {
    bg: "bg-foreground-muted/10",
    text: "text-foreground-muted",
  };
  const bg = bgColor || colors.bg;
  const text = textColor || colors.text;

  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-border ${bg} max-w-full ${className}`}
      title={category}
    >
      <span className={`font-semibold text-xs ${text} truncate`}>
        {category}
      </span>
      {credits !== undefined && (
        <span className="text-xs text-foreground-secondary whitespace-nowrap">
          {credits}cr{count !== undefined ? ` (${count})` : ""}
        </span>
      )}
    </span>
  );
}
