export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-40 bg-background-secondary rounded animate-pulse mb-2" />
        <div className="h-4 w-60 bg-background-secondary rounded animate-pulse" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2">
        <div className="h-9 w-28 bg-background-secondary rounded-lg animate-pulse" />
        <div className="h-9 w-36 bg-background-secondary rounded-lg animate-pulse" />
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 border-b border-border px-4 py-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 bg-background-secondary rounded animate-pulse" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 border-b border-border last:border-b-0 px-4 py-3 gap-4">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="h-4 bg-background-secondary rounded animate-pulse" style={{ opacity: 1 - j * 0.1 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
