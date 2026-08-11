"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

// Once the user actually submits feedback, stay quiet for 15 days.
const REVIEWED_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000;
// Until then, leave a five-minute gap between prompts.
const NUDGE_INTERVAL_MS = 5 * 60 * 1000;
const SHOWN_KEY = "pmd.feedback.nudge_seen";
const IDLE_MS = 6000;
const TRIGGER_ID = "feedback-trigger-btn";

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
    // Local pacing is optional.
  }
}

export function FeedbackSpotlight() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const reviewedRef = useRef<boolean | null>(null);

  const dismiss = useCallback(() => {
    markShown();
    setOpen(false);
  }, []);

  const openFeedback = useCallback(() => {
    dismiss();
    (document.getElementById(TRIGGER_ID) as HTMLButtonElement | null)?.click();
  }, [dismiss]);

  useEffect(() => {
    if (!session?.user || open) return;

    let idleTimer: number | undefined;
    let cancelled = false;
    const arm = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        if (reviewedRef.current !== false || pacedRecently()) return;
        if (!document.getElementById(TRIGGER_ID)) return;
        setOpen(true);
      }, IDLE_MS);
    };
    const refresh = async () => {
      reviewedRef.current = await hasReviewedRecently();
      if (!cancelled) arm();
    };
    const events: Array<keyof DocumentEventMap> = ["mousemove", "keydown", "scroll", "touchstart"];
    const onActivity = () => arm();
    events.forEach((event) => document.addEventListener(event, onActivity, { passive: true }));
    const poll = window.setInterval(refresh, NUDGE_INTERVAL_MS);
    refresh();

    return () => {
      cancelled = true;
      window.clearTimeout(idleTimer);
      window.clearInterval(poll);
      events.forEach((event) => document.removeEventListener(event, onActivity));
    };
  }, [session?.user, open]);

  if (!open) return null;

  return (
    <aside
      className="fixed right-4 top-20 z-[60] w-[min(19rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-4 shadow-lg"
      aria-label="Feedback prompt"
    >
      <p className="text-sm font-semibold text-foreground">Have feedback?</p>
      <p className="mt-1 text-xs leading-relaxed text-foreground-secondary">
        A quick note helps make the planner clearer and more useful.
      </p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-3 py-1.5 text-xs text-foreground-secondary transition-colors hover:bg-surface-hover"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={openFeedback}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Give feedback
        </button>
      </div>
    </aside>
  );
}
