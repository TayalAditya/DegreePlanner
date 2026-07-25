"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ImpersonateSelector } from "./ImpersonateSelector";
import { isAcadSec as isAcadSecEmail } from "@/lib/permissions";

export function AcadSecGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [showSelector, setShowSelector] = useState(false);

  const isAcadSec = isAcadSecEmail(session?.user?.email);
  const selectionComplete = Boolean(session?.user?.acadSecSelectionComplete);

  useEffect(() => {
    if (status !== "authenticated" || !isAcadSec) return;
    setShowSelector(!selectionComplete);
  }, [status, isAcadSec, selectionComplete]);

  if (showSelector) {
    return (
      <>
        {children}
        <ImpersonateSelector onComplete={() => setShowSelector(false)} />
      </>
    );
  }

  return <>{children}</>;
}
