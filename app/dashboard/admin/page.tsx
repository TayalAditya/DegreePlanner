"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useCallback } from "react";
import {
  Users, Search, TrendingUp, GraduationCap, Megaphone, Plus, X,
  ChevronDown, ChevronRight, CheckCircle2, Clock, LogIn, ShieldCheck, ShieldX,
} from "lucide-react";
import { UserProgramModal } from "@/components/UserProgramModal";
import { addCredits, formatCredits } from "@/lib/utils";

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
}

const BRANCH_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  CSE:    { bg: "bg-blue-500/10",    text: "text-blue-600 dark:text-blue-400",    dot: "bg-blue-500" },
  DSE:    { bg: "bg-cyan-500/10",    text: "text-cyan-600 dark:text-cyan-400",    dot: "bg-cyan-500" },
  DSAI:   { bg: "bg-cyan-500/10",    text: "text-cyan-600 dark:text-cyan-400",    dot: "bg-cyan-500" },
  EE:     { bg: "bg-yellow-500/10",  text: "text-yellow-600 dark:text-yellow-400", dot: "bg-yellow-500" },
  ME:     { bg: "bg-orange-500/10",  text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
  CE:     { bg: "bg-green-500/10",   text: "text-green-600 dark:text-green-400",  dot: "bg-green-500" },
  EP:     { bg: "bg-purple-500/10",  text: "text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
  MNC:    { bg: "bg-pink-500/10",    text: "text-pink-600 dark:text-pink-400",    dot: "bg-pink-500" },
  BE:     { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",      dot: "bg-red-500" },
  GE:     { bg: "bg-teal-500/10",    text: "text-teal-600 dark:text-teal-400",    dot: "bg-teal-500" },
  MSE:    { bg: "bg-indigo-500/10",  text: "text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-500" },
  MEVLSI: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", dot: "bg-violet-500" },
  BSCS:   { bg: "bg-rose-500/10",   text: "text-rose-600 dark:text-rose-400",    dot: "bg-rose-500" },
};

function BranchBadge({ branch }: { branch: string | null }) {
  if (!branch) return <span className="text-foreground-secondary text-xs">—</span>;
  const c = BRANCH_COLORS[branch];
  if (!c) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-border/40 text-foreground-secondary">
      {branch}
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {branch}
    </span>
  );
}

// ─── Branch → Batch → Users tree (collapsed by default, lazy render) ─────────
function BranchBatchTree({
  users, hasSearch, onViewProgress,
}: {
  users: UserStat[];
  hasSearch: boolean;
  onViewProgress: (u: UserStat) => void;
}) {
  const [openBranches, setOpenBranches] = useState<Set<string>>(new Set());
  const [openBatches, setOpenBatches] = useState<Set<string>>(new Set());

  // Group users: branch → batch → users[]
  const tree = useMemo(() => {
    const map = new Map<string, Map<number, UserStat[]>>();
    for (const u of users) {
      const b = u.branch ?? "Unknown";
      const y = u.batch ?? 0;
      if (!map.has(b)) map.set(b, new Map());
      const batchMap = map.get(b)!;
      if (!batchMap.has(y)) batchMap.set(y, []);
      batchMap.get(y)!.push(u);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [users]);

  // When searching, auto-expand all groups that have results
  const effectiveOpenBranches = hasSearch ? new Set(tree.map(([b]) => b)) : openBranches;
  const effectiveOpenBatches = hasSearch
    ? new Set(tree.flatMap(([b, ym]) => [...ym.keys()].map((y) => `${b}|${y}`)))
    : openBatches;

  const toggleBranch = useCallback((branch: string) => {
    setOpenBranches((prev) => {
      const next = new Set(prev);
      next.has(branch) ? next.delete(branch) : next.add(branch);
      return next;
    });
  }, []);

  const toggleBatch = useCallback((key: string) => {
    setOpenBatches((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  if (users.length === 0)
    return <p className="text-center text-foreground-secondary py-8 text-sm">No users found.</p>;

  return (
    <div className="space-y-2">
      {tree.map(([branch, batchMap]) => {
        const branchOpen = effectiveOpenBranches.has(branch);
        const branchTotal = [...batchMap.values()].reduce((s, a) => s + a.length, 0);
        const branchDone = [...batchMap.values()].flat().reduce((s, u) => s + u.completedCredits, 0);

        return (
          <div key={branch} className="rounded-xl border border-border overflow-hidden">
            {/* Branch header */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 bg-surface hover:bg-surface-secondary transition-colors text-left"
              onClick={() => toggleBranch(branch)}
            >
              {branchOpen
                ? <ChevronDown className="w-4 h-4 text-foreground-secondary flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-foreground-secondary flex-shrink-0" />}
              <BranchBadge branch={branch} />
              <span className="text-xs text-foreground-secondary ml-auto">
                {branchTotal} student{branchTotal !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-success font-medium ml-3">
                {formatCredits(branchDone / Math.max(1, branchTotal))} avg
              </span>
            </button>

            {/* Batch sub-sections */}
            {branchOpen && (
              <div className="border-t border-border divide-y divide-border/60">
                {[...batchMap.entries()].sort(([a], [b]) => b - a).map(([batch, batchUsers]) => {
                  const batchKey = `${branch}|${batch}`;
                  const batchOpen = effectiveOpenBatches.has(batchKey);
                  const label = batch ? `B${batch}` : "Unknown Batch";

                  return (
                    <div key={batchKey}>
                      <button
                        className="w-full flex items-center gap-3 px-6 py-2.5 bg-background hover:bg-surface/50 transition-colors text-left"
                        onClick={() => toggleBatch(batchKey)}
                      >
                        {batchOpen
                          ? <ChevronDown className="w-3.5 h-3.5 text-foreground-secondary/70 flex-shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-foreground-secondary/70 flex-shrink-0" />}
                        <span className="text-xs font-semibold text-foreground-secondary">{label}</span>
                        <span className="text-xs text-foreground-secondary/60 ml-auto">{batchUsers.length} students</span>
                      </button>

                      {/* User rows — only rendered when expanded */}
                      {batchOpen && (
                        <div className="divide-y divide-border/40">
                          {batchUsers.map((u) => (
                            <div key={u.id} className="flex items-center gap-3 px-8 py-2.5 bg-background/60 hover:bg-surface/30 transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{u.name || "—"}</p>
                                <p className="text-xs text-foreground-secondary">{u.enrollmentId}</p>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                                <span className="font-bold text-success">{formatCredits(u.completedCredits)} cr</span>
                                {u.inProgressCredits > 0 && (
                                  <span className="text-info">{formatCredits(u.inProgressCredits)} wip</span>
                                )}
                                <button
                                  onClick={() => onViewProgress(u)}
                                  className="px-3 py-1 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
                                >
                                  Progress
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AnnouncementModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { mutate, isPending, isError } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) throw new Error("Failed to post");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            New Announcement
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground-secondary mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title..."
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-secondary mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your announcement..."
              rows={4}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          {isError && <p className="text-xs text-red-500">Failed to post announcement.</p>}
        </div>
        <div className="flex gap-2 px-5 pb-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm rounded-xl border border-border text-foreground-secondary hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutate()}
            disabled={isPending || !title.trim() || !content.trim()}
            className="flex-1 py-2 text-sm rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isPending ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface LoginAttempt {
  id: string;
  email: string;
  enrollmentId: string | null;
  name: string | null;
  outcome: string;
  reason: string | null;
  batch: number | null;
  branch: string | null;
  createdAt: string;
}

function LoginAttemptsTab() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  const { data: attempts = [], isLoading } = useQuery<LoginAttempt[]>({
    queryKey: ["login-attempts"],
    queryFn: async () => {
      const res = await fetch("/api/admin/login-attempts");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return attempts.filter((a) => {
      const matchSearch = !q || a.email.toLowerCase().includes(q) || (a.enrollmentId||"").toLowerCase().includes(q) || (a.name||"").toLowerCase().includes(q);
      const matchFilter = filter === "ALL" || a.outcome === filter;
      return matchSearch && matchFilter;
    });
  }, [attempts, search, filter]);

  const approved = attempts.filter(a => a.outcome === "approved" || a.outcome === "auto_approved").length;
  const rejected = attempts.filter(a => a.outcome === "rejected").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-foreground-secondary"><LogIn className="w-3.5 h-3.5" /> Total</div>
          <p className="text-2xl font-bold text-foreground">{attempts.length}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-foreground-secondary"><ShieldCheck className="w-3.5 h-3.5 text-success" /> Approved</div>
          <p className="text-2xl font-bold text-success">{approved}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-foreground-secondary"><ShieldX className="w-3.5 h-3.5 text-error" /> Rejected</div>
          <p className="text-2xl font-bold text-error">{rejected}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="Search email, enrollment ID, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="ALL">All</option>
          <option value="approved">Approved</option>
          <option value="auto_approved">Auto-approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({length:5}).map((_,i)=><div key={i} className="h-12 bg-surface border border-border rounded-xl animate-pulse"/>)}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface/80 border-b border-border text-foreground-secondary text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium">Email / ID</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Batch / Branch</th>
                <th className="px-4 py-3 text-left font-medium">Outcome</th>
                <th className="px-4 py-3 text-left font-medium">Reason</th>
                <th className="px-4 py-3 text-left font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((a) => (
                <tr key={a.id} className="bg-background hover:bg-surface/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-foreground font-medium text-xs">{a.email}</p>
                    {a.enrollmentId && <p className="text-foreground-secondary text-xs">{a.enrollmentId}</p>}
                  </td>
                  <td className="px-4 py-3 text-foreground-secondary text-xs">{a.name || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {a.batch && <span className="text-xs px-1.5 py-0.5 rounded bg-surface border border-border text-foreground-secondary">{a.batch}</span>}
                      {a.branch && <BranchBadge branch={a.branch} />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      a.outcome === "rejected" ? "bg-error/10 text-error" :
                      a.outcome === "auto_approved" ? "bg-info/10 text-info" :
                      "bg-success/10 text-success"
                    }`}>
                      {a.outcome === "rejected" ? <ShieldX className="w-3 h-3"/> : <ShieldCheck className="w-3 h-3"/>}
                      {a.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground-secondary">{a.reason || "—"}</td>
                  <td className="px-4 py-3 text-xs text-foreground-secondary whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-foreground-secondary text-sm">No attempts logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"users" | "attempts">("users");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);

  const { data: users = [], isLoading, error } = useQuery<UserStat[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Unauthorized or failed to fetch");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min — don't refetch on every tab switch
  });

  const branches = useMemo(
    () => ["ALL", ...Array.from(new Set(users.map((u) => u.branch).filter((b): b is string => b !== null))).sort()],
    [users]
  );

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

  const totalCompleted = filtered.reduce((s, u) => addCredits(s, u.completedCredits), 0);
  const avgCredits = filtered.length > 0 ? totalCompleted / filtered.length : 0;

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-error font-medium">Access denied or failed to load.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {showAnnounceModal && <AnnouncementModal onClose={() => setShowAnnounceModal(false)} />}
      {selectedUser && (
        <UserProgramModal
          userId={selectedUser.id}
          userName={selectedUser.name}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Admin
          </h1>
        </div>
        <button
          onClick={() => setShowAnnounceModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Announce
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface border border-border rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "users" ? "bg-primary text-primary-foreground" : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"}`}
        >
          <Users className="w-4 h-4" /> Users
        </button>
        <button
          onClick={() => setActiveTab("attempts")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "attempts" ? "bg-primary text-primary-foreground" : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"}`}
        >
          <LogIn className="w-4 h-4" /> Login Attempts
        </button>
      </div>

      {activeTab === "attempts" && <LoginAttemptsTab />}
      {activeTab === "users" && (<>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-foreground-secondary">
            <Users className="w-3.5 h-3.5" /> Users
          </div>
          <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-foreground-secondary">
            <GraduationCap className="w-3.5 h-3.5" /> Branches
          </div>
          <p className="text-2xl font-bold text-foreground">{branches.length - 1}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-foreground-secondary">
            <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Done Cr
          </div>
          <p className="text-2xl font-bold text-success">{formatCredits(totalCompleted)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-foreground-secondary">
            <TrendingUp className="w-3.5 h-3.5 text-info" /> Avg/User
          </div>
          <p className="text-2xl font-bold text-info">{formatCredits(avgCredits)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
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

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-surface border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <BranchBatchTree
          users={filtered}
          hasSearch={!!search}
          onViewProgress={(u) => setSelectedUser({ id: u.id, name: u.name || u.enrollmentId || "—" })}
        />
      )}
      </>)}
    </div>
  );
}
