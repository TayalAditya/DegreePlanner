export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="h-9 w-32 bg-background-secondary rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-background-secondary rounded animate-pulse" />
      </div>

      {/* Form container */}
      <div className="max-w-2xl mx-auto w-full space-y-6">
        {/* Appearance card skeleton */}
        <div className="bg-surface rounded-lg border border-border p-6">
          <div className="h-6 w-32 bg-background-secondary rounded animate-pulse mb-4" />
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-background-secondary rounded-xl animate-pulse" />
            ))}
          </div>
        </div>

        {/* Profile Sharing card skeleton */}
        <div className="bg-surface rounded-lg border border-border p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-2 flex-1">
              <div className="h-6 w-40 bg-background-secondary rounded animate-pulse" />
              <div className="h-4 w-full max-w-md bg-background-secondary rounded animate-pulse" />
            </div>
            <div className="h-7 w-12 bg-background-secondary rounded-full animate-pulse" />
          </div>
          <div className="h-20 bg-background-secondary/50 rounded-lg animate-pulse" />
        </div>

        {/* Profile form skeleton */}
        <div className="bg-surface rounded-lg border border-border p-6">
          <div className="h-6 w-24 bg-background-secondary rounded animate-pulse mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="h-4 w-20 bg-background-secondary rounded animate-pulse mb-2" />
                <div className="h-10 bg-background-secondary rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
          <div className="mt-6 h-10 w-32 bg-background-secondary rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}
