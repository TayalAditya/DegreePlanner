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
  lastActiveAt?: string;
}

function relativeTime(iso?: string): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
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

// ─── Branch accordion — one open at a time, users sorted by recent activity ───
function BranchBatchTree({
  users, hasSearch, onViewProgress,
}: {
  users: UserStat[];
  hasSearch: boolean;
  onViewProgress: (u: UserStat) => void;
}) {
  // Accordion: only one branch open at a time (null = all closed)
  const [openBranch, setOpenBranch] = useState<string | null>(null);

  // Group users by branch, sorted by completedCredits desc (most active first)
  const tree = useMemo(() => {
    const map = new Map<string, UserStat[]>();
    for (const u of users) {
      const b = u.branch ?? "Unknown";
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push(u);
    }
    // Sort each branch's users by lastActiveAt desc (most recently active first)
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        const ta = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const tb = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        return tb - ta;
      });
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [users]);

  const toggle = useCallback((branch: string) => {
    setOpenBranch((prev) => prev === branch ? null : branch);
  }, []);

  // When searching, show all branches open
  const getOpen = (branch: string) => hasSearch || openBranch === branch;

  if (users.length === 0)
    return <p className="text-center text-foreground-secondary py-8 text-sm">No users found.</p>;

  return (
    <div className="space-y-2">
      {tree.map(([branch, branchUsers]) => {
        const isOpen = getOpen(branch);
        const avg = branchUsers.reduce((s, u) => s + u.completedCredits, 0) / Math.max(1, branchUsers.length);

        return (
          <div key={branch} className="rounded-xl border border-border overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3 bg-surface hover:bg-surface-secondary transition-colors text-left"
              onClick={() => toggle(branch)}
            >
              {isOpen
                ? <ChevronDown className="w-4 h-4 text-foreground-secondary flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-foreground-secondary flex-shrink-0" />}
              <BranchBadge branch={branch} />
              <span className="text-xs text-foreground-secondary ml-auto">
                {branchUsers.length} student{branchUsers.length !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-success font-medium ml-3">
                {formatCredits(avg)} avg
              </span>
            </button>

            {/* User rows — only rendered when open */}
            {isOpen && (
              <div className="border-t border-border divide-y divide-border/40">
                {branchUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-5 py-2.5 bg-background/60 hover:bg-surface/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{u.name || "—"}</p>
                        {u.batch && <span className="text-xs text-foreground-secondary/60 flex-shrink-0">B{u.batch}</span>}
                      </div>
                      <p className="text-xs text-foreground-secondary">{u.enrollmentId}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                      <span className="text-foreground-secondary/50">{relativeTime(u.lastActiveAt)}</span>
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

interface LoginAttemptsResponse {
  attempts: LoginAttempt[];
  filteredTotal: number;
  total: number;
  approved: number;
  rejected: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const PAGE_SIZE = 50;

function LoginAttemptsTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  // Debounce search input
  const searchTimerRef = useMemo(() => ({ current: undefined as ReturnType<typeof setTimeout> | undefined }), []);
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, [searchTimerRef]);

  const { data, isLoading } = useQuery<LoginAttemptsResponse>({
    queryKey: ["login-attempts", page, PAGE_SIZE, debouncedSearch, filter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filter !== "ALL") params.set("outcome", filter);
      const res = await fetch(`/api/admin/login-attempts?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  const attempts = data?.attempts ?? [];
  const total = data?.total ?? 0;
  const approved = data?.approved ?? 0;
  const rejected = data?.rejected ?? 0;
  const filteredTotal = data?.filteredTotal ?? 0;
  const pageCount = data?.pageCount ?? 1;
  const safePage = Math.min(page, pageCount);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-foreground-secondary"><LogIn className="w-3.5 h-3.5" /> Total</div>
          <p className="text-2xl font-bold text-foreground">{total}</p>
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
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}
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
              {attempts.map((a) => (
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
              {attempts.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-foreground-secondary text-sm">No attempts found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 text-xs text-foreground-secondary">
          <span>
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredTotal)} of {filteredTotal}
            {filteredTotal < total && <span className="text-foreground-secondary/60"> (filtered from {total} total)</span>}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <span className="font-medium text-foreground">{safePage} / {pageCount}</span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage >= pageCount}
              className="px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
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
    staleTime: 60_000,
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
