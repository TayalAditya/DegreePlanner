export default function TimetableLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-36 bg-background-secondary rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-background-secondary rounded animate-pulse" />
      </div>
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-6 border-b border-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-3 border-r border-border last:border-r-0">
              <div className="h-4 bg-background-secondary rounded animate-pulse" />
            </div>
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="grid grid-cols-6 border-b border-border last:border-b-0">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-16 p-2 border-r border-border last:border-r-0">
                {j === 0 && (
                  <div className="h-3 w-10 bg-background-secondary rounded animate-pulse mt-1" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
