"use client";

interface ProgressBarProps {
  completed: number;
  required: number;
  inProgress?: number;
  color?: string;
  showLabel?: boolean;
  animationDelay?: number;
}

export function ProgressBar({
  completed,
  required,
  inProgress = 0,
  color = "bg-primary",
  showLabel = true,
  animationDelay = 0,
}: ProgressBarProps) {
  const percentage = required > 0 ? (completed / required) * 100 : 0;

  return (
    <div className="space-y-1.5 sm:space-y-2">
      {showLabel && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs sm:text-sm font-medium text-foreground">
            Progress
          </span>
          <span className="text-xs sm:text-sm text-foreground-secondary flex-shrink-0">
            {completed} / {required}
            {inProgress > 0 && (
              <span className="text-warning"> (+{inProgress})</span>
            )}
          </span>
        </div>
      )}
      <div className="w-full bg-background-secondary rounded-full h-2.5 sm:h-3 overflow-hidden">
        <div
          className={`${color} h-full rounded-full transition-all duration-700 ease-out`}
          style={{
            width: `${Math.min(100, percentage)}%`,
            transitionDelay: `${animationDelay}ms`,
          }}
          role="progressbar"
          aria-valuenow={Math.round(percentage)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
