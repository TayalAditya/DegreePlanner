import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/SettingsForm";
import prisma from "@/lib/prisma";

export default async function SettingsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth/signin");
  }

  const shareUser = session.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isProfileShared: true, shareToken: true },
      })
    : null;

  const initialShareState = {
    isProfileShared: Boolean(shareUser?.isProfileShared),
    shareToken: shareUser?.shareToken ?? null,
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Settings</h1>
        <p className="mt-2 text-foreground-secondary">
          Manage your profile and preferences
        </p>
      </div>

      <SettingsForm user={session.user} initialShareState={initialShareState} />
    </div>
  );
}
