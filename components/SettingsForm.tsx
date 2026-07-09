"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Mail, BookOpen, Save, Palette, Check, Share2, Copy, RefreshCw, Link as LinkIcon } from "lucide-react";
import { getAllBranches } from "@/lib/branches";
import { useTheme } from "./ThemeProvider";
import { useToast } from "./ToastProvider";
import { copyToClipboard } from "@/lib/utils";

interface SettingsFormProps {
  user: any;
  initialShareState?: {
    isProfileShared: boolean;
    shareToken: string | null;
  };
}

export function SettingsForm({ user, initialShareState }: SettingsFormProps) {
  const { palette, setPalette } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const branches = getAllBranches();
  
  const [formData, setFormData] = useState({
    name: user.name || "",
    email: user.email || "",
    enrollmentId: user.enrollmentId || "",
    branch: user.branch || "",
  });
  const [shareState, setShareState] = useState<{
    isProfileShared: boolean;
    shareToken: string | null;
  }>({
    isProfileShared: initialShareState?.isProfileShared ?? false,
    shareToken: initialShareState?.shareToken ?? null,
  });
  const [shareLoading, setShareLoading] = useState(!initialShareState);
  const [shareOrigin, setShareOrigin] = useState("");
  const shareUrl =
    shareOrigin && shareState.shareToken
      ? `${shareOrigin}/share/${shareState.shareToken}`
      : "";

  const paletteOptions = [
    { value: "default" as const, label: "Default", swatches: ["#4f46e5", "#7c3aed", "#14b8a6"] },
    { value: "ocean" as const, label: "Ocean", swatches: ["#0284c7", "#06b6d4", "#14b8a6"] },
    { value: "sunset" as const, label: "Sunset", swatches: ["#f97316", "#db2777", "#8b5cf6"] },
    { value: "forest" as const, label: "Forest", swatches: ["#16a34a", "#84cc16", "#14b8a6"] },
  ];

  useEffect(() => {
    setShareOrigin(window.location.origin);

    const loadSettings = async () => {
      try {
        const res = await fetch("/api/user/settings");
        if (!res.ok) return;
        const data = await res.json();
        setFormData({
          name: data.name || "",
          email: data.email || "",
          enrollmentId: data.enrollmentId || "",
          branch: data.branch || "",
        });
      } catch {
        // ignore fetch errors, keep session defaults
      }
    };

    const loadShareSettings = async () => {
      try {
        const res = await fetch("/api/user/share", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setShareState({
          isProfileShared: Boolean(data.isProfileShared),
          shareToken: data.shareToken ?? null,
        });
      } catch {
        // ignore fetch errors, keep default off state
      } finally {
        setShareLoading(false);
      }
    };

    loadSettings();
    if (!initialShareState) {
      loadShareSettings();
    }
  }, [initialShareState]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      router.refresh();
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (action: "toggle" | "regenerate") => {
      const res = await fetch("/api/user/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed to update profile sharing");
      return {
        action,
        data: await res.json(),
      };
    },
    onSuccess: ({ action, data }) => {
      setShareState({
        isProfileShared: Boolean(data.isProfileShared),
        shareToken: data.shareToken ?? null,
      });
      if (action === "regenerate") {
        showToast("success", "Share link regenerated");
      } else {
        showToast("success", data.isProfileShared ? "Profile sharing enabled" : "Profile sharing disabled");
      }
    },
    onError: () => {
      showToast("error", "Could not update profile sharing");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    const copied = await copyToClipboard(shareUrl);
    showToast(copied ? "success" : "error", copied ? "Link copied!" : "Could not copy link");
  };

  const isGeFamily = (b: string) => b === "GE" || b.startsWith("GE-");

  const GE_SPECIALIZATIONS = [
    { code: "GE", label: "Open Specialization (no named track)" },
    { code: "GE-ROBO", label: "AI & Robotics" },
    { code: "GE-MECH", label: "Mechatronics & AI" },
    { code: "GE-COMM", label: "Communications Technology" },
    { code: "GE-FIN", label: "Fintech (under development)" },
  ];

  const handleSpecChange = (newBranch: string) => {
    if (newBranch === formData.branch) return;
    const ok = window.confirm(
      "Changing your General Engineering specialization updates which courses count as " +
        "Discipline Core / Discipline Elective and your credit requirements. Continue?"
    );
    if (!ok) return;
    setFormData({ ...formData, branch: newBranch });
    updateMutation.mutate({ ...formData, branch: newBranch });
  };

  return (
    <div className="max-w-2xl mx-auto w-full">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Appearance */}
        <div className="bg-surface dark:bg-surface rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Appearance
          </h3>
          <p className="text-sm text-foreground-secondary mb-4">
            Choose an accent palette (applies across the app).
          </p>

          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3">
            {paletteOptions.map((opt) => {
              const selected = palette === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPalette(opt.value)}
                  aria-pressed={selected}
                  className={`text-left rounded-xl border px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-surface-hover"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                    {selected && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {opt.swatches.map((c) => (
                      <span
                        key={c}
                        className="w-3 h-3 rounded-full border border-border"
                        style={{ backgroundColor: c }}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-foreground-secondary">
            Tip: You can also switch palettes from the sidebar appearance buttons.
          </p>
        </div>

        {/* Profile Sharing */}
        <div className="bg-surface dark:bg-surface rounded-lg border border-border p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                <Share2 className="w-4 h-4" />
                Profile Sharing
              </h3>
              <p className="text-sm text-foreground-secondary">
                Create a login-protected read-only profile link for IIT Mandi students.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={shareState.isProfileShared}
              onClick={() => shareMutation.mutate("toggle")}
              disabled={shareLoading || shareMutation.isPending}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-60 ${
                shareState.isProfileShared
                  ? "border-primary bg-primary"
                  : "border-border bg-background-secondary"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  shareState.isProfileShared ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-background-secondary/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {shareLoading
                    ? "Loading share status"
                    : shareState.isProfileShared
                      ? "Sharing is on"
                      : "Sharing is off"}
                </p>
                <p className="text-xs text-foreground-secondary">
                  {shareState.isProfileShared
                    ? "Anyone with the link must sign in with a student Google account."
                    : "Enable sharing to generate a stable profile link."}
                </p>
              </div>
              {shareMutation.isPending && (
                <RefreshCw className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
              )}
            </div>

            {shareState.isProfileShared && (
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-medium text-foreground">
                  Share link
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1 min-w-0">
                    <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-secondary" />
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    disabled={!shareUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => shareMutation.mutate("regenerate")}
                    disabled={shareMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                  >
                    <RefreshCw className={`w-4 h-4 ${shareMutation.isPending ? "animate-spin" : ""}`} />
                    Regenerate
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-surface dark:bg-surface rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Personal Information
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Full Name
                </div>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-md bg-surface text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </div>
              </label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-2 border border-border rounded-md bg-background-secondary dark:bg-background text-foreground-secondary cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-foreground-secondary">
                Email cannot be changed as it&apos;s linked to your Google account
              </p>
            </div>
          </div>
        </div>

        {/* Academic Information */}
        <div className="bg-surface dark:bg-surface rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Academic Information
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Enrollment ID
                </div>
              </label>
              <input
                type="text"
                value={formData.enrollmentId}
                onChange={(e) => setFormData({ ...formData, enrollmentId: e.target.value })}
                disabled
                className="w-full px-4 py-2 border border-border rounded-md bg-background-secondary dark:bg-background text-foreground-secondary cursor-not-allowed"
                placeholder="e.g., 2020XXXXXX"
              />
              <p className="mt-1 text-xs text-foreground-secondary">
                Enrollment ID cannot be changed.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Branch / Program
              </label>
              <select
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                disabled
                className="w-full px-4 py-2 border border-border rounded-md bg-background-secondary dark:bg-background text-foreground-secondary cursor-not-allowed"
                required
              >
                <option value="">Select your branch</option>
                {branches.map((branch) => (
                  <option key={branch.code} value={branch.code}>
                    {branch.name} ({branch.type})
                  </option>
                ))}
              </select>
              {formData.branch && (
                <div className="mt-2 p-3 bg-primary bg-opacity-10 dark:bg-opacity-20 border border-primary border-opacity-20 rounded-md">
                  <p className="text-sm text-foreground">
                    <strong>Credit Requirements:</strong>
                  </p>
                  <ul className="mt-1 text-sm text-foreground-secondary space-y-1">
                    {(() => {
                      const selected = branches.find((b) => b.code === formData.branch);
                      if (!selected) return null;
                      return (
                        <>
                          <li>Total: {selected.totalCredits} credits</li>
                          <li>DC: {selected.dcCredits} credits</li>
                          <li>DE: {selected.deCredits} credits</li>
                          <li>FE: {selected.feCredits} credits</li>
                        </>
                      );
                    })()}
                  </ul>
                </div>
              )}
            </div>

            {/* GE Specialization selector — editable, only for GE-family students */}
            {isGeFamily(formData.branch) && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    GE Specialization
                  </div>
                </label>
                <select
                  value={formData.branch}
                  onChange={(e) => handleSpecChange(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-md bg-surface text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {GE_SPECIALIZATIONS.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-foreground-secondary">
                  You can change this until you finalize your specialization. Open Specialization
                  has no Discipline Electives — its DE credits merge into Free Electives.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
          {updateMutation.isError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Failed to update settings. Please try again.
            </p>
          )}
          {updateMutation.isSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400">
              Settings updated successfully!
            </p>
          )}
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="w-full sm:w-auto px-6 py-2 bg-primary text-white rounded-md font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
