"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, AlertTriangle, CheckCircle, ExternalLink, BookOpen, Info, ChevronDown, ChevronRight, Save, Mail } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { formatCredits } from "@/lib/utils";

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

// Parse slot string into individual tokens e.g. "A1+TA1" → ["A1","TA1"]
function parseSlots(slots: string | null): string[] {
  if (!slots) return [];
  return slots.split("+").map((s) => s.trim()).filter(Boolean);
}

function slotsClash(a: string | null, b: string | null): boolean {
  const sa = new Set(parseSlots(a));
  return parseSlots(b).some((t) => sa.has(t));
}

function CourseCard({
  offering, checked, disabled, onToggle, clashWith, isCompulsory,
}: {
  offering: Offering & { instructorEmail?: string | null };
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  clashWith?: string;
  isCompulsory?: boolean;
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
          {offering.instructorEmail && (
            <a
              href={`mailto:${offering.instructorEmail}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-foreground-secondary hover:text-primary hover:underline"
            >
              <Mail className="w-3 h-3" /> Contact Instructor
            </a>
          )}
        </div>
      </div>
    </label>
  );
}

function Section({ title, count, children, defaultOpen = true }: {
  title: string; count: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="text-xs text-foreground-secondary bg-surface-secondary px-1.5 py-0.5 rounded-full">{count}</span>
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
            <div className="space-y-2 pb-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PreRegistrationPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showApprovalWarning, setShowApprovalWarning] = useState(false);
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
          const validIds = new Set(d.offerings.map((o: Offering) => o.id));
          setSelected(new Set(plan.selectedIds.filter((id) => validIds.has(id))));
          if (plan.selectedIds.length > 0) setSaved(true);
        }
      })
      .catch(() => showToast("error", "Failed to load offerings"))
      .finally(() => setLoading(false));
  }, []);

  // Compulsory course slots (blocked)
  const compulsorySlots = useMemo(() => {
    const s = new Set<string>();
    data?.offerings.filter((o) => o.isCompulsory).forEach((o) => parseSlots(o.slots).forEach((t) => s.add(t)));
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

  if (!data || data.offerings.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-3">
        <BookOpen className="w-10 h-10 text-foreground-secondary mx-auto" />
        <p className="text-lg font-medium text-foreground">No offerings yet</p>
        <p className="text-sm text-foreground-secondary">
          Course offerings for Semester {data?.offeringSemester ?? "—"} haven&apos;t been uploaded yet. Check back soon.
        </p>
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
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-primary/5">
            <p className="text-sm font-semibold text-foreground">Compulsory — IC & DC</p>
            <p className="text-xs text-foreground-secondary">Auto-selected, cannot be removed</p>
          </div>
          <div className="p-4 space-y-2">
            {compulsory.map((o) => (
              <CourseCard
                key={o.id}
                offering={o}
                checked={true}
                disabled={true}
                onToggle={() => {}}
                isCompulsory={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* DE */}
      {de.length > 0 && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <Section title="Discipline Electives" count={de.length} defaultOpen={true}>
              {de.map((o) => (
                <CourseCard
                  key={o.id}
                  offering={o}
                  checked={selected.has(o.id)}
                  disabled={false}
                  onToggle={() => handleToggle(o)}
                  clashWith={interClashMap.get(o.id)}
                />
              ))}
            </Section>
          </div>
        </div>
      )}

      {/* HSS */}
      {hss.length > 0 && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <Section title="Humanities & Social Sciences" count={hss.length} defaultOpen={true}>
              {hss.map((o) => (
                <CourseCard
                  key={o.id}
                  offering={o}
                  checked={selected.has(o.id)}
                  disabled={false}
                  onToggle={() => handleToggle(o)}
                />
              ))}
            </Section>
          </div>
        </div>
      )}

      {/* FE by school */}
      {fe.length > 0 && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-4 pt-3 pb-0 border-b border-border">
            <p className="text-sm font-semibold text-foreground pb-3">Free Electives</p>
          </div>
          {Object.entries(feBySchool).map(([school, courses]) => (
            <div key={school} className="px-4 py-3 border-b border-border last:border-0">
              <Section title={school} count={courses.length} defaultOpen={false}>
                {courses.map((o) => (
                  <CourseCard
                    key={o.id}
                    offering={o}
                    checked={selected.has(o.id)}
                    disabled={false}
                    onToggle={() => handleToggle(o)}
                  />
                ))}
              </Section>
            </div>
          ))}
        </div>
      )}

      {/* Core Clash */}
      {coreClash.length > 0 && (
        <div className="rounded-xl border border-error/20 bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-error/20 bg-error/5">
            <p className="text-sm font-semibold text-error">Core Clash — Cannot Register</p>
            <p className="text-xs text-foreground-secondary">These courses conflict with your compulsory courses</p>
          </div>
          <div className="p-4 space-y-2 opacity-60">
            {coreClash.map((o) => (
              <CourseCard
                key={o.id}
                offering={o}
                checked={false}
                disabled={true}
                onToggle={() => {}}
                clashWith={clashMap.get(o.id)}
              />
            ))}
          </div>
        </div>
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
          <div className="hidden lg:block w-72 flex-shrink-0 sticky top-6 space-y-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Degree Progress</p>
          {(["IC","DC","DE","HSS","FE"] as const).map((cat) => {
            const req = data.programRequirements![cat] ?? 0;
            if (!req) return null;
            const done = data.completedBreakdown[cat] ?? 0;
            const adding = categoryBreakdown.find(b => b.cat === cat)?.credits ?? 0;
            const after = Math.min(req, done + adding);
            const remaining = Math.max(0, req - done - adding);
            const pctDone = Math.min(100, (done / req) * 100);
            const pctAdding = Math.min(100 - pctDone, (adding / req) * 100);
            const catColor = CATEGORY_COLOR[cat] ?? "";
            const barColor = cat === "DC" ? "bg-primary" : cat === "DE" ? "bg-secondary" : cat === "HSS" ? "bg-warning" : cat === "IC" ? "bg-info" : "bg-success";
            const addColor = cat === "DC" ? "bg-primary/40" : cat === "DE" ? "bg-secondary/40" : cat === "HSS" ? "bg-warning/40" : cat === "IC" ? "bg-info/40" : "bg-success/40";
            return (
              <div key={cat} className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${catColor}`}>{cat}</span>
                  <div className="text-xs text-foreground-secondary text-right">
                    <span className="font-medium text-foreground">{formatCredits(done + adding)}</span>
                    <span> / {req} cr</span>
                    {remaining > 0 && <span className="text-error ml-1">−{formatCredits(remaining)}</span>}
                  </div>
                </div>
                <div className="h-2 rounded-full bg-background-secondary overflow-hidden flex">
                  <div className={`h-full ${barColor} transition-all`} style={{ width: `${pctDone}%` }} />
                  <div className={`h-full ${addColor} transition-all`} style={{ width: `${pctAdding}%` }} />
                </div>
                {adding > 0 && (
                  <p className="text-xs text-foreground-secondary mt-0.5">+{formatCredits(adding)} cr this sem</p>
                )}
              </div>
            );
          })}
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 space-y-1.5 text-xs text-foreground-secondary">
          <div className="flex gap-2 items-center">
            <div className="w-3 h-2 rounded bg-primary" />
            <span>Already completed</span>
          </div>
          <div className="flex gap-2 items-center">
            <div className="w-3 h-2 rounded bg-primary/40" />
            <span>Adding this semester</span>
          </div>
        </div>
          </div>
        )}
      </div>

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
            disabled={selectedCount === 0 || saving}
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
