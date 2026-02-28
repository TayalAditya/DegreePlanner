import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import InboxClient from "./InboxClient";

export default async function InboxPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return <InboxClient />;
}

