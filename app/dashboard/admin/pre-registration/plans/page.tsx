"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, ChevronDown, ChevronRight, Clock, Search } from "lucide-react";
import { formatCredits } from "@/lib/utils";

interface CourseSummary { code: string; name: string; credits: number }

interface StudentPlan {
  userId: string;
  name: string | null;
  email: string | null;
  enrollmentId: string | null;
  branch: string | null;
  batch: number | null;
  updatedAt: string;
  totalCredits: number;
  courses: CourseSummary[];
}

function PlanRow({ plan }: { plan: StudentPlan }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-surface hover:bg-surface-secondary transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground text-sm">{plan.name ?? plan.email}</span>
            {plan.enrollmentId && (
              <span className="text-xs font-mono text-foreground-secondary">{plan.enrollmentId}</span>
            )}
            {plan.branch && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-primary/10 text-primary border border-primary/20">{plan.branch}</span>
            )}
            {plan.batch && (
              <span className="text-xs text-foreground-secondary">B{plan.batch}</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-foreground-secondary">
            <Clock className="w-3 h-3" />
            <span>Saved {new Date(plan.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right mr-2">
          <span className="text-sm font-semibold text-foreground">{formatCredits(plan.totalCredits)} cr</span>
          <p className="text-xs text-foreground-secondary">{plan.courses.length} courses</p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-foreground-secondary flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-foreground-secondary flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border bg-background px-4 py-3">
          <div className="space-y-1.5">
            {plan.courses.map((c) => (
              <div key={c.code} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs text-foreground-secondary w-20 flex-shrink-0">{c.code}</span>
                <span className="flex-1 text-foreground">{c.name}</span>
                <span className="text-xs text-foreground-secondary flex-shrink-0">{formatCredits(c.credits)} cr</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<StudentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState("ALL");
  const [filterBatch, setFilterBatch] = useState("ALL");

  useEffect(() => {
    // Load all plans across all semesters/years
    Promise.all([
      fetch(`/api/pre-registration/plans?semester=3&year=${new Date().getFullYear()}`).then(r => r.json()),
      fetch(`/api/pre-registration/plans?semester=5&year=${new Date().getFullYear()}`).then(r => r.json()),
      fetch(`/api/pre-registration/plans?semester=7&year=${new Date().getFullYear()}`).then(r => r.json()),
    ]).then(([s3, s5, s7]) => {
      const all = [...(s3.plans ?? []), ...(s5.plans ?? []), ...(s7.plans ?? [])];
      // dedupe by userId (keep latest)
      const byUser = new Map<string, StudentPlan>();
      for (const p of all) byUser.set(p.userId, p);
      setPlans([...byUser.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const branches = useMemo(() => {
    const set = new Set(plans.map(p => p.branch).filter(Boolean) as string[]);
    return ["ALL", ...Array.from(set).sort()];
  }, [plans]);

  const batches = useMemo(() => {
    const set = new Set(plans.map(p => p.batch).filter(Boolean) as number[]);
    return ["ALL", ...Array.from(set).sort((a, b) => b - a).map(String)];
  }, [plans]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return plans.filter(p => {
      if (filterBranch !== "ALL" && p.branch !== filterBranch) return false;
      if (filterBatch !== "ALL" && String(p.batch) !== filterBatch) return false;
      if (q && !(
        p.name?.toLowerCase().includes(q) ||
        p.enrollmentId?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [plans, search, filterBranch, filterBatch]);

  const avgCredits = filtered.length ? filtered.reduce((s, p) => s + p.totalCredits, 0) / filtered.length : 0;

  const coursePop = new Map<string, { name: string; count: number }>();
  for (const p of filtered) {
    for (const c of p.courses) {
      const e = coursePop.get(c.code) ?? { name: c.name, count: 0 };
      coursePop.set(c.code, { ...e, count: e.count + 1 });
    }
  }
  const popularCourses = [...coursePop.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Student Pre-Registration Plans</h1>
        <p className="mt-1 text-sm text-foreground-secondary">See what courses students are planning to register for.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-xs font-medium text-foreground-secondary mb-1">Branch</label>
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm">
            {branches.map((b) => <option key={b} value={b}>{b === "ALL" ? "All Branches" : b}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-secondary mb-1">Batch</label>
          <select value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm">
            {batches.map((b) => <option key={b} value={b}>{b === "ALL" ? "All Batches" : `B${b}`}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-foreground-secondary mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-secondary" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, roll no, email…"
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-foreground-secondary text-sm">No plans saved yet.</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Students with plans", value: filtered.length },
              { label: "Avg credits planned", value: formatCredits(avgCredits) + " cr" },
              { label: "Most popular course", value: popularCourses[0]?.[0] ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-border bg-surface p-4 text-center">
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-foreground-secondary mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Course Popularity</p>
            </div>
            <div className="p-4 space-y-2">
              {popularCourses.map(([code, { name, count }]) => (
                <div key={code} className="flex items-center gap-3">
                  <span className="font-mono text-xs w-20 flex-shrink-0 text-foreground-secondary">{code}</span>
                  <div className="flex-1 h-2 rounded-full bg-background-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${filtered.length ? (count / filtered.length) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm text-foreground w-8 text-right flex-shrink-0">{count}</span>
                  <span className="text-xs text-foreground-secondary hidden sm:block w-48 truncate">{name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-foreground-secondary" />
              <p className="text-sm font-semibold text-foreground">{filtered.length} Student Plan{filtered.length !== 1 ? "s" : ""}</p>
            </div>
            {filtered.length === 0 ? (
              <p className="text-center py-8 text-foreground-secondary text-sm">No students match the current filters.</p>
            ) : filtered.map((p) => <PlanRow key={p.userId} plan={p} />)}
          </div>
        </>
      )}
    </div>
  );
}
