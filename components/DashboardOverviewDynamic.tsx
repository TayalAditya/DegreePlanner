"use client";

// Direct re-export (no next/dynamic). The dashboard's main content is the LCP
// element, so keeping it in a lazy chunk forced mobile clients to download the
// page JS, THEN discover + fetch a second chunk before it could paint. Importing
// it directly folds it into the server-rendered HTML and the main client chunk,
// which paints the LCP block sooner. The component has no browser-only top-level
// code (localStorage reads are SSR-guarded), so SSR is safe.
export { DashboardOverview } from "@/components/DashboardOverview";
