export default function SignInLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-surface border border-border rounded-xl p-8 w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 bg-background-secondary rounded-full animate-pulse" />
          <div className="h-6 w-36 bg-background-secondary rounded animate-pulse" />
          <div className="h-4 w-52 bg-background-secondary rounded animate-pulse" />
        </div>
        <div className="h-10 w-full bg-background-secondary rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
