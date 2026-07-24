import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { PYQView } from "@/components/PYQView";
import { isDocumentsAdmin } from "@/lib/permissions";

export const metadata = {
  title: "Previous Year Papers | PlanMyDegree",
  description: "Browse and share previous year question papers",
};

export default async function PYQPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const admin = isDocumentsAdmin(session.user);

  return <PYQView isAdmin={admin} />;
}
