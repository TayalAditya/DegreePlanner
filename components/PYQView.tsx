"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileQuestion,
  Search,
  Upload,
  ExternalLink,
  X,
  ChevronDown,
  Check,
  Ban,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { formatCourseCode } from "@/lib/utils";

interface PYQPaper {
  id: string;
  courseCode: string;
  courseName: string;
  semester: number;
  year: number;
  term: string;
  examType: string;
  title: string | null;
  fileUrl: string;
  status: string;
  createdAt: string;
  uploadedBy: {
    name: string | null;
    enrollmentId: string | null;
  };
}

interface Enrollment {
  id: string;
  semester: number;
  year: number;
  term: string;
  course: {
    code: string;
    name: string;
  };
}

interface PYQViewProps {
  isAdmin?: boolean;
}

const EXAM_TYPES = [
  { value: "MIDSEM", label: "Mid-Sem", color: "bg-warning/10 text-warning" },
  { value: "ENDSEM", label: "End-Sem", color: "bg-error/10 text-error" },
  { value: "QUIZ", label: "Quiz", color: "bg-info/10 text-info" },
  { value: "OTHER", label: "Other", color: "bg-foreground-muted/10 text-foreground-muted" },
];

const EXAM_TYPE_MAP = Object.fromEntries(EXAM_TYPES.map((t) => [t.value, t]));

export function PYQView({ isAdmin }: PYQViewProps) {
  const [papers, setPapers] = useState<PYQPaper[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterExamType, setFilterExamType] = useState<string>("all");
  const [filterSemester, setFilterSemester] = useState<string>("all");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const { showToast } = useToast();

  // Upload form state
  const [uploadCourseCode, setUploadCourseCode] = useState("");
  const [uploadExamType, setUploadExamType] = useState("MIDSEM");
  const [uploadFileUrl, setUploadFileUrl] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadSemester, setUploadSemester] = useState("");
  const [uploadYear, setUploadYear] = useState("");
  const [uploadTerm, setUploadTerm] = useState("FALL");
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [papersRes, enrollmentsRes] = await Promise.all([
        fetch("/api/pyq"),
        fetch("/api/enrollments"),
      ]);
      if (papersRes.ok) setPapers(await papersRes.json());
      if (enrollmentsRes.ok) {
        const data = await enrollmentsRes.json();
        setEnrollments(
          data.map((e: Record<string, unknown>) => ({
            id: e.id,
            semester: e.semester,
            year: e.year,
            term: e.term,
            course: e.course,
          }))
        );
      }
    } catch {
      showToast("error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Unique enrolled courses for the upload dropdown
  const enrolledCourses = useMemo(() => {
    const map = new Map<string, { code: string; name: string; semesters: { sem: number; year: number; term: string }[] }>();
    for (const e of enrollments) {
      const existing = map.get(e.course.code);
      if (existing) {
        existing.semesters.push({ sem: e.semester, year: e.year, term: e.term });
      } else {
        map.set(e.course.code, {
          code: e.course.code,
          name: e.course.name,
          semesters: [{ sem: e.semester, year: e.year, term: e.term }],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [enrollments]);

  // Auto-fill semester/year/term when course is selected
  const handleCourseSelect = useCallback(
    (code: string) => {
      setUploadCourseCode(code);
      const course = enrolledCourses.find((c) => c.code === code);
      if (course && course.semesters.length > 0) {
        const latest = course.semesters[course.semesters.length - 1];
        setUploadSemester(String(latest.sem));
        setUploadYear(String(latest.year));
        setUploadTerm(latest.term);
      }
    },
    [enrolledCourses]
  );

  // Available semesters for filter
  const availableSemesters = useMemo(() => {
    const sems = new Set(papers.map((p) => p.semester));
    return Array.from(sems).sort((a, b) => a - b);
  }, [papers]);

  // Filtered papers
  const filteredPapers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return papers.filter((p) => {
      const matchesSearch =
        !query ||
        p.courseCode.toLowerCase().includes(query) ||
        p.courseName.toLowerCase().includes(query) ||
        (p.title ?? "").toLowerCase().includes(query);
      const matchesExam = filterExamType === "all" || p.examType === filterExamType;
      const matchesSem = filterSemester === "all" || p.semester === parseInt(filterSemester, 10);
      return matchesSearch && matchesExam && matchesSem;
    });
  }, [papers, searchQuery, filterExamType, filterSemester]);

  // Group by course
  const groupedPapers = useMemo(() => {
    const map = new Map<string, PYQPaper[]>();
    for (const p of filteredPapers) {
      const list = map.get(p.courseCode) ?? [];
      list.push(p);
      map.set(p.courseCode, list);
    }
    return Array.from(map.entries())
      .map(([code, papers]) => ({ code, name: papers[0].courseName, papers }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [filteredPapers]);

  const handleUpload = async () => {
    if (!uploadCourseCode || !uploadFileUrl || !uploadSemester || !uploadYear) {
      showToast("error", "Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/pyq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseCode: uploadCourseCode,
          examType: uploadExamType,
          fileUrl: uploadFileUrl,
          title: uploadTitle || undefined,
          semester: uploadSemester,
          year: uploadYear,
          term: uploadTerm,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast("error", data.error || "Failed to upload");
        return;
      }

      showToast("success", "Paper uploaded successfully!");
      setShowUploadModal(false);
      setUploadCourseCode("");
      setUploadExamType("MIDSEM");
      setUploadFileUrl("");
      setUploadTitle("");
      setUploadSemester("");
      setUploadYear("");
      setUploadTerm("FALL");
      loadData();
    } catch {
      showToast("error", "Failed to upload paper");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-surface rounded-xl border border-border p-6 animate-pulse">
            <div className="h-5 bg-surface-hover rounded w-1/3 mb-3" />
            <div className="h-4 bg-surface-hover rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Previous Year Papers</h1>
          <p className="text-sm text-foreground-secondary mt-1">
            Browse and share question papers from past semesters
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover font-medium transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload Paper
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-foreground-secondary group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search by course code or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-surface border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground placeholder-foreground-secondary transition-all shadow-sm"
          />
        </div>
        <select
          value={filterExamType}
          onChange={(e) => setFilterExamType(e.target.value)}
          className="px-4 py-3 bg-surface border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground font-medium shadow-sm cursor-pointer"
        >
          <option value="all">All Exam Types</option>
          {EXAM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={filterSemester}
          onChange={(e) => setFilterSemester(e.target.value)}
          className="px-4 py-3 bg-surface border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground font-medium shadow-sm cursor-pointer"
        >
          <option value="all">All Semesters</option>
          {availableSemesters.map((s) => (
            <option key={s} value={s}>
              Semester {s}
            </option>
          ))}
        </select>
      </div>

      {/* Papers List */}
      {filteredPapers.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-xl border border-border">
          <FileQuestion className="w-16 h-16 text-foreground-secondary mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {papers.length === 0 ? "No papers uploaded yet" : "No papers match your filters"}
          </h3>
          <p className="text-foreground-secondary text-sm max-w-md mx-auto">
            {papers.length === 0
              ? "Be the first to upload a previous year paper for your courses!"
              : "Try adjusting your search or filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedPapers.map(({ code, name, papers: coursePapers }) => (
            <CourseGroup
              key={code}
              code={code}
              name={name}
              papers={coursePapers}
              isAdmin={isAdmin}
              onChanged={loadData}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">Upload Paper</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Course selector — only enrolled courses */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Course <span className="text-error">*</span>
                </label>
                {enrolledCourses.length === 0 ? (
                  <p className="text-sm text-foreground-secondary italic">
                    No enrolled courses found. Import your courses first.
                  </p>
                ) : (
                  <select
                    value={uploadCourseCode}
                    onChange={(e) => handleCourseSelect(e.target.value)}
                    className="w-full px-4 py-2.5 bg-surface border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground cursor-pointer"
                  >
                    <option value="">Select a course...</option>
                    {enrolledCourses.map((c) => (
                      <option key={c.code} value={c.code}>
                        {formatCourseCode(c.code)} — {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Exam type */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Exam Type <span className="text-error">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {EXAM_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setUploadExamType(t.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                        uploadExamType === t.value
                          ? `${t.color} ring-2 ring-current/20 border-current/30`
                          : "bg-surface border-border text-foreground-secondary hover:border-foreground-secondary/40"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Semester / Year / Term row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Semester <span className="text-error">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={uploadSemester}
                    onChange={(e) => setUploadSemester(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full px-3 py-2.5 bg-surface border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Year <span className="text-error">*</span>
                  </label>
                  <input
                    type="number"
                    min={2020}
                    max={2030}
                    value={uploadYear}
                    onChange={(e) => setUploadYear(e.target.value)}
                    placeholder="e.g. 2025"
                    className="w-full px-3 py-2.5 bg-surface border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Term <span className="text-error">*</span>
                  </label>
                  <select
                    value={uploadTerm}
                    onChange={(e) => setUploadTerm(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground cursor-pointer"
                  >
                    <option value="FALL">Fall</option>
                    <option value="SPRING">Spring</option>
                    <option value="SUMMER">Summer</option>
                  </select>
                </div>
              </div>

              {/* File URL (Google Drive link) */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  File Link (Google Drive / direct URL) <span className="text-error">*</span>
                </label>
                <input
                  type="url"
                  value={uploadFileUrl}
                  onChange={(e) => setUploadFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-4 py-2.5 bg-surface border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder-foreground-secondary"
                />
              </div>

              {/* Optional title */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Title <span className="text-foreground-secondary">(optional)</span>
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. CS-101 Mid-Sem Fall 2024 (Set A)"
                  className="w-full px-4 py-2.5 bg-surface border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder-foreground-secondary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2.5 border border-border rounded-lg hover:bg-surface-hover font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={submitting || !uploadCourseCode || !uploadFileUrl || !uploadSemester || !uploadYear}
                className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Course Group Card ───────────────────────────────────────────────────────
function CourseGroup({
  code,
  name,
  papers,
  isAdmin,
  onChanged,
}: {
  code: string;
  name: string;
  papers: PYQPaper[];
  isAdmin?: boolean;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 hover:bg-surface-hover transition-colors flex items-center justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <h3 className="font-bold text-foreground truncate">
            {formatCourseCode(code)} — {name}
          </h3>
          <p className="text-xs text-foreground-secondary mt-0.5">
            {papers.length} paper{papers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Exam type badges summary */}
          <div className="hidden sm:flex gap-1">
            {Array.from(new Set(papers.map((p) => p.examType))).map((type) => {
              const info = EXAM_TYPE_MAP[type];
              return (
                <span
                  key={type}
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${info?.color ?? "bg-surface-hover text-foreground-secondary"}`}
                >
                  {info?.label ?? type}
                </span>
              );
            })}
          </div>
          <ChevronDown
            className={`w-4 h-4 text-foreground-secondary transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {papers.map((paper) => (
            <PaperRow key={paper.id} paper={paper} isAdmin={isAdmin} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Paper Row ───────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  APPROVED: { label: "Public", className: "text-success" },
  PENDING: { label: "Pending review", className: "text-warning" },
  REJECTED: { label: "Rejected", className: "text-error" },
};

function PaperRow({
  paper,
  isAdmin,
  onChanged,
}: {
  paper: PYQPaper;
  isAdmin?: boolean;
  onChanged: () => void;
}) {
  const examInfo = EXAM_TYPE_MAP[paper.examType];
  const termLabel = paper.term.charAt(0) + paper.term.slice(1).toLowerCase();
  const statusInfo = STATUS_STYLES[paper.status] ?? STATUS_STYLES.PENDING;
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const review = async (status: "APPROVED" | "REJECTED") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/pyq/${paper.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        showToast("error", "Failed to update paper");
        return;
      }
      showToast("success", status === "APPROVED" ? "Paper approved & public" : "Paper rejected");
      onChanged();
    } catch {
      showToast("error", "Failed to update paper");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this paper? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/pyq/${paper.id}`, { method: "DELETE" });
      if (!res.ok) {
        showToast("error", "Failed to delete paper");
        return;
      }
      showToast("success", "Paper deleted");
      onChanged();
    } catch {
      showToast("error", "Failed to delete paper");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-hover transition-colors group">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-2 py-0.5 text-xs font-semibold rounded-full ${examInfo?.color ?? "bg-surface-hover text-foreground-secondary"}`}
          >
            {examInfo?.label ?? paper.examType}
          </span>
          <span className="text-sm font-medium text-foreground truncate">
            {paper.title ?? `${formatCourseCode(paper.courseCode)} ${examInfo?.label ?? paper.examType}`}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-foreground-secondary">
          <span>Sem {paper.semester}</span>
          <span>·</span>
          <span>{termLabel} {paper.year}</span>
          {paper.uploadedBy.name && (
            <>
              <span>·</span>
              <span>by {paper.uploadedBy.enrollmentId ?? paper.uploadedBy.name}</span>
            </>
          )}
          <span>·</span>
          <span className={statusInfo.className}>{statusInfo.label}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isAdmin && paper.status !== "APPROVED" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => review("APPROVED")}
            className="p-2 text-success hover:bg-success/10 rounded-lg transition-colors disabled:opacity-50"
            title="Approve & make public"
          >
            <Check className="w-4 h-4" />
          </button>
        )}
        {isAdmin && paper.status !== "REJECTED" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => review("REJECTED")}
            className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors disabled:opacity-50"
            title="Reject"
          >
            <Ban className="w-4 h-4" />
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="p-2 text-foreground-secondary hover:bg-error/10 hover:text-error rounded-lg transition-colors disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <a
          href={paper.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 font-medium text-sm transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          <span className="hidden sm:inline">Open</span>
        </a>
      </div>
    </div>
  );
}
