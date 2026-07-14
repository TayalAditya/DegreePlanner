"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

// Show the nudge at most once per ~30 days.
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const LS_KEY = "pmd.🌟.feedback_spotlight_seen";

// How long the tab must sit idle (no meaningful interaction) before we nudge.
const IDLE_MS = 6000;

const TRIGGER_ID = "feedback-trigger-btn";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function dueForNudge(): boolean {
  try {
    const last = localStorage.getItem(LS_KEY);
    if (!last) return true;
    return Date.now() - Number(last) > COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(LS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function FeedbackSpotlight() {
  const { data: session } = useSession();
  const [rect, setRect] = useState<Rect | null>(null);

  const dismiss = useCallback(() => {
    markSeen();
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
    if (!dueForNudge()) return;

    let idleTimer: number | undefined;

    const arm = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        const btn = document.getElementById(TRIGGER_ID);
        if (!btn) return;
        const r = btn.getBoundingClientRect();
        // Bail if the button is hidden (e.g. off-screen / mobile menu closed).
        if (r.width === 0 || r.height === 0) return;
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }, IDLE_MS);
    };

    // Reset the idle countdown on interaction so we only nudge a quiet screen.
    const events: Array<keyof DocumentEventMap> = ["mousemove", "keydown", "scroll", "touchstart"];
    const onActivity = () => {
      if (!rect) arm();
    };
    events.forEach((e) => document.addEventListener(e, onActivity, { passive: true }));
    arm();

    return () => {
      window.clearTimeout(idleTimer);
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
