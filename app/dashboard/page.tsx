import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardOverview } from "@/components/DashboardOverview";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {session?.user?.name?.split(" ")[0]}!
        </h1>
        <p className="mt-2 text-gray-600">
          Track your academic progress and plan your courses
        </p>
      </div>

      <DashboardOverview userId={session?.user?.id!} />
    </div>
  );
}
