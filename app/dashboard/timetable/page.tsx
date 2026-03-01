import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TimetableView } from "@/components/TimetableView";

export default async function TimetablePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Timetable</h1>
        <p className="mt-2 text-foreground-secondary">
          Current semester schedule (shared across everyone enrolled in a course)
        </p>
      </div>

      <TimetableView userId={session.user.id} />
    </div>
  );
}
