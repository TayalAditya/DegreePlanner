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
      description: "Currently, we're only operating for Batch 2023 students. We might expand to other batches later. Please check back soon!",
    },
    domain_not_allowed: {
      title: "Email Domain Not Allowed",
      description: "Your email domain is not authorized to access this application. Please use your institutional email address.",
    },
    user_not_approved: {
      title: "Access Restricted",
      description: "This app is only for IIT Mandi Batch 2023 students. Your account is not on the approved list.",
    },
    Default: {
      title: "Authentication Error",
      description: "An error occurred during authentication. Please try again.",
    },
  };

  const errorInfo = errorMessages[error || ""] || errorMessages.Default;

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-gradient-to-b from-background-secondary to-background p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-error/15 dark:bg-error/10 blur-3xl animate-float" />
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-warning/15 dark:bg-warning/10 blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/10 dark:bg-primary/10 blur-3xl animate-float" />
      </div>

      <div className="max-w-md w-full relative">
        <div className="bg-surface/80 backdrop-blur-xl rounded-2xl border border-border shadow-xl p-8 animate-scale-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-error to-warning rounded-2xl shadow-lg shadow-error/20 mb-4">
              <AlertCircle className="w-8 h-8 text-white drop-shadow-sm" />
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
                We're gradually expanding to other batches. Stay tuned!
              </p>
            </div>
          )}

          {error === "user_not_approved" && (
            <div className="mb-6 p-4 bg-warning/10 border border-warning/20 rounded-xl">
              <p className="text-sm text-foreground-secondary">
                <span className="font-semibold text-warning">IIT Mandi B23 Students Only:</span> Please sign in with your institute Google account (
                <code className="bg-warning/10 dark:bg-warning/20 px-1.5 py-0.5 rounded border border-warning/20">b23xxxxx@students.iitmandi.ac.in</code>
                ). Other accounts are not permitted.
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
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-gradient-to-b from-background-secondary to-background p-4">
        <div className="w-8 h-8 border-2 border-border-strong border-t-primary rounded-full animate-spin" aria-label="Loading" />
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
