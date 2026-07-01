"use client";

import dynamic from "next/dynamic";

// SSR is enabled (no `ssr: false`) so the dashboard content is server-rendered
// into the initial HTML instead of appearing only after client hydration + a
// client fetch. Still code-split via dynamic() to keep it out of shared chunks.
const DashboardOverviewInner = dynamic(
  () => import("@/components/DashboardOverview").then((m) => ({ default: m.DashboardOverview })),
  {
    loading: () => (
      <div className="space-y-4 animate-pulse">
        <div className="h-48 bg-surface rounded-xl border border-border" />
        <div className="h-28 bg-surface rounded-xl border border-border" />
      </div>
    ),
  }
);

export { DashboardOverviewInner as DashboardOverview };
