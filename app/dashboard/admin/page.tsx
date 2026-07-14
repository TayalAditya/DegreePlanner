import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const session = await getSession();

  if (!session) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return <AdminClient />;
}
