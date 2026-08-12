import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

import VenueSetupClient from "./VenueSetupClient";

export default async function AdminVenueSetupPage() {
  const session = await getSession();

  if (!session) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return <VenueSetupClient />;
}
