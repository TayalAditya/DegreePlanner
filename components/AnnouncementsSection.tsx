"use client";

import { X, Bell, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionHeader } from "./SectionHeader";

interface Announcement {
  id: string;
  type: "info" | "warning" | "success" | "alert";
  title: string;
  message: string;
  dismissible?: boolean;
  timestamp?: Date;
}

const defaultAnnouncements: Announcement[] = [
  {
    id: "1",
    type: "info",
    title: "Welcome to Degree Planner",
    message: "Track your academic progress, plan courses, and manage your degree journey all in one place.",
    dismissible: false,
    timestamp: new Date(),
  },
];

const typeConfig = {
  info: {
    bg: "bg-info/10",
    border: "border-info/30",
    icon: "text-info",
    Icon: Info,
  },
  warning: {
    bg: "bg-warning/10",
    border: "border-warning/30",
    icon: "text-warning",
    Icon: AlertCircle,
  },
  success: {
    bg: "bg-success/10",
    border: "border-success/30",
    icon: "text-success",
    Icon: CheckCircle2,
  },
  alert: {
    bg: "bg-error/10",
    border: "border-error/30",
    icon: "text-error",
    Icon: AlertCircle,
  },
};

interface AnnouncementsSectionProps {
  announcements?: Announcement[];
}

export function AnnouncementsSection({
  announcements = defaultAnnouncements,
}: AnnouncementsSectionProps) {
  const [visibleAnnouncements, setVisibleAnnouncements] =
    useState<Announcement[]>(announcements);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setVisibleAnnouncements(
      announcements.filter((a) => !dismissedIds.has(a.id))
    );
  }, [announcements, dismissedIds]);

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  if (visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Announcements" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <AnimatePresence mode="popLayout">
          {visibleAnnouncements.map((announcement, index) => {
            const config = typeConfig[announcement.type];
            const IconComponent = config.Icon;

            return (
              <motion.div
                key={announcement.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`${config.bg} border ${config.border} rounded-xl p-3.5 sm:p-4 backdrop-blur-sm`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-5 h-5 sm:w-6 sm:h-6 ${config.icon} flex-shrink-0 mt-0.5`}
                  >
                    <IconComponent className="w-full h-full" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-foreground">
                      {announcement.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-foreground-secondary mt-0.5 sm:mt-1">
                      {announcement.message}
                    </p>
                  </div>

                  {announcement.dismissible && (
                    <button
                      onClick={() => handleDismiss(announcement.id)}
                      className="flex-shrink-0 p-1 hover:bg-foreground/5 rounded-lg transition-colors"
                      aria-label="Dismiss announcement"
                    >
                      <X className="w-4 h-4 text-foreground-secondary hover:text-foreground" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
