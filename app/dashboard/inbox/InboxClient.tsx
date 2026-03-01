"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Loader2, RefreshCw, Trash2 } from "lucide-react";

import { useToast } from "@/components/ToastProvider";

type SupportTicketType = "CONTACT" | "SUGGESTION" | "ISSUE" | "FEEDBACK";
type SupportTicketStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";

type SupportTicketAdmin = {
  id: string;
  type: SupportTicketType;
  subject: string;
  message: string;
  pageUrl?: string | null;
  status: SupportTicketStatus;
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    name?: string | null;
    email?: string | null;
    enrollmentId?: string | null;
  };
};

type CourseSuggestionStatus = "PENDING" | "APPROVED" | "REJECTED" | "ACKNOWLEDGED" | string;

type CourseSuggestionAdmin = {
  id: string;
  suggestedCategory: string;
  currentCategory: string;
  reason?: string | null;
  status: CourseSuggestionStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  enrollmentId?: string | null;
  semester?: number | null;
  year?: number | null;
  term?: string | null;
  createdAt: string;
  user: {
    name?: string | null;
    email?: string | null;
    enrollmentId?: string | null;
  };
  course: {
    code: string;
    name: string;
  };
};

type Tab = "tickets" | "overrides";

const STATUS_OPTIONS: SupportTicketStatus[] = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"];
const SUGGESTION_STATUS_OPTIONS: Array<CourseSuggestionStatus> = [
  "PENDING",
  "ACKNOWLEDGED",
  "APPROVED",
  "REJECTED",
];

function pillClasses(value: string) {
  const v = value.toUpperCase();
  if (v.includes("OPEN") || v.includes("PENDING")) return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20";
  if (v.includes("REVIEW") || v.includes("ACK")) return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
  if (v.includes("RESOLVED") || v.includes("APPROVED")) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
  if (v.includes("REJECT") || v.includes("CLOSED")) return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20";
  return "bg-surface-hover text-foreground-secondary border-border";
}

export default function InboxClient() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("tickets");
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<SupportTicketAdmin[]>([]);
  const [suggestions, setSuggestions] = useState<CourseSuggestionAdmin[]>([]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        fetch("/api/support?all=1"),
        fetch("/api/course-suggestions?all=1"),
      ]);

      if (!tRes.ok) throw new Error("Failed to load tickets");
      if (!sRes.ok) throw new Error("Failed to load course suggestions");

      const tData = (await tRes.json()) as SupportTicketAdmin[];
      const sData = (await sRes.json()) as CourseSuggestionAdmin[];
      setTickets(tData);
      setSuggestions(sData);
    } catch (error) {
      console.error(error);
      showToast("error", "Failed to load admin inbox");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ticketCount = tickets.length;
  const suggestionCount = suggestions.length;

  const openTicketCount = useMemo(
    () => tickets.filter((t) => t.status === "OPEN" || t.status === "IN_REVIEW").length,
    [tickets]
  );

  const pendingSuggestionCount = useMemo(
    () => suggestions.filter((s) => s.status === "PENDING").length,
    [suggestions]
  );

  const updateTicket = async (id: string, patch: Partial<Pick<SupportTicketAdmin, "status" | "adminNote">>) => {
    const res = await fetch(`/api/support/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Failed to update ticket");
    return (await res.json()) as SupportTicketAdmin;
  };

  const updateSuggestion = async (id: string, status: CourseSuggestionStatus) => {
    const res = await fetch(`/api/course-suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update suggestion");
    return (await res.json()) as CourseSuggestionAdmin;
  };

  const deleteTicket = async (id: string) => {
    if (!window.confirm("Delete this ticket permanently?")) return;
    try {
      const res = await fetch(`/api/support/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setTickets((cur) => cur.filter((t) => t.id !== id));
      showToast("success", "Ticket deleted");
    } catch {
      showToast("error", "Failed to delete ticket");
    }
  };

  const deleteSuggestion = async (id: string) => {
    if (!window.confirm("Delete this override request permanently?")) return;
    try {
      const res = await fetch(`/api/course-suggestions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setSuggestions((cur) => cur.filter((s) => s.id !== id));
      showToast("success", "Override deleted");
    } catch {
      showToast("error", "Failed to delete override");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Admin Inbox</h1>
            <p className="text-foreground-secondary mt-2">
              Review support messages and course-type overrides.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-background hover:bg-surface-hover text-sm text-foreground"
          >
            <RefreshCw className="w-4 h-4 text-foreground-secondary" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs text-foreground-secondary">Support tickets</p>
            <p className="text-2xl font-bold text-foreground mt-1">{ticketCount}</p>
            <p className="text-xs text-foreground-secondary mt-1">{openTicketCount} open</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs text-foreground-secondary">Course overrides</p>
            <p className="text-2xl font-bold text-foreground mt-1">{suggestionCount}</p>
            <p className="text-xs text-foreground-secondary mt-1">{pendingSuggestionCount} pending</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-surface rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setTab("tickets")}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === "tickets" ? "bg-primary/10 text-primary" : "text-foreground-secondary hover:text-foreground"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Tickets
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("overrides")}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === "overrides" ? "bg-primary/10 text-primary" : "text-foreground-secondary hover:text-foreground"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Course Overrides
          </span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-foreground-secondary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading…
        </div>
      ) : tab === "tickets" ? (
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <div className="text-sm text-foreground-secondary text-center py-10 bg-surface rounded-2xl border border-border">
              No tickets.
            </div>
          ) : (
            tickets.map((t) => (
              <details key={t.id} className="group rounded-2xl border border-border bg-surface">
                <summary className="cursor-pointer list-none p-4 sm:p-5 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{t.subject}</p>
                    <p className="text-xs text-foreground-secondary mt-1">
                      {t.user?.enrollmentId || t.user?.email || "Unknown user"} • {t.type} •{" "}
                      {new Date(t.createdAt).toLocaleString()}
                      {t.pageUrl ? ` • ${t.pageUrl}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-1 rounded-lg border text-xs font-semibold ${pillClasses(t.status)}`}>
                      {t.status}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); deleteTicket(t.id); }}
                      className="p-1.5 rounded-lg text-foreground-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete ticket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </summary>

                <div className="px-4 sm:px-5 pb-5 pt-0 space-y-3">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-semibold text-foreground">Message</p>
                    <p className="text-sm text-foreground-secondary mt-2 whitespace-pre-wrap">{t.message}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-2">Status</label>
                      <select
                        value={t.status}
                        onChange={async (e) => {
                          const next = e.target.value as SupportTicketStatus;
                          const prev = t.status;
                          setTickets((cur) => cur.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
                          try {
                            await updateTicket(t.id, { status: next });
                            showToast("success", "Updated ticket");
                          } catch (err) {
                            console.error(err);
                            setTickets((cur) => cur.map((x) => (x.id === t.id ? { ...x, status: prev } : x)));
                            showToast("error", "Failed to update ticket");
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-2">Admin note</label>
                      <textarea
                        defaultValue={t.adminNote || ""}
                        rows={2}
                        placeholder="Optional reply / internal note…"
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm resize-none"
                        onBlur={async (e) => {
                          const next = e.target.value.trim() || null;
                          const prev = t.adminNote || null;
                          if (next === prev) return;
                          setTickets((cur) => cur.map((x) => (x.id === t.id ? { ...x, adminNote: next } : x)));
                          try {
                            await updateTicket(t.id, { adminNote: next });
                            showToast("success", "Saved note");
                          } catch (err) {
                            console.error(err);
                            setTickets((cur) => cur.map((x) => (x.id === t.id ? { ...x, adminNote: prev } : x)));
                            showToast("error", "Failed to save note");
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </details>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <div className="text-sm text-foreground-secondary text-center py-10 bg-surface rounded-2xl border border-border">
              No overrides.
            </div>
          ) : (
            suggestions.map((s) => (
              <details key={s.id} className="group rounded-2xl border border-border bg-surface">
                <summary className="cursor-pointer list-none p-4 sm:p-5 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {s.course.code} • {s.suggestedCategory} (was {s.currentCategory})
                    </p>
                    <p className="text-xs text-foreground-secondary mt-1">
                      {s.user?.enrollmentId || s.user?.email || "Unknown user"} •{" "}
                      {new Date(s.createdAt).toLocaleString()}
                      {s.semester ? ` • Sem ${s.semester}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-1 rounded-lg border text-xs font-semibold ${pillClasses(s.status)}`}>
                      {s.status}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); deleteSuggestion(s.id); }}
                      className="p-1.5 rounded-lg text-foreground-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete override"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </summary>

                <div className="px-4 sm:px-5 pb-5 pt-0 space-y-3">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-semibold text-foreground">Course</p>
                    <p className="text-sm text-foreground-secondary mt-2">
                      {s.course.code} — {s.course.name}
                    </p>
                    <p className="text-xs text-foreground-secondary mt-2">
                      Suggested: <span className="font-semibold text-foreground">{s.suggestedCategory}</span> •
                      Current: <span className="font-semibold text-foreground"> {s.currentCategory}</span>
                    </p>
                    {s.enrollmentId && (
                      <p className="text-xs text-foreground-secondary mt-2">Enrollment ID: {s.enrollmentId}</p>
                    )}
                    {s.reason && (
                      <p className="text-sm text-foreground-secondary mt-3 whitespace-pre-wrap">{s.reason}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-2">Status</label>
                      <select
                        value={SUGGESTION_STATUS_OPTIONS.includes(s.status) ? s.status : "ACKNOWLEDGED"}
                        onChange={async (e) => {
                          const next = e.target.value as CourseSuggestionStatus;
                          const prev = s.status;
                          setSuggestions((cur) => cur.map((x) => (x.id === s.id ? { ...x, status: next } : x)));
                          try {
                            await updateSuggestion(s.id, next);
                            showToast("success", "Updated override");
                          } catch (err) {
                            console.error(err);
                            setSuggestions((cur) => cur.map((x) => (x.id === s.id ? { ...x, status: prev } : x)));
                            showToast("error", "Failed to update override");
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm"
                      >
                        {SUGGESTION_STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-xl border border-border bg-background p-4 text-xs text-foreground-secondary">
                      <p>
                        Use this list to audit when a student sets a course type that differs from the default mapping.
                        Their roll number, time, and course details are stored with the entry.
                      </p>
                    </div>
                  </div>
                </div>
              </details>
            ))
          )}
        </div>
      )}
    </div>
  );
}
