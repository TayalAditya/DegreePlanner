"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { MessageSquareHeart, X, Send, Star } from "lucide-react";
import { useToast } from "./ToastProvider";

const EMOJI_OPTIONS = [
  { key: "useful", emoji: "🎯", label: "Useful" },
  { key: "love", emoji: "❤️", label: "Love it" },
  { key: "improve", emoji: "💡", label: "Improve" },
  { key: "great_ux", emoji: "🚀", label: "Great UX" },
] as const;

const COOLDOWN_MS = 12 * 60 * 60 * 1000;
const LS_KEY = "pmd.🌟.last_vibe_check";

function canSubmit(): boolean {
  try {
    const last = localStorage.getItem(LS_KEY);
    if (!last) return true;
    return Date.now() - Number(last) > COOLDOWN_MS;
  } catch {
    return true;
  }
}

export function FeedbackButton() {
  const { data: session } = useSession();
  const { showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  if (!session?.user) return null;

  const user = session.user as { name?: string | null; enrollmentId?: string | null; branch?: string | null };

  const handleOpen = () => {
    if (!canSubmit()) {
      showToast("info", "You've already shared feedback recently — try again in a bit! 🙏");
      return;
    }
    setOpen(true);
    setRating(0);
    setHoverRating(0);
    setSelectedEmoji(null);
    setMessage("");
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      showToast("warning", "Please select a star rating ⭐");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          emoji: selectedEmoji || undefined,
          message: message.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");

      try { localStorage.setItem(LS_KEY, String(Date.now())); } catch {}

      setOpen(false);
      setShowBurst(true);
      setTimeout(() => setShowBurst(false), 1000);
      showToast("success", "Thanks for your feedback! 🌟");
    } catch {
      showToast("error", "Could not submit feedback — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <>
      {/* Floating button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="fixed bottom-6 left-6 z-40 inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-hover focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 active:scale-95 transition-all duration-150 no-print"
        aria-label="Give feedback"
      >
        <MessageSquareHeart className="w-5 h-5" />
        {showBurst && (
          <span className="absolute inset-0 rounded-full animate-feedback-burst pointer-events-none" />
        )}
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in no-print">
          <div className="dp-card shadow-xl max-w-md w-full animate-scale-in">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    How&apos;s PlanMyDegree? ✨
                  </h3>
                  <p className="text-sm text-foreground-secondary mt-1">
                    Your feedback helps us improve!
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="dp-icon-btn min-h-0 min-w-0 w-9 h-9 border-transparent bg-transparent hover:bg-surface-hover"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User info */}
              <div className="flex items-center gap-2 text-xs text-foreground-secondary bg-surface-hover/50 rounded-lg px-3 py-2 mb-5">
                <span className="font-medium text-foreground">{user.name || "Student"}</span>
                <span>·</span>
                <span>{user.enrollmentId || "—"}</span>
                <span>·</span>
                <span>{user.branch || "—"}</span>
              </div>

              {/* Star rating */}
              <div className="mb-5">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Rate your experience
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform duration-150 hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
                      aria-label={`${star} star${star !== 1 ? "s" : ""}`}
                    >
                      <Star
                        className={`w-7 h-7 transition-colors duration-150 ${
                          star <= displayRating
                            ? "text-amber-400 fill-amber-400"
                            : "text-foreground-secondary/30"
                        } ${star === displayRating ? "animate-star-pop" : ""}`}
                      />
                    </button>
                  ))}
                  {displayRating > 0 && (
                    <span className="ml-2 text-sm text-foreground-secondary">
                      {["", "Needs work", "Okay", "Good", "Great", "Amazing!"][displayRating]}
                    </span>
                  )}
                </div>
              </div>

              {/* Emoji reactions */}
              <div className="mb-5">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Quick reaction
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() =>
                        setSelectedEmoji(selectedEmoji === opt.key ? null : opt.key)
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all duration-150 ${
                        selectedEmoji === opt.key
                          ? "border-primary bg-primary/10 text-primary shadow-sm scale-105"
                          : "border-border bg-surface hover:bg-surface-hover text-foreground-secondary hover:text-foreground"
                      }`}
                    >
                      <span className="text-base">{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div className="mb-6">
                <label
                  htmlFor="feedback-message"
                  className="text-sm font-medium text-foreground mb-2 block"
                >
                  Suggestions or comments
                </label>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What can we do better? Any features you'd love to see?"
                  rows={3}
                  maxLength={2000}
                  className="dp-input w-full resize-none"
                />
                {message.length > 0 && (
                  <p className="text-xs text-foreground-secondary mt-1 text-right">
                    {message.length}/2000
                  </p>
                )}
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setOpen(false)}
                  className="dp-btn dp-btn-outline"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || rating === 0}
                  className="dp-btn dp-btn-primary"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      Submit Feedback
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
