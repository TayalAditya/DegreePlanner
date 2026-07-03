export default function OverviewSection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 dark:from-blue-500/20 dark:to-blue-600/20 border border-blue-500/20 dark:border-blue-500/30 shadow-sm">
          <h3 className="font-semibold text-lg mb-2">B.Tech Degree</h3>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">160</p>
          <p className="text-sm text-muted-foreground">Total Credits Required</p>
        </div>
        <div className="p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-500/20 dark:to-purple-600/20 border border-purple-500/20 dark:border-purple-500/30 shadow-sm">
          <h3 className="font-semibold text-lg mb-2">B.Tech (EE)</h3>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">161</p>
          <p className="text-sm text-muted-foreground">Total Credits Required</p>
        </div>
        <div className="p-6 rounded-xl bg-gradient-to-br from-pink-500/10 to-pink-600/10 dark:from-pink-500/20 dark:to-pink-600/20 border border-pink-500/20 dark:border-pink-500/30 shadow-sm">
          <h3 className="font-semibold text-lg mb-2">B.S. Chemical Sciences</h3>
          <p className="text-3xl font-bold text-pink-600 dark:text-pink-400">163</p>
          <p className="text-sm text-muted-foreground">Total Credits Required</p>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Distribution of Credits (B.Tech)</h3>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 p-3 rounded-lg bg-surface-hover/70 border border-border/60">
            <span>Institute Core Courses</span>
            <span className="font-semibold">60 credits</span>
          </div>
          <div className="pl-4 space-y-2 text-sm text-muted-foreground">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"><span>• IC Compulsory</span><span className="sm:text-right">39 credits</span></div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"><span>• IC Basket</span><span className="sm:text-right">6 credits</span></div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"><span>• HSS</span><span className="sm:text-right">12 credits</span></div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"><span>• Indian Knowledge System</span><span className="sm:text-right">3 credits</span></div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 p-3 rounded-lg bg-surface-hover/70 border border-border/60">
            <span>Discipline Courses</span>
            <span className="font-semibold">66 credits</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 p-3 rounded-lg bg-surface-hover/70 border border-border/60">
            <span>Free Electives</span>
            <span className="font-semibold">22 credits</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 p-3 rounded-lg bg-surface-hover/70 border border-border/60">
            <span>MTP + ISTP</span>
            <span className="font-semibold">12 credits</span>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Credit Limits Per Semester</h3>
        <div className="space-y-2">
          <p className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"><span>Minimum:</span><strong className="sm:text-right">12 credits</strong></p>
          <p className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"><span>Maximum:</span><strong className="sm:text-right">22 credits</strong></p>
          <p className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"><span>With AD approval:</span><strong className="sm:text-right">Up to 25 credits</strong></p>
          <p className="text-sm text-muted-foreground mt-3">
            * Audit courses can increase the limit to 25 credits
          </p>
          <p className="text-sm text-muted-foreground">
            * For vacation/semester-long internship, minimum can be relaxed to 9 credits
          </p>
        </div>
      </div>
    </div>
  );
}
