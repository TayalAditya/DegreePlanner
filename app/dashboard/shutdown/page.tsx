import { redirect } from "next/navigation";

import { ShutdownControl } from "@/components/ShutdownControl";
import { getMaintenanceStatus } from "@/lib/maintenance";
import { isDocumentsAdmin } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export default async function ShutdownPage() {
  const session = await getSession();

  if (!session || !isDocumentsAdmin(session.user)) {
    redirect("/dashboard");
  }

  const status = await getMaintenanceStatus();
  return <ShutdownControl initialStatus={status} />;
}
