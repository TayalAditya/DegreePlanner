export function ProgramsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-40 bg-background-secondary rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-background-secondary rounded animate-pulse" />
      </div>

      {/* Primary program card */}
      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 bg-background-secondary rounded animate-pulse" />
          <div className="h-6 w-20 bg-background-secondary rounded-full animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-16 bg-background-secondary rounded animate-pulse" />
              <div className="h-6 w-10 bg-background-secondary rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="h-2 bg-background-secondary rounded-full animate-pulse" />
      </div>

      {/* Secondary programs */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <div className="h-5 w-28 bg-background-secondary rounded animate-pulse" />
          <div className="h-2 bg-background-secondary rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export default function ProgramsLoading() {
  return <ProgramsSkeleton />;
}
