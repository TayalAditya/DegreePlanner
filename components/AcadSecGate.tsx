"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { ImpersonateSelector } from "./ImpersonateSelector";
import { isAcadSec as isAcadSecEmail } from "@/lib/permissions";

const SETUP_KEY = "acadSecSetup";

export function AcadSecGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [showSelector, setShowSelector] = useState(false);

  const isAcadSec = isAcadSecEmail(session?.user?.email);

  useEffect(() => {
    // Clear setup flag when session ends (logout without closing tab)
    if (status === "unauthenticated") {
      sessionStorage.removeItem(SETUP_KEY);
    }
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || !isAcadSec) return;
    const alreadySetup = sessionStorage.getItem(SETUP_KEY);
    setShowSelector(!alreadySetup);
  }, [status, isAcadSec]);

  if (showSelector) {
    return (
      <>
        {children}
        <ImpersonateSelector />
      </>
    );
  }

  return <>{children}</>;
}
