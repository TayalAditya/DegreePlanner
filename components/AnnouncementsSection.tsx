"use client";

import { X, Bell, Info } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author: { name: string | null };
}

export function AnnouncementsSection() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Shares cache key with NotificationBell — no duplicate network request
  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: async () => {
      const res = await fetch("/api/announcements");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const visible = announcements.filter((a) => !dismissed.has(a.id));

  if (isLoading || visible.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-foreground-secondary" />
        <p className="text-sm font-semibold text-foreground">Announcements</p>
      </div>

      <>
        {visible.map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-3 bg-info/8 border border-info/25 rounded-xl px-4 py-3 transition-opacity duration-150"
          >
            <Info className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{a.title}</p>
              <p className="text-xs text-foreground-secondary mt-0.5 leading-relaxed">{a.content}</p>
              {a.author?.name && (
                <p className="text-[10px] text-foreground-muted mt-1.5">— {a.author.name}</p>
              )}
            </div>
            <button
              onClick={() => setDismissed((p) => new Set([...p, a.id]))}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-foreground/5 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5 text-foreground-muted hover:text-foreground" />
            </button>
          </div>
        ))}
      </>
    </div>
  );
}
