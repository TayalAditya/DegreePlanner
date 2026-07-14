import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

import CourseMappingsClient from "./CourseMappingsClient";

export default async function CourseMappingsPage() {
  const session = await getSession();

  if (!session) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return <CourseMappingsClient />;
}
