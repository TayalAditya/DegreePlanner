import { Shield, LogIn } from "lucide-react";
import { Suspense } from "react";
import { SignInButton } from "./SignInButton";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        <div className="bg-surface rounded-2xl border border-border shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl border border-primary/20 mb-4">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Degree Planner
            </h1>
            <p className="text-foreground-secondary">
              Plan your academic journey with confidence
            </p>
          </div>

          <div className="space-y-4">
            <Suspense fallback={
              <div className="w-full rounded-xl border border-border bg-background-secondary px-6 py-3 text-center text-foreground-secondary">
                Loading sign in...
              </div>
            }>
              <SignInButton />
            </Suspense>

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

        <div className="mt-6 text-center text-sm text-foreground-secondary">
          <p>
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
