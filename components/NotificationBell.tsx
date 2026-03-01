"use client";

import { Bell, X, Megaphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author: { name: string | null };
}

const LS_KEY = "announcementsLastSeen";

function getLastSeen(): number {
  try {
    return parseInt(localStorage.getItem(LS_KEY) || "0", 10);
  } catch {
    return 0;
  }
}

function setLastSeen() {
  try {
    localStorage.setItem(LS_KEY, Date.now().toString());
  } catch {}
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeenState] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLastSeenState(getLastSeen());
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const { data: announcements = [], refetch } = useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: async () => {
      const res = await fetch("/api/announcements");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const unread = announcements.filter(
    (a) => new Date(a.createdAt).getTime() > lastSeen
  ).length;

  function openPanel() {
    setOpen(true);
    setLastSeen();
    setLastSeenState(Date.now());
    refetch();
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={openPanel}
        aria-label="Notifications"
        className="relative inline-flex items-center justify-center p-2 rounded-lg border border-border bg-card text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" />
              Announcements
            </span>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded text-foreground-secondary hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {announcements.length === 0 ? (
              <p className="px-4 py-8 text-sm text-center text-foreground-secondary">
                No announcements yet.
              </p>
            ) : (
              announcements.map((a) => {
                const isNew = new Date(a.createdAt).getTime() > lastSeen;
                return (
                  <div key={a.id} className={`px-4 py-3 ${isNew ? "bg-primary/5" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground leading-snug">
                        {a.title}
                        {isNew && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase bg-red-500 text-white rounded-full leading-none align-middle">
                            NEW
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-xs text-foreground-secondary mt-0.5 leading-relaxed">
                      {a.content}
                    </p>
                    <p className="text-[10px] text-foreground-secondary/60 mt-1.5">
                      {a.author.name} · {new Date(a.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
