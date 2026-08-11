import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import CourseSetupClient from "./CourseSetupClient";

export default async function AdminCourseSetupPage() {
  const session = await getSession();
  if (!session) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return <CourseSetupClient />;
}
