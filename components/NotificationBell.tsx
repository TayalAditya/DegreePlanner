"use client";

import { Bell, X, Megaphone, MessageSquare } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author: { name: string | null };
}

interface UserNotification {
  id: string;
  title: string;
  content: string;
  isRead: boolean;
  ticketId: string | null;
  createdAt: string;
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
  const [tab, setTab] = useState<"notifications" | "announcements">("notifications");
  const [lastSeen, setLastSeenState] = useState(() =>
    typeof window === "undefined" ? 0 : getLastSeen()
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

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

  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: async () => {
      const res = await fetch("/api/announcements");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const { data: notifications = [], refetch: refetchNotifs } = useQuery<UserNotification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const unreadAnnouncements = announcements.filter(
    (a) => new Date(a.createdAt).getTime() > lastSeen
  ).length;
  const unreadNotifications = notifications.filter((n) => !n.isRead).length;
  const totalUnread = unreadAnnouncements + unreadNotifications;

  function openPanel() {
    setOpen(true);
    setLastSeen();
    setLastSeenState(Date.now());
    refetchNotifs();
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    queryClient.setQueryData<UserNotification[]>(["notifications"], (old = []) =>
      old.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.isRead);
    await Promise.all(
      unread.map((n) => fetch(`/api/notifications/${n.id}/read`, { method: "POST" }))
    );
    queryClient.setQueryData<UserNotification[]>(["notifications"], (old = []) =>
      old.map((n) => ({ ...n, isRead: true }))
    );
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={openPanel}
        aria-label="Notifications"
        className="relative inline-flex items-center justify-center p-2 rounded-lg border border-border bg-card text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      >
        <Bell className="w-5 h-5" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded text-foreground-secondary hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border text-xs font-medium">
            <button
              onClick={() => setTab("notifications")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${
                tab === "notifications"
                  ? "text-primary border-b-2 border-primary"
                  : "text-foreground-secondary hover:text-foreground"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Replies
              {unreadNotifications > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("announcements")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${
                tab === "announcements"
                  ? "text-primary border-b-2 border-primary"
                  : "text-foreground-secondary hover:text-foreground"
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              Announcements
              {unreadAnnouncements > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadAnnouncements}
                </span>
              )}
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {tab === "notifications" ? (
              notifications.length === 0 ? (
                <p className="px-4 py-8 text-sm text-center text-foreground-secondary">
                  No replies yet.
                </p>
              ) : (
                <>
                  {unreadNotifications > 0 && (
                    <div className="px-4 py-2 flex justify-end border-b border-border">
                      <button
                        onClick={markAllRead}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Mark all as read
                      </button>
                    </div>
                  )}
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.isRead && markRead(n.id)}
                      className={`px-4 py-3 cursor-pointer hover:bg-surface-hover transition-colors ${
                        !n.isRead ? "bg-primary/5" : ""
                      }`}
                    >
                      <p className="text-sm font-semibold text-foreground leading-snug">
                        {n.title}
                        {!n.isRead && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase bg-red-500 text-white rounded-full leading-none align-middle">
                            NEW
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-foreground-secondary mt-0.5 leading-relaxed line-clamp-3">
                        {n.content}
                      </p>
                      <p className="text-[10px] text-foreground-secondary/60 mt-1.5">
                        {new Date(n.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  ))}
                </>
              )
            ) : announcements.length === 0 ? (
              <p className="px-4 py-8 text-sm text-center text-foreground-secondary">
                No announcements yet.
              </p>
            ) : (
              announcements.map((a) => {
                const isNew = new Date(a.createdAt).getTime() > lastSeen;
                return (
                  <div key={a.id} className={`px-4 py-3 ${isNew ? "bg-primary/5" : ""}`}>
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      {a.title}
                      {isNew && (
                        <span className="ml-2 inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase bg-red-500 text-white rounded-full leading-none align-middle">
                          NEW
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-foreground-secondary mt-0.5 leading-relaxed">
                      {a.content}
                    </p>
                    <p className="text-[10px] text-foreground-secondary/60 mt-1.5">
                      {a.author.name} ·{" "}
                      {new Date(a.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
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
