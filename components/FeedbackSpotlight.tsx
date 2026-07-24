"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

// Once the user actually submits feedback, stay quiet for 15 days.
const REVIEWED_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000;
// Until then, keep nudging — but leave a 5 min gap between appearances.
const NUDGE_INTERVAL_MS = 5 * 60 * 1000;

// Last time we showed/dismissed the nudge. This is only UI pacing, so keeping
// it per-device in localStorage is fine — the "already reviewed" decision is
// made server-side against the user's account (see hasReviewedRecently).
const SHOWN_KEY = "pmd.🌟.feedback_spotlight_seen";

// How long the tab must sit idle (no meaningful interaction) before we nudge.
const IDLE_MS = 6000;

const TRIGGER_ID = "feedback-trigger-btn";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Server truth: has this user (on any device) left feedback in the last 15 days?
async function hasReviewedRecently(): Promise<boolean> {
  try {
    const res = await fetch("/api/feedback", { cache: "no-store" });
    if (!res.ok) return false;
    const rows: Array<{ createdAt?: string }> = await res.json();
    const latest = rows?.[0]?.createdAt ? new Date(rows[0].createdAt).getTime() : 0;
    return latest > 0 && Date.now() - latest < REVIEWED_COOLDOWN_MS;
  } catch {
    return false;
  }
}

// Local pacing gate only — the 5 min gap between nudges on this device.
function pacedRecently(): boolean {
  try {
    const shown = localStorage.getItem(SHOWN_KEY);
    return !!shown && Date.now() - Number(shown) < NUDGE_INTERVAL_MS;
  } catch {
    return false;
  }
}

function markShown() {
  try {
    localStorage.setItem(SHOWN_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function FeedbackSpotlight() {
  const { data: session } = useSession();
  const [rect, setRect] = useState<Rect | null>(null);
  // Cached server truth: is the user inside their 15-day post-review quiet
  // window? null = not yet known (don't nudge until we've checked).
  const reviewedRef = useRef<boolean | null>(null);

  const dismiss = useCallback(() => {
    markShown();
    setRect(null);
  }, []);

  const openFeedback = useCallback(() => {
    // The trigger button already owns the open/cooldown logic — reuse it.
    const btn = document.getElementById(TRIGGER_ID) as HTMLButtonElement | null;
    dismiss();
    btn?.click();
  }, [dismiss]);

  useEffect(() => {
    if (!session?.user) return;
    // Already showing — the reposition effect owns it.
    if (rect) return;

    let idleTimer: number | undefined;
    let cancelled = false;

    const arm = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        // Server says they reviewed recently, or we nudged <5 min ago — skip.
        if (reviewedRef.current !== false) return;
        if (pacedRecently()) return;
        const btn = document.getElementById(TRIGGER_ID);
        if (!btn) return;
        const r = btn.getBoundingClientRect();
        // Bail if the button is hidden (e.g. off-screen / mobile menu closed).
        if (r.width === 0 || r.height === 0) return;
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }, IDLE_MS);
    };

    // Refresh the server-side "reviewed recently" flag, then re-arm.
    const refresh = async () => {
      reviewedRef.current = await hasReviewedRecently();
      if (!cancelled) arm();
    };

    // Reset the idle countdown on interaction so we only nudge a quiet screen.
    const events: Array<keyof DocumentEventMap> = ["mousemove", "keydown", "scroll", "touchstart"];
    const onActivity = () => arm();
    events.forEach((e) => document.addEventListener(e, onActivity, { passive: true }));

    // Re-check on a cadence so the nudge reappears after its 5 min gap
    // (and picks up reviews made on other devices) without a page reload.
    const poll = window.setInterval(refresh, NUDGE_INTERVAL_MS);
    refresh();

    return () => {
      cancelled = true;
      window.clearTimeout(idleTimer);
      window.clearInterval(poll);
      events.forEach((e) => document.removeEventListener(e, onActivity));
    };
  }, [session?.user, rect]);

  // Keep the cutout aligned if the viewport changes while the nudge is up.
  useEffect(() => {
    if (!rect) return;
    const reposition = () => {
      const btn = document.getElementById(TRIGGER_ID);
      if (!btn) return dismiss();
      const r = btn.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition);
      window.removeEventListener("keydown", onKey);
    };
  }, [rect, dismiss]);

  if (!rect) return null;

  const pad = 8;
  const holeTop = rect.top - pad;
  const holeLeft = rect.left - pad;
  const holeW = rect.width + pad * 2;
  const holeH = rect.height + pad * 2;
  const holeCenterX = holeLeft + holeW / 2;

  // Tooltip card sits below the button, nudged to stay on-screen.
  const cardWidth = 260;
  const cardTop = holeTop + holeH + 18;
  let cardLeft = holeCenterX - cardWidth / 2;
  if (typeof window !== "undefined") {
    cardLeft = Math.max(12, Math.min(cardLeft, window.innerWidth - cardWidth - 12));
  }

  return (
    <div className="fixed inset-0 z-[60] animate-fade-in" role="dialog" aria-label="Feedback nudge">
      {/* Dimmed backdrop with a transparent cutout punched via box-shadow. */}
      <button
        type="button"
        aria-label="Give feedback"
        onClick={openFeedback}
        className="absolute rounded-xl cursor-pointer"
        style={{
          top: holeTop,
          left: holeLeft,
          width: holeW,
          height: holeH,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          outline: "2px solid var(--primary)",
          outlineOffset: "2px",
          animation: "pulse 2s ease-in-out infinite",
        }}
      />

      {/* Click anywhere else to dismiss (does not open feedback). */}
      <div className="absolute inset-0 -z-[1]" onClick={dismiss} />

      {/* Arrow pointing up at the button, in the user's palette colour. */}
      <div
        className="absolute"
        style={{
          top: cardTop - 12,
          left: holeCenterX - 8,
          width: 0,
          height: 0,
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderBottom: "12px solid var(--primary)",
        }}
      />

      {/* Tooltip card framed in the palette colour. */}
      <div
        className="absolute rounded-xl p-4 shadow-xl animate-scale-in"
        style={{
          top: cardTop,
          left: cardLeft,
          width: cardWidth,
          background: "var(--surface, #fff)",
          border: "2px solid var(--primary)",
        }}
      >
        <p className="text-sm font-semibold text-foreground mb-1">Enjoying PlanMyDegree? ✨</p>
        <p className="text-xs text-foreground-secondary mb-3">
          Tap the highlighted button to drop us a quick line — it really helps! 🙏
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="text-xs px-3 py-1.5 rounded-lg text-foreground-secondary hover:bg-surface-hover transition-colors"
          >
            Maybe later
          </button>
          <button
            type="button"
            onClick={openFeedback}
            className="text-xs px-3 py-1.5 rounded-lg font-medium text-primary-foreground bg-primary hover:bg-primary-hover transition-colors"
          >
            Give feedback
          </button>
        </div>
      </div>
    </div>
  );
}
