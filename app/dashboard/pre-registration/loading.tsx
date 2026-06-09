export function PreRegistrationSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-52 bg-background-secondary rounded animate-pulse mb-2" />
        <div className="h-4 w-72 bg-background-secondary rounded animate-pulse" />
      </div>

      {/* Info bar */}
      <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-4 w-36 bg-background-secondary rounded animate-pulse" />
          <div className="h-3 w-52 bg-background-secondary rounded animate-pulse" />
        </div>
        <div className="h-9 w-24 bg-background-secondary rounded-lg animate-pulse" />
      </div>

      {/* Course sections */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="h-4 w-32 bg-background-secondary rounded animate-pulse" />
            <div className="h-4 w-6 bg-background-secondary rounded animate-pulse" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-4 p-4">
                <div className="h-4 w-4 bg-background-secondary rounded animate-pulse shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-28 bg-background-secondary rounded animate-pulse" />
                  <div className="h-3 w-44 bg-background-secondary rounded animate-pulse" />
                </div>
                <div className="h-5 w-10 bg-background-secondary rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PreRegistrationLoading() {
  return <PreRegistrationSkeleton />;
}
