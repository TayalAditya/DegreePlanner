"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Megaphone, Plus, Search, Pencil, Trash2, RotateCcw, X } from "lucide-react";

import { useToast } from "@/components/ToastProvider";
import { useConfirmDialog } from "@/components/ConfirmDialog";

type AnnouncementRecord = {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  author: { name: string | null };
};

type AnnouncementModalState =
  | { mode: "create" }
  | { mode: "edit"; announcement: AnnouncementRecord };

function AnnouncementModal({
  state,
  reducedMotion,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  state: AnnouncementModalState;
  reducedMotion: boolean;
  onClose: () => void;
  onSubmit: (payload: { title: string; content: string; isActive?: boolean }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const initial = state.mode === "edit" ? state.announcement : null;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  return (
    <motion.div
      key="announcement-modal"
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={state.mode === "edit" ? "Edit announcement" : "New announcement"}
    >
      <motion.div
        initial={reducedMotion ? { opacity: 1 } : { scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { scale: 0.98, opacity: 0 }}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            {state.mode === "edit" ? "Edit Announcement" : "New Announcement"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground-secondary mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title..."
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground-secondary mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your message..."
              rows={6}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {state.mode === "edit" && (
            <label className="flex items-center gap-2 text-sm text-foreground-secondary select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus-visible:ring-4 focus-visible:ring-primary/20"
              />
              Active
            </label>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border bg-surface text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ title, content, ...(state.mode === "edit" ? { isActive } : {}) })}
            className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : state.mode === "edit" ? "Save" : "Post"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AnnouncementsAdminClient() {
  const reducedMotion = useReducedMotion() ?? false;
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState<AnnouncementModalState | null>(null);

  const { data, isLoading, isError } = useQuery<AnnouncementRecord[]>({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const res = await fetch("/api/admin/announcements");
      if (!res.ok) throw new Error("Failed to load announcements");
      return res.json();
    },
  });

  const visible = useMemo(() => {
    const announcements = Array.isArray(data) ? data : [];
    const q = search.trim().toLowerCase();
    return announcements.filter((a) => {
      if (!showInactive && !a.isActive) return false;
      if (!q) return true;
      const author = (a.author?.name ?? "").toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        author.includes(q)
      );
    });
  }, [data, search, showInactive]);

  const createMutation = useMutation({
    mutationFn: async (payload: { title: string; content: string }) => {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Failed to post announcement");
      return body;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      await qc.invalidateQueries({ queryKey: ["announcements"] });
      showToast("success", "Announcement posted");
      setModal(null);
    },
    onError: (err: any) => showToast("error", err?.message || "Failed to post"),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; title: string; content: string; isActive: boolean }) => {
      const res = await fetch(`/api/announcements/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: payload.title, content: payload.content, isActive: payload.isActive }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Failed to update announcement");
      return body;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      await qc.invalidateQueries({ queryKey: ["announcements"] });
      showToast("success", "Announcement updated");
      setModal(null);
    },
    onError: (err: any) => showToast("error", err?.message || "Failed to update"),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Failed to deactivate announcement");
      return body;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      await qc.invalidateQueries({ queryKey: ["announcements"] });
      showToast("success", "Announcement deactivated");
    },
    onError: (err: any) => showToast("error", err?.message || "Failed to deactivate"),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Failed to restore announcement");
      return body;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      await qc.invalidateQueries({ queryKey: ["announcements"] });
      showToast("success", "Announcement restored");
    },
    onError: (err: any) => showToast("error", err?.message || "Failed to restore"),
  });

  return (
    <div className="space-y-5">
      <AnimatePresence>
        {modal && (
          <AnnouncementModal
            state={modal}
            reducedMotion={reducedMotion}
            onClose={() => setModal(null)}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            onSubmit={async (payload) => {
              const title = payload.title.trim();
              const content = payload.content.trim();

              if (!title) {
                showToast("warning", "Title is required");
                return;
              }
              if (!content) {
                showToast("warning", "Content is required");
                return;
              }

              if (modal.mode === "create") {
                await createMutation.mutateAsync({ title, content });
              } else {
                await updateMutation.mutateAsync({
                  id: modal.announcement.id,
                  title,
                  content,
                  isActive: payload.isActive ?? modal.announcement.isActive,
                });
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" />
            Announcements
          </h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Post and edit announcements visible to all users
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="Search title, content, author..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <label className="flex items-center gap-2 px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground-secondary select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus-visible:ring-4 focus-visible:ring-primary/20"
          />
          Show inactive
        </label>
      </div>

      {/* List */}
      {isError ? (
        <div className="bg-surface border border-border rounded-xl p-6">
          <p className="text-error font-medium">Failed to load announcements.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-background-secondary dark:bg-surface rounded-xl animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <p className="text-foreground-secondary">No announcements found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((a) => (
            <div key={a.id} className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        a.isActive
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-warning/10 text-warning border-warning/20"
                      }`}
                    >
                      {a.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      {new Date(a.createdAt).toLocaleString()}
                      {a.author?.name ? ` · ${a.author.name}` : ""}
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">{a.title}</p>
                  <p className="text-sm text-foreground-secondary mt-1 whitespace-pre-wrap line-clamp-3">
                    {a.content}
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setModal({ mode: "edit", announcement: a })}
                    className="p-2 rounded-lg hover:bg-surface-hover text-foreground-secondary hover:text-foreground transition-colors"
                    aria-label="Edit announcement"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  {a.isActive ? (
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Deactivate announcement?",
                          message: `This will hide "${a.title}" from users.`,
                          confirmText: "Deactivate",
                          cancelText: "Cancel",
                          variant: "warning",
                        });
                        if (!ok) return;
                        deactivateMutation.mutate(a.id);
                      }}
                      className="p-2 rounded-lg hover:bg-surface-hover text-red-500 hover:text-red-600 transition-colors"
                      aria-label="Deactivate announcement"
                      title="Deactivate"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => restoreMutation.mutate(a.id)}
                      className="p-2 rounded-lg hover:bg-surface-hover text-foreground-secondary hover:text-foreground transition-colors"
                      aria-label="Restore announcement"
                      title="Restore"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
