"use client";

import { useState } from "react";
import { Clock3, Power, RefreshCw, ShieldCheck } from "lucide-react";

type MaintenanceStatus = {
  active: boolean;
  endsAt: string | null;
  message: string | null;
};

export function ShutdownControl({ initialStatus }: { initialStatus: MaintenanceStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [durationMinutes, setDurationMinutes] = useState("15");
  const [message, setMessage] = useState("We are safely moving app data. Please check back shortly.");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (action: "start" | "stop") => {
    setSaving(true);
    setError(null);
    try {
      const body = action === "start"
        ? { action, durationMinutes: Number(durationMinutes), message }
        : { action };
      const response = await fetch("/api/maintenance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update shutdown mode");
      setStatus(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update shutdown mode");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">B23243 control</p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">Temporary shutdown mode</h1>
        <p className="mt-2 text-foreground-secondary">
          Use this during the database move. Students see a full-screen countdown and can only submit feedback until it ends.
        </p>
      </div>

      <div className={`rounded-2xl border p-5 ${status.active ? "border-amber-500/40 bg-amber-500/10" : "border-border bg-surface"}`}>
        <div className="flex items-start gap-3">
          <ShieldCheck className={`mt-0.5 h-5 w-5 ${status.active ? "text-amber-600" : "text-emerald-600"}`} />
          <div>
            <p className="font-semibold text-foreground">{status.active ? "Shutdown is active" : "App is accepting normal access"}</p>
            <p className="mt-1 text-sm text-foreground-secondary">
              {status.active && status.endsAt
                ? `Students are paused until ${new Date(status.endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
                : "No student-facing shutdown is currently running."}
            </p>
          </div>
        </div>
      </div>

      <div className="dp-card p-6">
        <label htmlFor="shutdown-duration" className="mb-2 block text-sm font-medium text-foreground">
          Shutdown duration (minutes)
        </label>
        <div className="flex gap-3">
          <input
            id="shutdown-duration"
            type="number"
            min={1}
            max={240}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
            className="dp-field w-32"
          />
          <div className="flex items-center text-sm text-foreground-secondary"><Clock3 className="mr-2 h-4 w-4" />1–240 minutes</div>
        </div>

        <label htmlFor="shutdown-message" className="mb-2 mt-5 block text-sm font-medium text-foreground">
          Message for students (optional)
        </label>
        <textarea
          id="shutdown-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={280}
          rows={3}
          className="dp-field w-full resize-none"
        />

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void update("start")}
            disabled={saving}
            className="dp-btn dp-btn-primary"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            {status.active ? "Restart countdown" : "Start shutdown"}
          </button>
          {status.active && (
            <button
              type="button"
              onClick={() => void update("stop")}
              disabled={saving}
              className="dp-btn dp-btn-outline"
            >
              End shutdown now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
