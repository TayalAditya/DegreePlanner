"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, MessageSquareHeart, Send, Star } from "lucide-react";

const FEEDBACK_OPTIONS = [
  { key: "useful", label: "Useful" },
  { key: "love", label: "Love it" },
  { key: "improve", label: "Needs improvement" },
  { key: "great_ux", label: "Great UX" },
] as const;

type MaintenanceScreenProps = {
  endsAt: string;
  message?: string | null;
};

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function MaintenanceScreen({ endsAt, message }: MaintenanceScreenProps) {
  const endTime = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const [now, setNow] = useState(() => Date.now());
  const [rating, setRating] = useState<number | null>(null);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackState, setFeedbackState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const remaining = Math.max(0, endTime - now);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (remaining > 0) return;
    const timeout = window.setTimeout(() => window.location.reload(), 800);
    return () => window.clearTimeout(timeout);
  }, [remaining]);

  const submitFeedback = async () => {
    if (!rating) return;

    setFeedbackState("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          emoji: emoji || undefined,
          message: feedback.trim() || undefined,
        }),
      });

      if (!response.ok) throw new Error("Feedback submission failed");
      setFeedbackState("sent");
      setRating(null);
      setFeedback("");
      setEmoji(null);
    } catch {
      setFeedbackState("error");
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-primary/30 px-4 py-8 text-white">
      <div className="mx-auto flex min-h-full max-w-xl items-center py-6">
        <div className="w-full rounded-3xl border border-white/15 bg-slate-950/75 p-6 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary ring-1 ring-primary/40">
            <Clock3 className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Temporary maintenance</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            PlanMyDegree will be back shortly
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-300">
            We&apos;re safely moving app data. Your courses and preferences are temporarily locked so nothing is missed during the switch.
          </p>

          {message && (
            <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-200">
              {message}
            </p>
          )}

          <div className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
            <p className="text-sm font-medium text-slate-300">Access returns in</p>
            <p className="mt-1 font-mono text-5xl font-bold tracking-tight text-white" aria-live="polite">
              {remaining > 0 ? formatRemaining(remaining) : "00:00"}
            </p>
            <p className="mt-2 text-xs text-slate-400">This page will refresh automatically when the timer ends.</p>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            <div className="flex items-center gap-2">
              <MessageSquareHeart className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">While you wait, share feedback</h2>
            </div>
            <p className="mt-1 text-sm text-slate-300">What should we improve next?</p>

            <div className="mt-4">
              <p className="text-sm font-medium text-white">Rate your experience</p>
              <div className="mt-2 flex items-center gap-1.5" aria-label="Star rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className="rounded-md p-1 text-amber-300 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                    aria-pressed={rating === value}
                  >
                    <Star className="h-7 w-7" fill={rating !== null && value <= rating ? "currentColor" : "none"} />
                  </button>
                ))}
                <span className="ml-2 text-xs text-slate-400">{rating ? `${rating}/5` : "Required"}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {FEEDBACK_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setEmoji((current) => current === option.key ? null : option.key)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    emoji === option.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Feature request, issue, or a small suggestion..."
              className="mt-4 w-full resize-none rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className={`text-xs ${feedbackState === "error" ? "text-red-300" : "text-slate-400"}`}>
                {feedbackState === "sent"
                  ? "Thanks — your feedback was saved."
                  : feedbackState === "error"
                  ? "Could not save feedback. Please try again."
                  : "A star rating is required. Feedback is saved even while maintenance is active."}
              </p>
              <button
                type="button"
                onClick={submitFeedback}
                disabled={feedbackState === "sending" || !rating}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {feedbackState === "sending" ? "Sending" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
