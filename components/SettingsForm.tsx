"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Mail, BookOpen, Save } from "lucide-react";
import { getAllBranches } from "@/lib/branches";

interface SettingsFormProps {
  user: any;
}

export function SettingsForm({ user }: SettingsFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const branches = getAllBranches();
  
  const [formData, setFormData] = useState({
    name: user.name || "",
    email: user.email || "",
    enrollmentId: user.enrollmentId || "",
    branch: user.branch || "",
  });

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
    <div className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
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
                Email cannot be changed as it's linked to your Google account
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
                className="w-full px-4 py-2 border border-border rounded-md bg-surface text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g., 2020XXXXXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Branch / Program
              </label>
              <select
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-md bg-surface text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
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

        {/* Save Button */}
        <div className="flex items-center justify-end gap-4">
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
            className="px-6 py-2 bg-primary text-white rounded-md font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
