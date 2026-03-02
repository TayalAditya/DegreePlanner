"use client";

interface SectionHeaderProps {
  title: string;
  description?: string;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`mb-4 sm:mb-6 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="w-1 h-6 bg-primary rounded-full flex-shrink-0" />
        <h3 className="text-base sm:text-lg font-semibold text-foreground">
          {title}
        </h3>
      </div>
      {description && (
        <p className="text-xs sm:text-sm text-foreground-secondary mt-1 sm:mt-2 ml-4">
          {description}
        </p>
      )}
    </div>
  );
}
