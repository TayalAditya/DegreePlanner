export default function CoursesSection() {
  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Institute Core - Compulsory Courses (39 credits)</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { code: "IC112", name: "Calculus", credits: 2 },
            { code: "IC113", name: "Complex Variables and Vector Calculus", credits: 2 },
            { code: "IC114", name: "Linear Algebra", credits: 2 },
            { code: "IC115", name: "ODE & Integral Transforms", credits: 2 },
            { code: "IC140", name: "Engineering Graphics for Design", credits: 4 },
            { code: "IC102P", name: "Foundations of Design Practicum", credits: 4 },
            { code: "IC152", name: "Computing and Data Science", credits: 4 },
            { code: "IC202P", name: "Design Practicum", credits: 3 },
            { code: "IC252", name: "Probability and Statistics", credits: 4 },
            { code: "IC161", name: "Applied Electronics", credits: 3 },
            { code: "IC161P", name: "Applied Electronics Lab", credits: 2 },
            { code: "IC272", name: "Machine Learning", credits: 3 },
            { code: "IC222P", name: "Physics Practicum", credits: 2 },
          ].map((course, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-surface-hover/70 border border-border/60 hover:bg-surface-hover transition-colors">
              <div className="min-w-0">
                <span className="font-mono text-sm text-blue-600 dark:text-blue-400">{course.code}</span>
                <p className="text-sm">{course.name}</p>
              </div>
              <span className="font-semibold text-purple-600 dark:text-purple-400">{course.credits}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">IC Basket Courses (6 credits)</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">IC-I Basket (3 credits - Choose 1)</h4>
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-surface-hover/70 border border-border/60"><span className="font-mono text-sm">IC131</span> - Applied Chemistry for Engineers</div>
              <div className="p-3 rounded-lg bg-surface-hover/70 border border-border/60"><span className="font-mono text-sm">IC136</span> - Understanding Biotechnology and its Applications</div>
              <div className="p-3 rounded-lg bg-surface-hover/70 border border-border/60"><span className="font-mono text-sm">IC230</span> - Environmental Science</div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-purple-600 dark:text-purple-400 mb-2">IC-II Basket (3 credits - Choose 1)</h4>
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-surface-hover/70 border border-border/60"><span className="font-mono text-sm">IC121</span> - Mechanics of Particles and Waves</div>
              <div className="p-3 rounded-lg bg-surface-hover/70 border border-border/60"><span className="font-mono text-sm">IC240</span> - Mechanics of Rigid Bodies</div>
              <div className="p-3 rounded-lg bg-surface-hover/70 border border-border/60"><span className="font-mono text-sm">IC241</span> - Material Science for Engineers</div>
              <div className="p-3 rounded-lg bg-surface-hover/70 border border-border/60"><span className="font-mono text-sm">IC253</span> - Data Structures and Algorithms</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">HSS + IKS Requirements</h3>
        <div className="space-y-3">
          <p className="text-muted-foreground">
            15 credits (BTech) / 12 credits (BSCS) from HSS+IKS courses — IKS, HS-xxx and IK-xxx all count here:
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="p-3 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 dark:border-blue-500/30">Sociology</div>
            <div className="p-3 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/20 dark:border-purple-500/30">Economics</div>
            <div className="p-3 rounded-lg bg-pink-500/10 dark:bg-pink-500/20 border border-pink-500/20 dark:border-pink-500/30">Literature</div>
            <div className="p-3 rounded-lg bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/20 dark:border-orange-500/30">Entrepreneurship</div>
          </div>
          <div className="mt-4 p-4 rounded-lg bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 dark:border-blue-500/30 border-l-4 border-l-blue-500/60 dark:border-l-blue-500/50">
            <p className="font-semibold">Indian Knowledge System (IKS) — merged into HSS+IKS basket</p>
            <p className="text-sm text-muted-foreground">IC-181/IC-182 and IK-xxx courses all count toward the combined 15 cr (BTech) / 12 cr (BSCS) requirement</p>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            * Maximum 20 HSS credits count towards 160 credits. Additional HSS credits count outside the requirement.
          </p>
        </div>
      </div>
    </div>
  );
}
