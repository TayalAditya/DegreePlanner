import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";
import { RouteTransition } from "@/components/RouteTransition";
import { ScrollToTop } from "@/components/ScrollToTop";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  if (!session.user.isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-secondary p-4">
        <div className="max-w-md w-full bg-surface rounded-xl border border-border shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Approval Pending
          </h1>
          <p className="text-foreground-secondary mb-6">
            Your account is pending approval. Please contact your administrator to gain access to the degree planner.
          </p>
          <p className="text-sm text-foreground-secondary">
            Email: {session.user.email}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="flex flex-col lg:flex-row min-h-screen">
        <DashboardNav user={session.user} />
        <div className="flex-1 min-w-0">
          <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
            <RouteTransition>{children}</RouteTransition>
          </main>
        </div>
      </div>
      <ScrollToTop />
    </div>
  );
}
