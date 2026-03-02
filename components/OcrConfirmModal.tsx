"use client";

import { useState, useMemo } from "react";
import { X, AlertCircle, CheckCircle2, Search } from "lucide-react";
import { DetectedCourse, normalizeCourseCode } from "@/lib/parseTranscript";
import { formatCourseCode } from "@/lib/utils";

interface CatalogCourse {
  id: string;
  code: string;
  name: string;
  credits: number;
  department: string;
}

interface ConfirmRow {
  id: string;           // unique per row
  rawCode: string;
  included: boolean;
  alreadyExists: boolean;   // already in DB or current course list
  catalogCourseId: string;  // "" = no match selected
  semester: number | "";
  courseType: string;
  grade: string;
  // display helpers
  detectedSemester?: number;
  detectedGrade?: string;
  matchedName?: string;
}

interface OcrConfirmModalProps {
  detected: DetectedCourse[];
  catalogCourses: CatalogCourse[];
  /** User's branch (e.g. "CSE", "EE") — used to guess DC vs DE */
  branch: string;
  /** Normalised keys already in DB: "MA222|3" */
  importedKeys: Set<string>;
  /** Normalised keys already in the current pending course list */
  pendingKeys: Set<string>;
  onConfirm: (rows: ConfirmRow[]) => void;
  onClose: () => void;
}

// Valid IIT Mandi course categories (no PE)
const COURSE_TYPE_OPTIONS = ["IC", "ICB", "DC", "DE", "HSS", "IKS", "FE", "MTP", "ISTP"];

/** DC prefixes per branch — anything else from a transcript is likely DE */
const BRANCH_DC_PREFIXES: Record<string, string[]> = {
  CSE:    ["CS", "MA", "PH", "CH"],
  DSE:    ["DS", "MA", "PH", "CH"],
  EE:     ["EE", "MA", "PH", "CH"],
  ME:     ["ME", "MA", "PH", "CH"],
  CE:     ["CE", "MA", "PH", "CH"],
  BE:     ["BE", "BIO", "MA", "PH", "CH"],
  EP:     ["PH", "MA", "CH"],
  MNC:    ["MA", "PH", "CH"],
  MSE:    ["MS", "MA", "PH", "CH"],
  MEVLSI: ["EE", "ME", "MA", "PH", "CH"],
  GERAI:  ["EE", "CS", "MA", "PH", "CH"],
  GECE:   ["EE", "CS", "MA", "PH", "CH"],
  GEMECH: ["ME", "EE", "MA", "PH", "CH"],
  BSCS:   ["CH", "MA", "PH"],
};

function guessCourseType(code: string, branch: string): string {
  const p = normalizeCourseCode(code);
  // Institutional courses — always IC/HSS/IKS regardless of branch
  if (p.startsWith("IC")) return "IC";
  if (p.startsWith("IK")) return "IKS";
  if (p.startsWith("HS")) return "HSS";
  if (p.startsWith("DP")) return p.includes("301") ? "ISTP" : "MTP";
  // Branch-specific DC prefixes
  const dcPrefixes = BRANCH_DC_PREFIXES[branch] ?? [];
  if (dcPrefixes.some((x) => p.startsWith(x))) return "DC";
  // Anything else on a transcript is most likely a Departmental Elective
  return "DE";
}

export function OcrConfirmModal({
  detected,
  catalogCourses,
  branch,
  importedKeys,
  pendingKeys,
  onConfirm,
  onClose,
}: OcrConfirmModalProps) {
  // Build a fast lookup: normalised code → catalog course
  const catalogByCode = useMemo(() => {
    const map = new Map<string, CatalogCourse>();
    catalogCourses.forEach((c) => {
      map.set(normalizeCourseCode(c.code), c);
    });
    return map;
  }, [catalogCourses]);

  // Initialise rows from detected courses, deduped by rawCode+semester
  const initialRows = useMemo<ConfirmRow[]>(() => {
    const seen = new Set<string>();
    return detected
      .filter((d) => {
        const key = `${normalizeCourseCode(d.rawCode)}|${d.detectedSemester ?? "?"}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((d, idx) => {
        const norm = normalizeCourseCode(d.rawCode);
        const catalogMatch = catalogByCode.get(norm);
        const semKey = `${norm}|${d.detectedSemester}`;
        const alreadyExists =
          importedKeys.has(semKey) || pendingKeys.has(semKey);

        return {
          id: `${norm}-${idx}`,
          rawCode: d.rawCode,
          included: !!catalogMatch && !alreadyExists,
          alreadyExists,
          catalogCourseId: catalogMatch?.id ?? "",
          semester: d.detectedSemester ?? "",
          courseType: guessCourseType(d.rawCode, branch),
          grade: d.detectedGrade ?? "",
          detectedSemester: d.detectedSemester,
          detectedGrade: d.detectedGrade,
          matchedName: catalogMatch?.name,
        };
      });
  }, [detected, catalogByCode, importedKeys, pendingKeys]);

  const [rows, setRows] = useState<ConfirmRow[]>(initialRows);
  const [search, setSearch] = useState("");

  const updateRow = (id: string, patch: Partial<ConfirmRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const includedCount = rows.filter((r) => r.included && !r.alreadyExists).length;

  const filteredRows = search.trim()
    ? rows.filter(
        (r) =>
          r.rawCode.toLowerCase().includes(search.toLowerCase()) ||
          (r.matchedName ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] bg-surface rounded-2xl border border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Confirm Detected Courses
            </h2>
            <p className="text-sm text-foreground-secondary mt-0.5">
              {rows.length} course{rows.length !== 1 ? "s" : ""} detected —{" "}
              {includedCount} selected
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-foreground/5 text-foreground-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter courses…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {filteredRows.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle className="w-10 h-10 text-foreground-muted mx-auto mb-3" />
              <p className="text-foreground-secondary">
                No courses detected. Try a clearer screenshot or a PDF export.
              </p>
            </div>
          )}

          {filteredRows.map((row) => (
            <div
              key={row.id}
              className={`rounded-xl border p-4 transition-colors ${
                row.alreadyExists
                  ? "border-border bg-background-secondary/50 opacity-60"
                  : row.included
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-background"
              }`}
            >
              {/* Top row: checkbox + code badge + match name */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={row.included}
                  disabled={row.alreadyExists}
                  onChange={(e) => updateRow(row.id, { included: e.target.checked })}
                  className="mt-1 accent-primary w-4 h-4 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {formatCourseCode(row.rawCode)}
                    </span>
                    {row.alreadyExists && (
                      <span className="flex items-center gap-1 text-xs text-success font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Already added
                      </span>
                    )}
                    {!row.catalogCourseId && !row.alreadyExists && (
                      <span className="text-xs text-warning font-medium">
                        ⚠ No catalog match
                      </span>
                    )}
                  </div>

                  {/* Matched course name */}
                  {row.matchedName && (
                    <p className="text-sm text-foreground-secondary mt-1 truncate">
                      {row.matchedName}
                    </p>
                  )}
                </div>
              </div>

              {/* Detail fields — only show if not already exists */}
              {!row.alreadyExists && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Catalog course selector */}
                  <div className="col-span-2 sm:col-span-2">
                    <label className="block text-xs text-foreground-secondary mb-1">
                      Matched course
                    </label>
                    <select
                      value={row.catalogCourseId}
                      onChange={(e) => {
                        const match = catalogCourses.find(
                          (c) => c.id === e.target.value
                        );
                        updateRow(row.id, {
                          catalogCourseId: e.target.value,
                          matchedName: match?.name,
                        });
                      }}
                      className="w-full px-2 py-1.5 rounded-lg border bg-background text-sm"
                    >
                      <option value="">— No match —</option>
                      {catalogCourses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {formatCourseCode(c.code)} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Semester */}
                  <div>
                    <label className="block text-xs text-foreground-secondary mb-1">
                      Semester
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={row.semester}
                      onChange={(e) =>
                        updateRow(row.id, {
                          semester:
                            e.target.value === ""
                              ? ""
                              : Math.min(8, Math.max(1, parseInt(e.target.value) || 1)),
                        })
                      }
                      placeholder="1–8"
                      className="w-full px-2 py-1.5 rounded-lg border bg-background text-sm"
                    />
                  </div>

                  {/* Course type */}
                  <div>
                    <label className="block text-xs text-foreground-secondary mb-1">
                      Course type
                    </label>
                    <select
                      value={row.courseType}
                      onChange={(e) =>
                        updateRow(row.id, { courseType: e.target.value })
                      }
                      className="w-full px-2 py-1.5 rounded-lg border bg-background text-sm"
                    >
                      {COURSE_TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Grade */}
                  <div>
                    <label className="block text-xs text-foreground-secondary mb-1">
                      Grade (optional)
                    </label>
                    <input
                      type="text"
                      value={row.grade}
                      onChange={(e) =>
                        updateRow(row.id, { grade: e.target.value.toUpperCase() })
                      }
                      placeholder="A, B, …"
                      maxLength={3}
                      className="w-full px-2 py-1.5 rounded-lg border bg-background text-sm uppercase"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-5 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-foreground/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(rows.filter((r) => r.included && !r.alreadyExists))}
            disabled={includedCount === 0}
            className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add {includedCount} Course{includedCount !== 1 ? "s" : ""} to List
          </button>
        </div>
      </div>
    </div>
  );
}

export type { ConfirmRow };
