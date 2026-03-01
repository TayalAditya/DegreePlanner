"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Users, Search, BookOpen, TrendingUp, GraduationCap } from "lucide-react";

interface SemesterStat {
  semester: number;
  courses: number;
  credits: number;
}

interface UserStat {
  id: string;
  name: string | null;
  email: string | null;
  enrollmentId: string | null;
  branch: string | null;
  batch: number | null;
  completedCredits: number;
  inProgressCredits: number;
  totalEnrollments: number;
  semesterBreakdown: SemesterStat[];
}

const BRANCH_COLORS: Record<string, string> = {
  CSE:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  DSE:    "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  EE:     "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  ME:     "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  CE:     "bg-green-500/10 text-green-600 dark:text-green-400",
  EP:     "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  MNC:    "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  BE:     "bg-red-500/10 text-red-600 dark:text-red-400",
  GE:     "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  MSE:    "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  MEVLSI: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  BSCS:   "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export default function AdminPage() {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");

  const { data: users = [], isLoading, error } = useQuery<UserStat[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Unauthorized or failed to fetch");
      return res.json();
    },
  });

  const branches = useMemo(
    () => ["ALL", ...Array.from(new Set(users.map((u) => u.branch).filter((b): b is string => b !== null))).sort()],
    [users]
  );

  const maxSem = useMemo(
    () => Math.max(0, ...users.flatMap((u) => u.semesterBreakdown.map((s) => s.semester))),
    [users]
  );
  const semColumns = Array.from({ length: maxSem }, (_, i) => i + 1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const matchSearch =
        !q ||
        u.name?.toLowerCase().includes(q) ||
        u.enrollmentId?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q);
      const matchBranch = branchFilter === "ALL" || u.branch === branchFilter;
      return matchSearch && matchBranch;
    });
  }, [users, search, branchFilter]);

  const totalCompleted = filtered.reduce((s, u) => s + u.completedCredits, 0);
  const totalInProgress = filtered.reduce((s, u) => s + u.inProgressCredits, 0);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-error font-medium">Access denied or failed to load.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          User Overview
        </h1>
        <p className="text-sm text-foreground-secondary mt-1">
          All approved users — credits and semester breakdown
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-foreground-secondary">Users</p>
          <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-foreground-secondary">Branches</p>
          <p className="text-2xl font-bold text-foreground">{branches.length - 1}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-foreground-secondary">Completed Cr</p>
          <p className="text-2xl font-bold text-success">{totalCompleted}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-foreground-secondary">In-Progress Cr</p>
          <p className="text-2xl font-bold text-info">{totalInProgress}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, enrollment ID, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {branches.map((b) => (
            <option key={b} value={b}>{b === "ALL" ? "All Branches" : b}</option>
          ))}
        </select>
      </div>

      {/* Table — desktop */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-surface border border-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border text-foreground-secondary text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-medium">#</th>
                  <th className="px-4 py-3 text-left font-medium">Student</th>
                  <th className="px-4 py-3 text-left font-medium">Branch</th>
                  <th className="px-4 py-3 text-center font-medium">Done Cr</th>
                  <th className="px-4 py-3 text-center font-medium">WIP Cr</th>
                  {semColumns.map((s) => (
                    <th key={s} className="px-3 py-3 text-center font-medium">S{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((user, idx) => {
                  const semMap = Object.fromEntries(
                    user.semesterBreakdown.map((s) => [s.semester, s])
                  );
                  return (
                    <tr key={user.id} className="bg-background hover:bg-surface/60 transition-colors">
                      <td className="px-4 py-3 text-foreground-secondary">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{user.name || "—"}</p>
                        <p className="text-xs text-foreground-secondary">{user.enrollmentId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${BRANCH_COLORS[user.branch || ""] || "bg-border text-foreground-secondary"}`}>
                          {user.branch || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-success">
                        {user.completedCredits}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-info">
                        {user.inProgressCredits || "—"}
                      </td>
                      {semColumns.map((s) => {
                        const sem = semMap[s];
                        return (
                          <td key={s} className="px-3 py-3 text-center">
                            {sem ? (
                              <span className="inline-flex flex-col items-center leading-none">
                                <span className="text-foreground font-medium">{sem.credits}</span>
                                <span className="text-[10px] text-foreground-secondary">{sem.courses}c</span>
                              </span>
                            ) : (
                              <span className="text-border">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5 + semColumns.length} className="px-4 py-10 text-center text-foreground-secondary">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((user, idx) => (
              <div key={user.id} className="bg-surface border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{user.name || "—"}</p>
                    <p className="text-xs text-foreground-secondary">{user.enrollmentId} · {user.email}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-semibold ${BRANCH_COLORS[user.branch || ""] || "bg-border text-foreground-secondary"}`}>
                    {user.branch || "—"}
                  </span>
                </div>

                <div className="flex gap-4 text-sm">
                  <div>
                    <p className="text-xs text-foreground-secondary">Completed</p>
                    <p className="font-bold text-success">{user.completedCredits} cr</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-secondary">In Progress</p>
                    <p className="font-bold text-info">{user.inProgressCredits || 0} cr</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-secondary">Courses</p>
                    <p className="font-bold text-foreground">{user.totalEnrollments}</p>
                  </div>
                </div>

                {user.semesterBreakdown.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {user.semesterBreakdown.map((s) => (
                      <span key={s.semester} className="text-xs bg-background border border-border rounded px-2 py-1 text-foreground-secondary">
                        <span className="font-medium text-foreground">S{s.semester}</span> {s.credits}cr · {s.courses}c
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-foreground-secondary py-8">No users found.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
