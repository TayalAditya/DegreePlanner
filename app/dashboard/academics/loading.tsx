export default function AcademicsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-56 bg-background-secondary rounded animate-pulse mb-2" />
        <div className="h-4 w-80 bg-background-secondary rounded animate-pulse" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-9 w-24 bg-background-secondary rounded-lg animate-pulse shrink-0" />
        ))}
      </div>

      {/* Content area */}
      <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
        <div className="h-6 w-40 bg-background-secondary rounded animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 w-full bg-background-secondary rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
