import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardOverview } from "@/components/DashboardOverview";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-xl p-6 border border-primary/20">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Welcome back, {session?.user?.name?.split(" ")[0]}! 👋
        </h1>
        <p className="text-foreground-secondary">
          {session?.user?.branch && session?.user?.batch ? (
            <span className="font-medium">
              {session.user.branch} • Batch {session.user.batch} • {session.user.enrollmentId}
            </span>
          ) : (
            "Track your academic progress and plan your courses"
          )}
        </p>
      </div>

      <DashboardOverview userId={session?.user?.id!} />
    </div>
  );
}
