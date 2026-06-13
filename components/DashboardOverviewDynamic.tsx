"use client";

import dynamic from "next/dynamic";

const DashboardOverviewInner = dynamic(
  () => import("@/components/DashboardOverview").then((m) => ({ default: m.DashboardOverview })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4 animate-pulse">
        <div className="h-48 bg-surface rounded-xl border border-border" />
        <div className="h-28 bg-surface rounded-xl border border-border" />
      </div>
    ),
  }
);

export { DashboardOverviewInner as DashboardOverview };
