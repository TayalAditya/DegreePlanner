"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { LogIn, Shield } from "lucide-react";

export default function SignIn() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-gradient-to-b from-background-secondary to-background p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 dark:bg-primary/10 blur-3xl animate-float" />
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-secondary/20 dark:bg-secondary/10 blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-accent/15 dark:bg-accent/10 blur-3xl animate-float" />
      </div>

      <div className="max-w-md w-full relative">
        <div className="bg-surface/80 backdrop-blur-xl rounded-2xl border border-border shadow-xl p-8 animate-scale-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-lg shadow-primary/20 mb-4">
              <Shield className="w-8 h-8 text-white drop-shadow-sm" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Degree Planner
            </h1>
            <p className="text-foreground-secondary">
              Plan your academic journey with confidence
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleSignIn}
              disabled={isLoading}
              className="group relative w-full flex items-center justify-center gap-3 bg-surface rounded-xl px-6 py-3 text-foreground font-medium border border-border hover:border-border-strong hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 rounded-xl" />
              {isLoading ? (
                <div className="relative w-5 h-5 border-2 border-border-strong border-t-primary rounded-full animate-spin" />
              ) : (
                <span className="relative inline-flex items-center justify-center gap-3">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </span>
              )}
            </button>

            <div className="pt-4 border-t border-border">
              <div className="flex items-start gap-2 text-sm text-foreground-secondary">
                <LogIn className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>
                  Only authorized users can access the degree planner. Please use your institutional email to sign in.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-foreground-secondary">
          <p>
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
