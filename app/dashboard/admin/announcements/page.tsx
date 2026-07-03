import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

import AnnouncementsAdminClient from "./AnnouncementsAdminClient";

export default async function AdminAnnouncementsPage() {
  const session = await getSession();

  if (!session) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return <AnnouncementsAdminClient />;
}

