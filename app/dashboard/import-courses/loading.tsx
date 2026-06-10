export default function ImportCoursesLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-44 bg-background-secondary rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-background-secondary rounded animate-pulse" />
      </div>

      {/* Upload area */}
      <div className="bg-surface border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center gap-3">
        <div className="h-10 w-10 bg-background-secondary rounded-full animate-pulse" />
        <div className="h-4 w-48 bg-background-secondary rounded animate-pulse" />
        <div className="h-3 w-32 bg-background-secondary rounded animate-pulse" />
      </div>

      {/* Course list skeleton */}
      <div className="bg-surface border border-border rounded-lg divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="h-4 w-4 bg-background-secondary rounded animate-pulse shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-28 bg-background-secondary rounded animate-pulse" />
              <div className="h-3 w-52 bg-background-secondary rounded animate-pulse" />
            </div>
            <div className="h-5 w-14 bg-background-secondary rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
