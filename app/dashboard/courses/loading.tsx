export default function CoursesLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="h-9 w-40 bg-background-secondary rounded animate-pulse mb-3" />
        <div className="h-4 w-72 bg-background-secondary rounded animate-pulse" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 bg-surface rounded-lg border border-border animate-pulse" />
        ))}
      </div>

      {/* Tabs */}
      <div className="h-14 bg-surface rounded-lg border border-border animate-pulse" />

      {/* Enrollment list skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 bg-surface rounded-lg border border-border animate-pulse" />
        ))}
      </div>
    </div>
  );
}
