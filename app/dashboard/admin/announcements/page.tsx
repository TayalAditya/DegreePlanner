import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import AnnouncementsAdminClient from "./AnnouncementsAdminClient";

export default async function AdminAnnouncementsPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return <AnnouncementsAdminClient />;
}

