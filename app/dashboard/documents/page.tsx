import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DocumentsView } from "@/components/DocumentsView";

export default async function DocumentsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Documents & Forms</h1>
        <p className="mt-2 text-foreground-secondary">
          Access important academic documents, forms, and procedures
        </p>
      </div>

      <DocumentsView userId={session.user.id} role={session.user.role} />
    </div>
  );
}
