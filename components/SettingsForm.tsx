"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Mail, BookOpen, Save, Bug, Lightbulb, Palette, Check } from "lucide-react";
import { getAllBranches } from "@/lib/branches";
import { useTheme } from "./ThemeProvider";

interface SettingsFormProps {
  user: any;
}

export function SettingsForm({ user }: SettingsFormProps) {
  const { palette, setPalette } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const branches = getAllBranches();
  
  const [formData, setFormData] = useState({
    name: user.name || "",
    email: user.email || "",
    enrollmentId: user.enrollmentId || "",
    branch: user.branch || "",
    doingMTP: user.doingMTP ?? true,
    doingISTP: user.doingISTP ?? false,
  });

  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";

  const paletteOptions = [
    { value: "default" as const, label: "Default", swatches: ["#6366f1", "#ec4899", "#14b8a6"] },
    { value: "ocean" as const, label: "Ocean", swatches: ["#0284c7", "#06b6d4", "#14b8a6"] },
    { value: "sunset" as const, label: "Sunset", swatches: ["#f97316", "#db2777", "#8b5cf6"] },
    { value: "forest" as const, label: "Forest", swatches: ["#16a34a", "#84cc16", "#14b8a6"] },
  ];

  useEffect(() => {
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
          doingMTP: data.doingMTP ?? true,
          doingISTP: data.doingISTP ?? false,
        });
      } catch {
        // ignore fetch errors, keep session defaults
      }
    };

    loadSettings();
  }, []);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
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
            Tip: You can also cycle palettes from the theme button in the sidebar.
          </p>
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
          </div>
        </div>

        {/* Project Preferences */}
        <div className="bg-surface dark:bg-surface rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Terminal Project Preferences
          </h3>
          
          <div className="space-y-4">
            <label
              htmlFor="doingMTP"
              className="flex items-start gap-4 p-4 bg-background-secondary dark:bg-background rounded-lg border-2 border-border hover:border-primary/50 transition-colors cursor-pointer focus-within:ring-4 focus-within:ring-primary/20"
            >
              <input
                type="checkbox"
                id="doingMTP"
                checked={formData.doingMTP}
                onChange={(e) => setFormData({ ...formData, doingMTP: e.target.checked })}
                className="mt-1 w-5 h-5 accent-primary bg-surface border-2 border-border rounded focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
              />
              <div className="flex-1">
                <span className="block font-semibold text-foreground hover:text-primary transition-colors">
                  Major Technical Project (MTP)
                </span>
                <p className="text-sm text-foreground-secondary mt-1">
                  8 credits (MTP-1: 3 credits + MTP-2: 5 credits)
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 font-medium">
                  ⚠️ If unchecked: +8 credits will be added to Discipline Electives (DE)
                </p>
              </div>
            </label>

            <label
              htmlFor="doingISTP"
              className="flex items-start gap-4 p-4 bg-background-secondary dark:bg-background rounded-lg border-2 border-border hover:border-primary/50 transition-colors cursor-pointer focus-within:ring-4 focus-within:ring-primary/20"
            >
              <input
                type="checkbox"
                id="doingISTP"
                checked={formData.doingISTP}
                onChange={(e) => setFormData({ ...formData, doingISTP: e.target.checked })}
                className="mt-1 w-5 h-5 accent-primary bg-surface border-2 border-border rounded focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
              />
              <div className="flex-1">
                <span className="block font-semibold text-foreground hover:text-primary transition-colors">
                  Interactive Socio-Technical Practicum (ISTP)
                </span>
                <p className="text-sm text-foreground-secondary mt-1">
                  4 credits (6th semester practicum)
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 font-medium">
                  ⚠️ If unchecked: +4 credits will be added to Free Electives (FE)
                </p>
              </div>
            </label>

            <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Note:</strong> These preferences affect your credit distribution. You can change them anytime before course registration.
              </p>
            </div>
          </div>
        </div>

        {/* Support */}
        <div className="bg-surface dark:bg-surface rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Support & Feedback
          </h3>
          <p className="text-sm text-foreground-secondary mb-4">
            Share suggestions, report issues, or contact us for help.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/dashboard/support?type=CONTACT"
              className="group flex items-start gap-3 rounded-lg border border-border bg-surface-hover/50 p-4 hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">Contact</p>
                </div>
                <p className="text-xs text-foreground-secondary">
                  {supportEmail ? `Email: ${supportEmail}` : "Message the admin inside the app"}
                </p>
              </div>
            </Link>

            <Link
              href="/dashboard/support?type=SUGGESTION"
              className="group flex items-start gap-3 rounded-lg border border-border bg-surface-hover/50 p-4 hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">Suggestion</p>
                </div>
                <p className="text-xs text-foreground-secondary">
                  Request a feature or improvement
                </p>
              </div>
            </Link>

            <Link
              href="/dashboard/support?type=ISSUE"
              className="group flex items-start gap-3 rounded-lg border border-border bg-surface-hover/50 p-4 hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <Bug className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">Report Issue</p>
                </div>
                <p className="text-xs text-foreground-secondary">
                  Something broken? Tell us
                </p>
              </div>
            </Link>
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
