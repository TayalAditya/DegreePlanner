"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BATCHES = [
  { value: 2025, label: "B25" },
  { value: 2024, label: "B24" },
  { value: 2023, label: "B23" },
  { value: 2022, label: "B22" },
];

const BRANCHES = [
  { code: "CSE",     name: "Computer Science & Engineering",         type: "BTech" },
  { code: "DSE",     name: "Data Science & Engineering",             type: "BTech" },
  { code: "DSAI",    name: "Data Science & AI",                      type: "BTech" },
  { code: "MEVLSI",  name: "Microelectronics & VLSI",                type: "BTech" },
  { code: "EE",      name: "Electrical Engineering",                 type: "BTech" },
  { code: "MNC",     name: "Mathematics & Computing",                type: "BTech" },
  { code: "CE",      name: "Civil Engineering",                      type: "BTech" },
  { code: "BE",      name: "Bioengineering",                         type: "BTech" },
  { code: "EP",      name: "Engineering Physics",                    type: "BTech" },
  { code: "ME",      name: "Mechanical Engineering",                 type: "BTech" },
  { code: "MSE",     name: "Materials Science & Engineering",        type: "BTech" },
  { code: "GE",      name: "General Engineering",                    type: "BTech" },
  { code: "GE-MECH", name: "General Engineering (Mechatronics)",     type: "BTech" },
  { code: "GE-COMM", name: "General Engineering (Comm. Technology)", type: "BTech" },
  { code: "GE-ROBO", name: "General Engineering (AI & Robotics)",    type: "BTech" },
  { code: "GE-FIN",  name: "General Engineering (Fintech)",          type: "BTech" },
  { code: "BSCS",    name: "Chemical Sciences",                      type: "BS"    },
];

export function ImpersonateSelector() {
  const router = useRouter();
  const [batch, setBatch] = useState<number | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!batch || !branch) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/user/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch, branch }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Setup failed");
      }

      // Mark setup done for this browser session
      sessionStorage.setItem("acadSecSetup", "1");
      // Full reload so session/layout picks up new branch/batch
      router.refresh();
      window.location.href = "/dashboard";
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Academic Secretary — View as Student</h2>
          <p className="text-sm text-foreground-secondary mt-1">
            Select a batch and branch to preview the student experience. All data resets on each login.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Batch selector */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Select Batch</p>
            <div className="grid grid-cols-4 gap-2">
              {BATCHES.map((b) => (
                <button
                  key={b.value}
                  onClick={() => setBatch(b.value)}
                  className={`py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                    batch === b.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background-secondary text-foreground-secondary hover:border-primary/40"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Branch selector */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Select Branch</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {BRANCHES.map((br) => (
                <button
                  key={br.code}
                  onClick={() => setBranch(br.code)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border-2 text-sm text-left transition-all ${
                    branch === br.code
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background-secondary hover:border-primary/40"
                  }`}
                >
                  <span className={branch === br.code ? "text-primary font-medium" : "text-foreground"}>
                    {br.name}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-mono ml-2 flex-shrink-0 ${
                    br.type === "BS"
                      ? "bg-purple-500/10 text-purple-500"
                      : "bg-primary/10 text-primary"
                  }`}>
                    {br.code}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Confirm */}
          <button
            onClick={handleConfirm}
            disabled={!batch || !branch || loading}
            className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            {loading
              ? "Setting up…"
              : batch && branch
              ? `View as ${BATCHES.find(b => b.value === batch)?.label} · ${branch}`
              : "Select batch and branch to continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
