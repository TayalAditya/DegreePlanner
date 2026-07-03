import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

import InboxClient from "./InboxClient";

export default async function InboxPage() {
  const session = await getSession();

  if (!session) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return <InboxClient />;
}

