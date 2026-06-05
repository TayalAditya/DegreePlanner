"use client";

import { useState } from "react";
import { Upload, Trash2, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

interface UploadResult {
  success: boolean;
  total: number;
  matched: number;
  unmatched: number;
  inserted: number;
  updated: number;
}

const CURRENT_YEAR = new Date().getFullYear();
const SEMESTERS = [3, 5, 7];
const YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1];

export default function AdminPreRegistrationPage() {
  const [semester, setSemester] = useState(7);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [clearing, setClearing] = useState(false);
  const { showToast } = useToast();

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("semester", String(semester));
      fd.append("year", String(year));
      fd.append("replace", String(replace));

      const res = await fetch("/api/pre-registration/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { showToast("error", data.error ?? "Upload failed"); return; }
      setResult(data);
      showToast("success", `Uploaded ${data.total} offerings (${data.matched} matched to catalog)`);
    } catch {
      showToast("error", "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm(`Delete all offerings for Sem ${semester} ${year}?`)) return;
    setClearing(true);
    try {
      const res = await fetch(`/api/pre-registration/upload?semester=${semester}&year=${year}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) showToast("success", `Deleted ${data.deleted} offerings`);
      else showToast("error", data.error ?? "Failed");
      setResult(null);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pre-Registration Upload</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Upload the semester course offerings Excel/CSV for students to browse and select.
        </p>
      </div>

      {/* Format guide */}
      <div className="p-4 rounded-xl border border-info/20 bg-info/5 space-y-2">
        <p className="text-sm font-medium text-info flex items-center gap-2"><Info className="w-4 h-4" /> Expected column order (row 1 = header, skipped)</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-foreground-secondary font-mono">
          {[
            "A: Course Code *",
            "B: Instructor",
            "C: School",
            "D: Branches (CSE,EE or ALL)",
            "E: Eligible Sems (5/7)",
            "F: Slots (A1+TA1)",
            "G: LTPC (3-1-0-4)",
            "H: Credits (auto from LTPC)",
            "I: Curriculum Link",
            "J: Category Override (for new courses)",
          ].map((col) => (
            <span key={col}>{col}</span>
          ))}
        </div>
        <p className="text-xs text-foreground-secondary">
          Course name &amp; credits are auto-filled from catalog when course code matches.
        </p>
      </div>

      {/* Controls */}
      <div className="p-5 rounded-xl border border-border bg-surface space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Semester</label>
            <select
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
            >
              {SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
            >
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Excel / CSV File</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-foreground-secondary file:mr-3 file:px-3 file:py-1.5
              file:rounded-lg file:border file:border-border file:bg-surface-secondary
              file:text-sm file:font-medium file:text-foreground file:cursor-pointer
              file:hover:bg-surface hover:file:bg-surface"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm text-foreground">Replace existing offerings for this semester</span>
        </label>

        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
              bg-primary text-primary-foreground text-sm font-medium
              hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="w-4 h-4" /> Upload</>
            )}
          </button>
          <button
            onClick={handleClear}
            disabled={clearing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-error/30
              text-error text-sm font-medium hover:bg-error/5 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Clear
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="p-4 rounded-xl border border-success/20 bg-success/5 space-y-3">
          <p className="text-sm font-semibold text-success flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Upload successful
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["Total rows", result.total],
              ["Matched to catalog", result.matched],
              ["New / unmatched", result.unmatched],
              ["Inserted", result.inserted],
              ["Updated", result.updated],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between">
                <span className="text-foreground-secondary">{label}</span>
                <span className="font-medium text-foreground">{val}</span>
              </div>
            ))}
          </div>
          {result.unmatched > 0 && (
            <p className="text-xs text-warning flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {result.unmatched} course{result.unmatched > 1 ? "s" : ""} not found in catalog — add them first or specify category override in column J.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
