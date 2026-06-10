export function ProgressSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-background-secondary rounded animate-pulse mb-2" />
        <div className="h-4 w-72 bg-background-secondary rounded animate-pulse" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-lg p-4 space-y-2">
            <div className="h-3 w-20 bg-background-secondary rounded animate-pulse" />
            <div className="h-7 w-14 bg-background-secondary rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Progress bars */}
      <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
        <div className="h-5 w-40 bg-background-secondary rounded animate-pulse" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between">
              <div className="h-3 w-24 bg-background-secondary rounded animate-pulse" />
              <div className="h-3 w-12 bg-background-secondary rounded animate-pulse" />
            </div>
            <div className="h-2 bg-background-secondary rounded-full animate-pulse" />
          </div>
        ))}
      </div>

      {/* Course list */}
      <div className="bg-surface border border-border rounded-lg divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <div className="h-4 w-32 bg-background-secondary rounded animate-pulse" />
              <div className="h-3 w-48 bg-background-secondary rounded animate-pulse" />
            </div>
            <div className="h-5 w-16 bg-background-secondary rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProgressLoading() {
  return <ProgressSkeleton />;
}
