"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, AlertTriangle, CheckCircle, ExternalLink, BookOpen, Info, ChevronDown, ChevronRight, Save, Mail, Briefcase, Plus } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { formatCredits, formatCourseCode } from "@/lib/utils";
import { MINORS } from "@/lib/minors";

interface Offering {
  id: string;
  courseId: string | null;
  courseCode: string;
  courseName: string;
  instructor: string | null;
  instructorEmail: string | null;
  school: string | null;
  slots: string | null;
  ltpc: string | null;
  credits: number;
  curriculumLink: string | null;
  resolvedCategory: string;
  isCompulsory: boolean;
  completedInSemester: number | null;
}

interface ApiResponse {
  offeringSemester: number;
  offeringYear: number;
  term: string;
  creditLimit: number;
  registrationOpensAt: string | null;
  offerings: Offering[];
  completedBreakdown: Record<string, number>;
  programRequirements: Record<string, number> | null;
  studentInfo: { name: string | null; branch: string | null; semester: number } | null;
}

interface InternshipCourse {
  id: string;
  code: string;
  name: string;
  credits: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  IC: "IC", IC_BASKET: "IC", DC: "DC", DE: "DE",
  HSS: "HSS", IKS: "IKS", FE: "FE", MTP: "MTP", ISTP: "ISTP",
};

const CATEGORY_COLOR: Record<string, string> = {
  DC: "bg-primary/10 text-primary border-primary/20",
  IC: "bg-info/10 text-info border-info/20",
  IC_BASKET: "bg-info/10 text-info border-info/20",
  DE: "bg-secondary/10 text-secondary border-secondary/20",
  HSS: "bg-warning/10 text-warning border-warning/20",
  IKS: "bg-warning/10 text-warning border-warning/20",
  FE: "bg-success/10 text-success border-success/20",
  MTP: "bg-error/10 text-error border-error/20",
  ISTP: "bg-accent/10 text-accent border-accent/20",
};

// Parse slot string — handles +, &, , separators e.g. "B & L4" → ["B","L4"]
function parseSlots(slots: string | null): string[] {
  if (!slots) return [];
  return slots.split(/[+&,]/).map((s) => s.trim()).filter(Boolean);
}

// Flexible slots never clash — TBD, FS1/FS2/FS3, Free Slot
function isFlexibleSlot(token: string): boolean {
  const t = token.trim().toUpperCase();
  return t === "TBD" || t === "FREE SLOT" || /^FS\d*$/i.test(t) || t === "NS";
}

function fixedSlots(slots: string | null): string[] {
  return parseSlots(slots).filter((t) => !isFlexibleSlot(t));
}

function slotsClash(a: string | null, b: string | null): boolean {
  const sa = new Set(fixedSlots(a));
  if (sa.size === 0) return false;
  return fixedSlots(b).some((t) => sa.has(t));
}

function CourseCard({
  offering, checked, disabled, onToggle, clashWith, isCompulsory, minorGroupLabel, studentInfo,
}: {
  offering: Offering & { instructorEmail?: string | null };
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  clashWith?: string;
  isCompulsory?: boolean;
  minorGroupLabel?: string;
  studentInfo?: { name: string | null; branch: string | null; semester: number } | null;
}) {
  const isCompleted = offering.completedInSemester !== null;
  const catColor = CATEGORY_COLOR[offering.resolvedCategory] ?? "bg-surface-secondary text-foreground-secondary";
  const catLabel = CATEGORY_LABEL[offering.resolvedCategory] ?? offering.resolvedCategory;

  return (
    <label
      className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer
        ${isCompleted ? "opacity-50 cursor-default" : ""}
        ${clashWith ? "border-error/30 bg-error/5" : checked ? "border-primary/30 bg-primary/5" : "border-border bg-surface hover:border-border-hover"}
      `}
      onClick={isCompleted ? undefined : onToggle}
    >
      {/* Checkbox */}
      <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors
        ${isCompleted || disabled ? "border-border bg-background-secondary cursor-not-allowed" :
          checked ? "border-primary bg-primary" : "border-border bg-background"}`}
      >
        {(checked || isCompulsory) && (
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {clashWith && !checked && <Lock className="w-2.5 h-2.5 text-error" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-mono text-xs font-semibold text-foreground-secondary ${isCompleted ? "line-through" : ""}`}>
            {offering.courseCode}
          </span>
          <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${catColor}`}>{catLabel}</span>
          {minorGroupLabel && (
            <span className="px-1.5 py-0.5 text-xs font-medium rounded border bg-accent/10 text-accent border-accent/30">
              Minor · {minorGroupLabel}
            </span>
          )}
          {isCompleted && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-success/10 text-success border border-success/20 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Sem {offering.completedInSemester}
            </span>
          )}
        </div>

        <p className={`mt-0.5 text-sm font-medium text-foreground ${isCompleted ? "line-through" : ""}`}>
          {offering.courseName}
        </p>

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-foreground-secondary">
          {offering.instructor && <span>{offering.instructor}</span>}
          {offering.slots && <span className="font-mono">{offering.slots}</span>}
          {offering.ltpc && <span>{offering.ltpc}</span>}
          <span className="font-medium">{formatCredits(offering.credits)} cr</span>
        </div>

        {clashWith && (
          <p className="mt-1 text-xs text-error flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Slot clash with {clashWith}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap gap-2">
          {offering.curriculumLink && (
            <a
              href={offering.curriculumLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Curriculum <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {offering.instructorEmail && (() => {
            const instructor = offering.instructor ?? "Sir/Ma'am";
            const salutation = instructor.toLowerCase().includes("ma'am") || instructor.toLowerCase().includes("mam") ? "Ma'am" : "Sir/Ma'am";
            const subject = encodeURIComponent(`Inquiry Regarding ${offering.courseCode} – ${offering.courseName}`);
            const body = encodeURIComponent(
              `Respected ${salutation},\n\nI wanted to inquire whether the course ${offering.courseCode} – ${offering.courseName} is being offered to Semester ${studentInfo?.semester ?? "?"} students${studentInfo?.branch ? ` (${studentInfo.branch})` : ""} this semester.\n\nRegards,\n${studentInfo?.name ?? "Student"}`
            );
            return (
              <a
                href={`mailto:${offering.instructorEmail}?subject=${subject}&body=${body}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-foreground-secondary hover:text-primary hover:underline"
              >
                <Mail className="w-3 h-3" /> Contact Instructor
              </a>
            );
          })()}
        </div>
      </div>
    </label>
  );
}

function Section({ title, count, children, defaultOpen = false, headerBg, error }: {
  title: string; count: number; children: React.ReactNode; defaultOpen?: boolean;
  headerBg?: string; error?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border overflow-hidden ${error ? "border-error/20 bg-surface" : "border-border bg-surface"}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors
          ${open ? (error ? "border-b border-error/20" : "border-b border-border") : ""}
          ${headerBg ?? (error ? "bg-error/5 hover:bg-error/8" : "hover:bg-surface-secondary")}`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${error ? "text-error" : "text-foreground"}`}>{title}</span>
          <span className="text-xs text-foreground-secondary bg-background-secondary px-1.5 py-0.5 rounded-full">{count}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-foreground-secondary" /> : <ChevronRight className="w-4 h-4 text-foreground-secondary" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InternshipSection({ internshipCourses }: { internshipCourses: { p399: InternshipCourse[]; p396: InternshipCourse[] } }) {
  return (
    <Section title="Semester-Long Internship" count={internshipCourses.p399.length + internshipCourses.p396.length}>
      <div className="space-y-4">
        {internshipCourses.p399.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Onsite (399P) — 9 cr P/F · No other courses · P/F budget → 0 remaining</p>
            <div className="flex items-start gap-2 p-2 rounded-lg bg-error/5 border border-error/15 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-error flex-shrink-0 mt-0.5" />
              <p className="text-xs text-error">Cannot enroll alongside any other course in Sem 6/7</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {internshipCourses.p399.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border bg-background">
                  <div>
                    <p className="text-xs font-mono font-semibold text-foreground">{formatCourseCode(c.code)}</p>
                    <p className="text-xs text-foreground-secondary">{formatCredits(c.credits)} cr P/F</p>
                  </div>
                  <a href="/dashboard/courses" className="flex-shrink-0 text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
        {internshipCourses.p396.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Remote (396P) — 6 cr P/F · P/F budget → 3 remaining</p>
            <div className="flex items-start gap-2 p-2 rounded-lg bg-warning/5 border border-warning/15 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-xs text-warning">Uses 6 of 9 total P/F credits</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {internshipCourses.p396.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border bg-background">
                  <div>
                    <p className="text-xs font-mono font-semibold text-foreground">{formatCourseCode(c.code)}</p>
                    <p className="text-xs text-foreground-secondary">{formatCredits(c.credits)} cr P/F</p>
                  </div>
                  <a href="/dashboard/courses" className="flex-shrink-0 text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function ProgressPanel({ programRequirements, completedBreakdown, categoryBreakdown }: {
  programRequirements: Record<string, number>;
  completedBreakdown: Record<string, number>;
  categoryBreakdown: { cat: string; credits: number; count: number }[];
}) {
  return (
    <>
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-semibold text-foreground-secondary uppercase tracking-wide mb-3">Remaining</p>
        <div className="space-y-2">
          {(["IC","IC_BASKET","DC","DE","HSS","FE","IKS","MTP","ISTP"] as const).map((key) => {
            const req  = programRequirements[key] ?? 0;
            const done = completedBreakdown[key] ?? 0;
            if (!req && !done) return null;
            const rem  = req > 0 ? Math.max(0, req - done) : null;
            const color = CATEGORY_COLOR[key] ?? "";
            const label = key === "IC_BASKET" ? "ICB" : key;
            return (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${color}`}>{label}</span>
                <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
                  {req > 0
                    ? <span className="text-foreground-secondary">{formatCredits(done)}/{req} cr</span>
                    : <span className="text-foreground-secondary">{formatCredits(done)} cr</span>
                  }
                  {rem !== null && (
                    <span className={`font-semibold ${rem > 0 ? "text-error" : "text-success"}`}>
                      {rem > 0 ? `−${formatCredits(rem)}` : "✓"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {categoryBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold text-foreground-secondary uppercase tracking-wide mb-3">Adding this semester</p>
          <div className="space-y-2">
            {categoryBreakdown.map(({ cat, credits, count }) => (
              <div key={cat} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${CATEGORY_COLOR[cat] ?? ""}`}>{cat}</span>
                  <span className="text-xs text-foreground-secondary">{count} course{count !== 1 ? "s" : ""}</span>
                </div>
                <span className="text-xs font-semibold text-foreground flex-shrink-0">+{formatCredits(credits)} cr</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function PreRegistrationPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showApprovalWarning, setShowApprovalWarning] = useState(false);
  const [selectedMinorCode, setSelectedMinorCode] = useState<string>("");
  const [internshipCourses, setInternshipCourses] = useState<{ p399: InternshipCourse[]; p396: InternshipCourse[] }>({ p399: [], p396: [] });
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/pre-registration")
      .then((r) => r.json())
      .then(async (d: ApiResponse) => {
        setData(d);
        // Load saved plan from server
        const res = await fetch(`/api/pre-registration/plan?semester=${d.offeringSemester}&year=${d.offeringYear}`);
        if (res.ok) {
          const plan = await res.json() as { selectedIds: string[] };
          const offeringById = new Map(d.offerings.map((o: Offering) => [o.id, o]));
          // Restore saved selection, validating slot clashes greedily
          const restoredSlots = new Set<string>();
          const restoredIds = new Set<string>();
          for (const id of plan.selectedIds) {
            const o = offeringById.get(id);
            if (!o) continue;
            const oSlots = parseSlots(o.slots);
            if (oSlots.some((s) => restoredSlots.has(s))) continue; // skip clashing
            oSlots.forEach((s) => restoredSlots.add(s));
            restoredIds.add(id);
          }
          setSelected(restoredIds);
          setSaved(true);
        }
      })
      .catch(() => showToast("error", "Failed to load offerings"))
      .finally(() => setLoading(false));

    // Fetch internship courses separately
    fetch("/api/courses")
      .then((r) => r.json())
      .then((courses: InternshipCourse[]) => {
        if (!Array.isArray(courses)) return;
        const p399 = courses.filter((c) => c.code.toUpperCase().replace(/[^A-Z0-9]/g, "").endsWith("399P"));
        const p396 = courses.filter((c) => c.code.toUpperCase().replace(/[^A-Z0-9]/g, "").endsWith("396P"));
        setInternshipCourses({ p399, p396 });
      })
      .catch(() => {});
  }, []);

  // Compulsory course slots (blocked)
  const compulsorySlots = useMemo(() => {
    const s = new Set<string>();
    data?.offerings.filter((o) => o.isCompulsory).forEach((o) => fixedSlots(o.slots).forEach((t) => s.add(t)));
    return s;
  }, [data]);

  // Selected optional course slots (for inter-optional clash detection)
  const selectedSlots = useMemo(() => {
    const map = new Map<string, string>(); // slot → courseCode
    data?.offerings.filter((o) => selected.has(o.id)).forEach((o) =>
      parseSlots(o.slots).forEach((t) => map.set(t, o.courseCode))
    );
    return map;
  }, [data, selected]);

  // For each offering, find what it clashes with
  const clashMap = useMemo(() => {
    const map = new Map<string, string>(); // offeringId → clashing course code
    if (!data) return map;
    for (const o of data.offerings) {
      if (o.isCompulsory) continue;
      for (const slot of parseSlots(o.slots)) {
        if (compulsorySlots.has(slot)) {
          // Find which compulsory course owns this slot
          const comp = data.offerings.find(
            (c) => c.isCompulsory && parseSlots(c.slots).includes(slot)
          );
          map.set(o.id, comp?.courseCode ?? "a compulsory course");
          break;
        }
      }
    }
    return map;
  }, [data, compulsorySlots]);

  // Detect inter-optional clashes (two selected optional courses clash)
  const interClashMap = useMemo(() => {
    const map = new Map<string, string>(); // offeringId → clashing courseCode
    if (!data) return map;
    const selectedList = data.offerings.filter((o) => selected.has(o.id));
    for (const a of selectedList) {
      for (const b of selectedList) {
        if (a.id === b.id) continue;
        if (slotsClash(a.slots, b.slots) && !map.has(a.id)) {
          map.set(a.id, b.courseCode);
        }
      }
    }
    return map;
  }, [data, selected]);

  const totalCredits = useMemo(() => {
    if (!data) return 0;
    let total = 0;
    for (const o of data.offerings) {
      if (o.completedInSemester !== null) continue; // already done, doesn't count toward new load
      if (o.isCompulsory || selected.has(o.id)) total += o.credits;
    }
    return total;
  }, [data, selected]);

  // Minor planner: for selected minor, compute per-group offering data
  const minorData = useMemo(() => {
    const minor = MINORS.find((m) => m.code === selectedMinorCode);
    if (!minor || !data) return null;

    const offeringByCode = new Map<string, Offering>();
    for (const o of data.offerings) {
      offeringByCode.set(formatCourseCode(o.courseCode), o);
    }

    return {
      minor,
      groups: minor.groups.map((group) => ({
        ...group,
        courses: group.courseCodes.map((rawCode) => {
          const norm = formatCourseCode(rawCode);
          const offering = offeringByCode.get(norm);
          return { code: norm, offering };
        }),
      })),
    };
  }, [selectedMinorCode, data]);

  // Map offeringId → minor group title (for badge on CourseCard)
  const minorOfferingLabels = useMemo(() => {
    const map = new Map<string, string>();
    if (!minorData) return map;
    for (const group of minorData.groups) {
      for (const { offering } of group.courses) {
        if (offering) map.set(offering.id, group.countsTowardMinor ? group.title : "Prereq");
      }
    }
    return map;
  }, [minorData]);

  // Category-wise breakdown of selected + compulsory courses
  const categoryBreakdown = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { credits: number; count: number }>();
    for (const o of data.offerings) {
      if (!o.isCompulsory && !selected.has(o.id)) continue;
      if (o.completedInSemester !== null) continue; // already done, skip
      const cat = o.resolvedCategory;
      const existing = map.get(cat) ?? { credits: 0, count: 0 };
      map.set(cat, { credits: existing.credits + o.credits, count: existing.count + 1 });
    }
    // Sort by fixed order
    const ORDER = ["IC", "IC_BASKET", "DC", "DE", "HSS", "IKS", "FE", "MTP", "ISTP"];
    return ORDER
      .filter((cat) => map.has(cat))
      .map((cat) => ({ cat, ...map.get(cat)! }));
  }, [data, selected]);

  const handleToggle = (offering: Offering) => {
    if (offering.isCompulsory || offering.completedInSemester !== null) return;
    if (clashMap.has(offering.id)) return; // core clash — cannot select

    // Prevent selecting if it clashes with an already-selected optional course
    if (!selected.has(offering.id)) {
      const clash = data?.offerings.find(
        (o) => selected.has(o.id) && slotsClash(o.slots, offering.slots)
      );
      if (clash) {
        showToast("error", `Slot clash with ${clash.courseCode} — deselect it first`);
        return;
      }
    }

    const next = new Set(selected);
    if (next.has(offering.id)) {
      next.delete(offering.id);
    } else {
      next.add(offering.id);
      const newTotal = totalCredits + offering.credits;
      if (data && newTotal > data.creditLimit) setShowApprovalWarning(true);
    }
    setSelected(next);
    setSaved(false);
  };

  const handleSavePlan = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pre-registration/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semester: data.offeringSemester, year: data.offeringYear, selectedIds: [...selected] }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      showToast("success", "Plan saved — this is for your reference only, not the official registration");
    } catch {
      showToast("error", "Could not save plan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full w-8 h-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const hasOfferings = data && data.offerings.length > 0;

  if (!hasOfferings) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-16">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Semester {data?.offeringSemester ?? "—"} Pre Registration
          </h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            {data?.term} {data?.offeringYear} · Browse and plan your courses for the upcoming semester
          </p>
        </div>

        <div className="py-10 text-center space-y-3 rounded-xl border border-border bg-surface">
          <BookOpen className="w-10 h-10 text-foreground-secondary mx-auto" />
          <p className="text-lg font-medium text-foreground">No offerings yet</p>
          <p className="text-sm text-foreground-secondary">
            Course offerings haven&apos;t been uploaded yet. Check back soon.
          </p>
        </div>

        {/* Show internship section even when no offerings uploaded */}
        {(internshipCourses.p399.length > 0 || internshipCourses.p396.length > 0) && (
          <InternshipSection internshipCourses={internshipCourses} />
        )}
      </div>
    );
  }

  const compulsory = data.offerings.filter((o) => o.isCompulsory);
  const de = data.offerings.filter((o) => !o.isCompulsory && o.resolvedCategory === "DE" && !clashMap.has(o.id));
  const hss = data.offerings.filter((o) => !o.isCompulsory && ["HSS", "IKS"].includes(o.resolvedCategory) && !clashMap.has(o.id));
  const fe = data.offerings.filter((o) => !o.isCompulsory && o.resolvedCategory === "FE" && !clashMap.has(o.id));
  const coreClash = data.offerings.filter((o) => !o.isCompulsory && clashMap.has(o.id));

  // Group FE by school
  const feBySchool = fe.reduce<Record<string, Offering[]>>((acc, o) => {
    const key = o.school ?? "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  const creditLimit = data.creditLimit;
  const creditPct = Math.min(100, (totalCredits / creditLimit) * 100);
  const overLimit = totalCredits > creditLimit;
  const registrationLocked = !!data.registrationOpensAt;
  const selectedCount = selected.size + compulsory.filter((o) => !o.completedInSemester).length;

  return (
    <div className="max-w-6xl mx-auto pb-24">
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Semester {data.offeringSemester} Pre Registration
        </h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          {data.term} {data.offeringYear} · Browse and plan your courses for the upcoming semester
        </p>
      </div>

      {/* Minor selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <BookOpen className="w-4 h-4 text-accent flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Minor Planner</p>
            <p className="text-xs text-foreground-secondary">See which offerings count toward a minor</p>
          </div>
        </div>
        <select
          value={selectedMinorCode}
          onChange={(e) => setSelectedMinorCode(e.target.value)}
          className="text-sm bg-background border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 w-full sm:w-auto sm:max-w-[220px]"
        >
          <option value="">— Select a minor —</option>
          {MINORS.map((m) => (
            <option key={m.code} value={m.code}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* Minor planner breakdown */}
      {minorData && (
        <div className="rounded-xl border border-accent/25 bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-accent/20 bg-accent/5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{minorData.minor.name}</p>
              {minorData.minor.totalCreditsRequired && (
                <p className="text-xs text-foreground-secondary mt-0.5">{minorData.minor.totalCreditsRequired} credits required</p>
              )}
            </div>
          </div>
          <div className="divide-y divide-border">
            {minorData.groups.map((group) => {
              const offered = group.courses.filter((c) => c.offering);
              const notOffered = group.courses.filter((c) => !c.offering);
              const completedOffered = offered.filter((c) => c.offering!.completedInSemester !== null);
              const availableOffered = offered.filter((c) => c.offering!.completedInSemester === null);
              return (
                <div key={group.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-foreground">{group.title}</p>
                    {!group.countsTowardMinor && (
                      <span className="text-xs text-foreground-secondary bg-surface-secondary px-1.5 py-0.5 rounded-full">Prerequisite</span>
                    )}
                    <span className="text-xs text-foreground-secondary bg-surface-secondary px-1.5 py-0.5 rounded-full ml-auto">
                      Pick {group.requiredCount}
                    </span>
                  </div>
                  {group.note && (
                    <p className="text-xs text-foreground-secondary italic">{group.note}</p>
                  )}
                  {availableOffered.length > 0 && (
                    <div className="space-y-2">
                      {availableOffered.map(({ offering }) => (
                        <CourseCard
                          key={offering!.id}
                          offering={offering!}
                          checked={selected.has(offering!.id)}
                          disabled={clashMap.has(offering!.id)}
                          onToggle={() => handleToggle(offering!)}
                          clashWith={clashMap.get(offering!.id) ?? interClashMap.get(offering!.id)}
                          studentInfo={data.studentInfo}
                        />
                      ))}
                    </div>
                  )}
                  {completedOffered.length > 0 && (
                    <div className="space-y-2">
                      {completedOffered.map(({ offering }) => (
                        <CourseCard
                          key={offering!.id}
                          offering={offering!}
                          checked={false}
                          disabled={true}
                          onToggle={() => {}}
                          studentInfo={data.studentInfo}
                        />
                      ))}
                    </div>
                  )}
                  {notOffered.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {notOffered.map(({ code }) => (
                        <span key={code} className="font-mono text-xs px-2 py-1 rounded bg-background-secondary text-foreground-secondary border border-border">
                          {code}
                        </span>
                      ))}
                      <span className="text-xs text-foreground-secondary self-center">not offered this semester</span>
                    </div>
                  )}
                  {offered.length === 0 && notOffered.length > 0 && (
                    <p className="text-xs text-foreground-secondary">None of these courses are offered this semester.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Disclaimer banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-info/25 bg-info/5">
        <Info className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
        <p className="text-sm text-foreground-secondary">
          <span className="font-medium text-foreground">This is not the official pre-registration.</span>{" "}
          Degree Planner lets you browse all eligible courses by category and plan your semester ahead of time.
          Actual pre-registration on the institute portal will begin in late June.
        </p>
      </div>

      {/* Registration lock banner */}
      {registrationLocked && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/30 bg-warning/5">
          <Lock className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-warning">Registration not yet open</p>
            <p className="text-xs text-foreground-secondary mt-0.5">
              You can browse and plan your selection. Registration opens on{" "}
              <strong>{new Date(data.registrationOpensAt!).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Credit counter */}
      <div className="p-4 rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Credits Selected</span>
          <span className={`text-sm font-semibold ${overLimit ? "text-error" : "text-foreground"}`}>
            {formatCredits(totalCredits)} / {creditLimit} cr
          </span>
        </div>
        <div className="h-2 rounded-full bg-background-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${overLimit ? "bg-error" : "bg-primary"}`}
            style={{ width: `${creditPct}%` }}
          />
        </div>
        {overLimit && (
          <p className="mt-2 text-xs text-error flex items-center gap-1">
            <Info className="w-3 h-3" />
            Exceeds {creditLimit} cr limit — additional courses require Academic Affairs approval
          </p>
        )}
      </div>

      {/* Approval warning popup */}
      <AnimatePresence>
        {showApprovalWarning && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 p-4 rounded-xl border border-warning/40 bg-warning/8"
          >
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning">Credit limit exceeded</p>
              <p className="text-xs text-foreground-secondary mt-0.5">
                Taking more than {creditLimit} credits requires approval from the Academic Affairs Office.
              </p>
            </div>
            <button onClick={() => setShowApprovalWarning(false)} className="text-foreground-secondary hover:text-foreground text-lg leading-none">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compulsory */}
      {compulsory.length > 0 && (
        <Section title="Compulsory — IC & DC" count={compulsory.length} headerBg="bg-primary/5">
          {compulsory.map((o) => (
            <CourseCard
              key={o.id}
              offering={o}
              checked={true}
              disabled={true}
              onToggle={() => {}}
              isCompulsory={true}
              studentInfo={data.studentInfo}
            />
          ))}
        </Section>
      )}

      {/* DE */}
      {de.length > 0 && (
        <Section title="Discipline Electives" count={de.length}>
          {de.map((o) => (
            <CourseCard
              key={o.id}
              offering={o}
              checked={selected.has(o.id)}
              disabled={false}
              onToggle={() => handleToggle(o)}
              clashWith={interClashMap.get(o.id)}
              minorGroupLabel={minorOfferingLabels.get(o.id)}
              studentInfo={data.studentInfo}
            />
          ))}
        </Section>
      )}

      {/* HSS */}
      {hss.length > 0 && (
        <Section title="Humanities & Social Sciences" count={hss.length}>
          {hss.map((o) => (
            <CourseCard
              key={o.id}
              offering={o}
              checked={selected.has(o.id)}
              disabled={false}
              onToggle={() => handleToggle(o)}
              minorGroupLabel={minorOfferingLabels.get(o.id)}
              studentInfo={data.studentInfo}
            />
          ))}
        </Section>
      )}

      {/* FE by school */}
      {fe.length > 0 && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Free Electives</p>
            <p className="text-xs text-foreground-secondary">{fe.length} courses across schools</p>
          </div>
          <div className="divide-y divide-border">
            {Object.entries(feBySchool).map(([school, courses]) => (
              <div key={school} className="px-4 py-2">
                <Section title={school} count={courses.length}>
                  {courses.map((o) => (
                    <CourseCard
                      key={o.id}
                      offering={o}
                      checked={selected.has(o.id)}
                      disabled={false}
                      onToggle={() => handleToggle(o)}
                      minorGroupLabel={minorOfferingLabels.get(o.id)}
                      studentInfo={data.studentInfo}
                    />
                  ))}
                </Section>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Core Clash */}
      {coreClash.length > 0 && (
        <Section title="Core Clash — Cannot Register" count={coreClash.length} error>
          <div className="space-y-2 opacity-60">
            {coreClash.map((o) => (
              <CourseCard
                key={o.id}
                offering={o}
                checked={false}
                disabled={true}
                onToggle={() => {}}
                clashWith={clashMap.get(o.id)}
                studentInfo={data.studentInfo}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Semester-Long Internship */}
      {(internshipCourses.p399.length > 0 || internshipCourses.p396.length > 0) && (
        <InternshipSection internshipCourses={internshipCourses} />
      )}

      {/* Semester breakdown analysis */}
      {categoryBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Semester Breakdown</p>
            <p className="text-xs text-foreground-secondary">What this semester adds to your transcript</p>
          </div>
          <div className="p-4 space-y-2">
            {categoryBreakdown.map(({ cat, credits, count }) => {
              const color = CATEGORY_COLOR[cat] ?? "bg-surface-secondary text-foreground-secondary border-border";
              const label = CATEGORY_LABEL[cat] ?? cat;
              const pct = Math.min(100, (credits / totalCredits) * 100);
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className={`flex-shrink-0 w-12 text-center px-1.5 py-0.5 text-xs font-semibold rounded border ${color}`}>
                    {label}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-background-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color.includes("primary") ? "bg-primary" : color.includes("secondary") ? "bg-secondary" : color.includes("warning") ? "bg-warning" : color.includes("success") ? "bg-success" : color.includes("info") ? "bg-info" : color.includes("error") ? "bg-error" : color.includes("accent") ? "bg-accent" : "bg-foreground-secondary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="flex-shrink-0 text-sm font-medium text-foreground w-16 text-right">
                    +{formatCredits(credits)} cr
                  </span>
                  <span className="flex-shrink-0 text-xs text-foreground-secondary w-16">
                    {count} course{count !== 1 ? "s" : ""}
                  </span>
                </div>
              );
            })}
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Total</span>
              <span className="text-sm font-semibold text-foreground">
                {formatCredits(totalCredits)} cr · {categoryBreakdown.reduce((s, r) => s + r.count, 0)} courses
              </span>
            </div>
          </div>
        </div>
      )}

        </div>

        {data.programRequirements && (
          <div className="hidden lg:block w-64 flex-shrink-0 sticky top-6 space-y-3">
            <ProgressPanel
              programRequirements={data.programRequirements}
              completedBreakdown={data.completedBreakdown}
              categoryBreakdown={categoryBreakdown}
            />
          </div>
        )}
      </div>

      {/* Mobile floating bubble */}
      {data.programRequirements && (
        <>
          <button
            onClick={() => setProgressOpen(true)}
            className="lg:hidden fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
            aria-label="View progress"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
            </svg>
          </button>

          <AnimatePresence>
            {progressOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                  onClick={() => setProgressOpen(false)}
                />
                <motion.div
                  initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                  className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl border-t border-border p-4 space-y-3 max-h-[80vh] overflow-y-auto"
                >
                  <div className="w-10 h-1 bg-border rounded-full mx-auto mb-2" />
                  <ProgressPanel
                    programRequirements={data.programRequirements}
                    completedBreakdown={data.completedBreakdown}
                    categoryBreakdown={categoryBreakdown}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-foreground-secondary">
              <span className="font-semibold text-foreground">{selectedCount}</span> course{selectedCount !== 1 ? "s" : ""} ·{" "}
              <span className={overLimit ? "text-error font-semibold" : ""}>{formatCredits(totalCredits)} cr</span>
            </p>
            <p className="text-xs text-foreground-secondary">Planning only · not official registration</p>
          </div>
          <button
            onClick={handleSavePlan}
            disabled={saving}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
              disabled:opacity-50 disabled:cursor-not-allowed
              ${saved ? "bg-success text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
          >
            {saving ? (
              <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Saving…" : saved ? "Saved" : "Save Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
