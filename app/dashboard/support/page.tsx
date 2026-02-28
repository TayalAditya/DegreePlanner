"use client";

import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { Bug, Lightbulb, Mail, MessageCircle, Send } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { useToast } from "@/components/ToastProvider";

type SupportTicket = {
  id: string;
  type: "CONTACT" | "SUGGESTION" | "ISSUE" | "FEEDBACK";
  subject: string;
  message: string;
  pageUrl?: string | null;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
};

const TYPE_OPTIONS: Array<{
  value: SupportTicket["type"];
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { value: "CONTACT", label: "Contact", description: "General help or questions", icon: Mail },
  { value: "SUGGESTION", label: "Suggestion", description: "Feature or improvement request", icon: Lightbulb },
  { value: "ISSUE", label: "Report Issue", description: "Something not working / bug", icon: Bug },
  { value: "FEEDBACK", label: "Feedback", description: "Share thoughts on the app", icon: MessageCircle },
];

export default function SupportPage() {
  const { showToast } = useToast();
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";
  const searchParams = useSearchParams();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState<SupportTicket["type"]>("ISSUE");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const typeMeta = useMemo(() => TYPE_OPTIONS.find((t) => t.value === type), [type]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/support");
      if (!res.ok) throw new Error("Failed to load tickets");
      const data = (await res.json()) as SupportTicket[];
      setTickets(data);
    } catch (error) {
      console.error(error);
      showToast("error", "Failed to load your messages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const qType = searchParams.get("type");
    if (!qType) return;
    if (TYPE_OPTIONS.some((t) => t.value === qType)) {
      setType(qType as SupportTicket["type"]);
    }
  }, [searchParams]);

  const submit = async () => {
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (trimmedSubject.length < 3) {
      showToast("warning", "Subject is too short");
      return;
    }
    if (trimmedMessage.length < 10) {
      showToast("warning", "Message is too short");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          subject: trimmedSubject,
          message: trimmedMessage,
          pageUrl: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast("error", err?.error || "Failed to send message");
        return;
      }

      showToast("success", "Sent! We’ll review it soon.");
      setSubject("");
      setMessage("");
      await loadTickets();
    } catch (error) {
      console.error(error);
      showToast("error", "Failed to send message");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-foreground">Support & Feedback</h1>
        <p className="text-foreground-secondary mt-2">
          Contact us, suggest improvements, or report issues — directly inside the app.
        </p>
        {supportEmail && (
          <p className="text-sm text-foreground-secondary mt-3">
            Or email: <span className="font-medium text-foreground">{supportEmail}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-surface rounded-2xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Send a message</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = opt.value === type;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setType(opt.value)}
                      className={`text-left rounded-xl border px-3 py-3 transition-colors ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:bg-surface-hover"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className={`w-5 h-5 mt-0.5 ${selected ? "text-primary" : "text-foreground-secondary"}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                          <p className="text-xs text-foreground-secondary">{opt.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={typeMeta ? `${typeMeta.label}: short summary` : "Short summary"}
                className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary text-foreground"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="Add details (steps to reproduce, expected vs actual, etc.)"
                className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary text-foreground resize-none"
              />
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Sending..." : "Send"}
            </button>
          </div>
        </div>

        <div className="lg:col-span-3 bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-foreground">Your messages</h2>
            <button
              type="button"
              onClick={loadTickets}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background hover:bg-surface-hover text-sm text-foreground"
            >
              <MessageCircle className="w-4 h-4 text-foreground-secondary" />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-foreground-secondary py-8 text-center">Loading…</div>
          ) : tickets.length === 0 ? (
            <div className="text-sm text-foreground-secondary py-10 text-center">
              No messages yet.
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{t.subject}</p>
                      <p className="text-xs text-foreground-secondary mt-1">
                        {t.type} • {t.status} • {new Date(t.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-foreground mt-3 whitespace-pre-wrap">{t.message}</p>
                  {t.adminNote && (
                    <div className="mt-3 rounded-lg border border-border bg-surface p-3">
                      <p className="text-xs font-semibold text-foreground">Admin note</p>
                      <p className="text-sm text-foreground-secondary mt-1 whitespace-pre-wrap">
                        {t.adminNote}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
