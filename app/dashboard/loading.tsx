export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="h-9 w-56 bg-background-secondary rounded animate-pulse" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-4 space-y-2">
            <div className="h-3 w-20 bg-background-secondary rounded animate-pulse" />
            <div className="h-8 w-12 bg-background-secondary rounded animate-pulse" />
            <div className="h-3 w-24 bg-background-secondary rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-4 h-24 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
