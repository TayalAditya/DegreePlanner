"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Suspense } from "react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, { title: string; description: string }> = {
    Configuration: {
      title: "Configuration Error",
      description: "There is a problem with the server configuration. Please contact support.",
    },
    AccessDenied: {
      title: "Access Denied",
      description: "You do not have permission to access this application. Please contact your administrator.",
    },
    Verification: {
      title: "Verification Error",
      description: "The verification token has expired or has already been used.",
    },
    batch_not_supported: {
      title: "Batch Not Supported",
      description: "Currently, we're operating for Batch 2023 and a limited set of Batch 2022/2024 students. We might expand to other batches later. Please check back soon!",
    },
    domain_not_allowed: {
      title: "Email Domain Not Allowed",
      description: "Your email domain is not authorized to access this application. Please use your institutional email address.",
    },
    user_not_approved: {
      title: "Access Restricted",
      description: "This app is only for IIT Mandi students on the approved list (B22/B23/B24 supported).",
    },
    branch_not_allowed: {
      title: "Branch Not Supported",
      description: "For Batch 2024, access is currently enabled only for CSE/DSE/EE/MEVLSI/MSE/BioE students. If you believe this is a mistake, please contact the administrator.",
    },
    Default: {
      title: "Authentication Error",
      description: "An error occurred during authentication. Please try again.",
    },
  };

  const errorInfo = errorMessages[error || ""] || errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        <div className="bg-surface rounded-2xl border border-border shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-error/10 rounded-2xl border border-error/20 mb-4">
              <AlertCircle className="w-7 h-7 text-error" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {errorInfo.title}
            </h1>
            <p className="text-foreground-secondary">
              {errorInfo.description}
            </p>
          </div>

          {error === "AccessDenied" && (
            <div className="mb-6 p-4 bg-info/10 border border-info/20 rounded-xl">
              <p className="text-sm text-foreground-secondary">
                <span className="font-semibold text-info">Note:</span> Only users with approved institutional emails can access this application.
                If you believe this is an error, please contact your administrator.
              </p>
            </div>
          )}

          {error === "batch_not_supported" && (
            <div className="mb-6 p-4 bg-warning/10 border border-warning/20 rounded-xl">
              <p className="text-sm text-foreground-secondary">
                We&apos;re gradually expanding to other batches. Stay tuned!
              </p>
            </div>
          )}

          {error === "user_not_approved" && (
            <div className="mb-6 p-4 bg-warning/10 border border-warning/20 rounded-xl">
              <p className="text-sm text-foreground-secondary">
                <span className="font-semibold text-warning">IIT Mandi Students Only:</span> Please sign in with your institute Google account (e.g.{" "}
                <code className="bg-warning/10 dark:bg-warning/20 px-1.5 py-0.5 rounded border border-warning/20">b23xxxxx@students.iitmandi.ac.in</code>{" "}
                /{" "}
                <code className="bg-warning/10 dark:bg-warning/20 px-1.5 py-0.5 rounded border border-warning/20">b22xxxxx@students.iitmandi.ac.in</code>{" "}
                /{" "}
                <code className="bg-warning/10 dark:bg-warning/20 px-1.5 py-0.5 rounded border border-warning/20">b24xxxxx@students.iitmandi.ac.in</code>
                ). Only students on the approved list are permitted.
              </p>
            </div>
          )}

          <Link
            href="/auth/signin"
            className="group relative w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3 font-medium hover:bg-primary-hover transition-all shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthError() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-8 h-8 border-2 border-border-strong border-t-primary rounded-full animate-spin" aria-label="Loading" />
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
