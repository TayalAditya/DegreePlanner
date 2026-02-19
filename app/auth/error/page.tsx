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
      description: "Currently, we're only operating for Batch 2023 students (enrollment IDs starting with B23). We might expand to other batches later. Please check back soon!",
    },
    domain_not_allowed: {
      title: "Email Domain Not Allowed",
      description: "Your email domain is not authorized to access this application. Please use your institutional email address.",
    },
    user_not_approved: {
      title: "User Not Approved",
      description: "Your account has not been approved yet. Please contact your administrator for access.",
    },
    Default: {
      title: "Authentication Error",
      description: "An error occurred during authentication. Please try again.",
    },
  };

  const errorInfo = errorMessages[error || ""] || errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {errorInfo.title}
            </h1>
            <p className="text-gray-600">
              {errorInfo.description}
            </p>
          </div>

          {error === "AccessDenied" && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Only users with approved institutional emails can access this application.
                If you believe this is an error, please contact your administrator.
              </p>
            </div>
          )}

          {error === "batch_not_supported" && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Currently Serving Batch 2023:</strong> Your enrollment ID should start with <code className="bg-amber-100 px-2 py-1 rounded">B23</code>.
                <br />
                <br />
                We're gradually expanding to other batches. Stay tuned!
              </p>
            </div>
          )}

          {error === "user_not_approved" && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Approval Pending:</strong> Your account hasn't been approved yet.
                This typically happens within 24 hours of first login. Please try again later or contact support if this persists.
              </p>
            </div>
          )}

          <Link
            href="/auth/signin"
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-6 py-3 font-medium hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
