import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="mt-2 text-foreground-secondary">
          Manage your profile and preferences
        </p>
      </div>

      <SettingsForm user={session.user} />
    </div>
  );
}
