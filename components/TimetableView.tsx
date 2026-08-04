"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  Edit,
  Loader2,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  X,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./ToastProvider";
import { TimetableImageActions } from "./TimetableImageActions";
import { formatCourseCode, formatCredits } from "@/lib/utils";
import { downloadICS } from "@/lib/icsGenerator";
import {
  IC_SLOTS,
  LAB_SLOTS,
  NON_IC_FOURTH_SESSION,
  NON_IC_SLOTS,
  normalizeTimetableCourseCode,
  requiresFourthNonIcTheorySession,
} from "@/lib/officialTimetable";

interface TimetableViewProps {
  userId: string;
}

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const WEEK_DAYS = DAYS;

const pad2 = (n: number) => String(n).padStart(2, "0");
const minutesToTime = (minutes: number) => `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;

// Generate time options: :00, :20, :30, :50 for each hour from 8am to 8pm
const TIME_OPTIONS: string[] = [];
for (let hour = 8; hour <= 20; hour++) {
  TIME_OPTIONS.push(`${pad2(hour)}:00`);
  if (hour < 20) {
    TIME_OPTIONS.push(`${pad2(hour)}:20`);
    TIME_OPTIONS.push(`${pad2(hour)}:30`);
    TIME_OPTIONS.push(`${pad2(hour)}:50`);
  }
}
const START_TIMES = TIME_OPTIONS.slice(0, -1);
const END_TIMES = TIME_OPTIONS.slice(1);

// Week view display times — 30-minute intervals (08:00, 08:30, 09:00 … 19:30)
const WEEK_VIEW_TIMES: string[] = [];
for (let hour = 8; hour < 20; hour++) {
  WEEK_VIEW_TIMES.push(`${pad2(hour)}:00`);
  WEEK_VIEW_TIMES.push(`${pad2(hour)}:30`);
}
const DEFAULT_START_TIME = START_TIMES.includes("10:00") ? "10:00" : START_TIMES[0];
// Default to 50 minutes duration
const DEFAULT_END_TIME = START_TIMES.includes("10:00") && END_TIMES.includes("10:50") ? "10:50" : (END_TIMES.find(t => {
  const [sh, sm] = DEFAULT_START_TIME.split(':').map(Number);
  const [eh, em] = t.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm) === 50;
}) || END_TIMES[0]);

type DayOfWeek = (typeof DAYS)[number];
type Term = "FALL" | "SPRING" | "SUMMER";
type ClassType = "LECTURE" | "LAB" | "TUTORIAL" | "SEMINAR" | "WORKSHOP" | "TA_DUTY";
type TimetableKind = "NON_IC" | "IC";

type MeetingDraft = {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slot?: string;
  venue?: string;
  classType: ClassType;
};


const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const COURSE_COLORS = [
  { bg: "bg-blue-500/10 dark:bg-blue-400/10", border: "border-blue-500/45 dark:border-blue-400/35", text: "text-blue-800 dark:text-blue-200", hover: "hover:bg-blue-500/15 dark:hover:bg-blue-400/15", accent: "bg-blue-500" },
  { bg: "bg-emerald-500/10 dark:bg-emerald-400/10", border: "border-emerald-500/45 dark:border-emerald-400/35", text: "text-emerald-800 dark:text-emerald-200", hover: "hover:bg-emerald-500/15 dark:hover:bg-emerald-400/15", accent: "bg-emerald-500" },
  { bg: "bg-violet-500/10 dark:bg-violet-400/10", border: "border-violet-500/45 dark:border-violet-400/35", text: "text-violet-800 dark:text-violet-200", hover: "hover:bg-violet-500/15 dark:hover:bg-violet-400/15", accent: "bg-violet-500" },
  { bg: "bg-orange-500/10 dark:bg-orange-400/10", border: "border-orange-500/45 dark:border-orange-400/35", text: "text-orange-800 dark:text-orange-200", hover: "hover:bg-orange-500/15 dark:hover:bg-orange-400/15", accent: "bg-orange-500" },
  { bg: "bg-pink-500/10 dark:bg-pink-400/10", border: "border-pink-500/45 dark:border-pink-400/35", text: "text-pink-800 dark:text-pink-200", hover: "hover:bg-pink-500/15 dark:hover:bg-pink-400/15", accent: "bg-pink-500" },
  { bg: "bg-teal-500/10 dark:bg-teal-400/10", border: "border-teal-500/45 dark:border-teal-400/35", text: "text-teal-800 dark:text-teal-200", hover: "hover:bg-teal-500/15 dark:hover:bg-teal-400/15", accent: "bg-teal-500" },
  { bg: "bg-indigo-500/10 dark:bg-indigo-400/10", border: "border-indigo-500/45 dark:border-indigo-400/35", text: "text-indigo-800 dark:text-indigo-200", hover: "hover:bg-indigo-500/15 dark:hover:bg-indigo-400/15", accent: "bg-indigo-500" },
  { bg: "bg-rose-500/10 dark:bg-rose-400/10", border: "border-rose-500/45 dark:border-rose-400/35", text: "text-rose-800 dark:text-rose-200", hover: "hover:bg-rose-500/15 dark:hover:bg-rose-400/15", accent: "bg-rose-500" },
  { bg: "bg-amber-500/10 dark:bg-amber-400/10", border: "border-amber-500/45 dark:border-amber-400/35", text: "text-amber-800 dark:text-amber-200", hover: "hover:bg-amber-500/15 dark:hover:bg-amber-400/15", accent: "bg-amber-500" },
  { bg: "bg-cyan-500/10 dark:bg-cyan-400/10", border: "border-cyan-500/45 dark:border-cyan-400/35", text: "text-cyan-800 dark:text-cyan-200", hover: "hover:bg-cyan-500/15 dark:hover:bg-cyan-400/15", accent: "bg-cyan-500" },
];

function getCourseColor(courseCode: string, classType?: string): typeof COURSE_COLORS[0] {
  // Special color for TA duties
  if (classType === "TA_DUTY") {
    return { bg: "bg-amber-500/10 dark:bg-amber-400/10", border: "border-amber-500/45 dark:border-amber-400/35", text: "text-amber-800 dark:text-amber-200", hover: "hover:bg-amber-500/15 dark:hover:bg-amber-400/15", accent: "bg-amber-500" };
  }
  const hash = courseCode.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COURSE_COLORS[hash % COURSE_COLORS.length];
}

function parseTimeRange12h(range: string): { startTime: string; endTime: string } | null {
  const normalized = range.replace(/\s+/g, " ").trim();
  const m = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return null;

  const sh = Number(m[1]);
  const sm = Number(m[2] || "0");
  const eh = Number(m[3]);
  const em = Number(m[4] || "0");
  const period = m[5].toUpperCase() as "AM" | "PM";

  const to24 = (h: number) => {
    const base = period === "PM" ? (h % 12) + 12 : h % 12;
    return base;
  };

  const startH = to24(sh);
  const endH = to24(eh);
  const startTime = `${pad2(startH)}:${pad2(sm)}`;
  const endTime = `${pad2(endH)}:${pad2(em)}`;
  return { startTime, endTime };
}

function extractSlotTokens(slotRaw: string): string[] {
  const text = slotRaw.toUpperCase();
  const tokens: string[] = [];

  for (const match of text.matchAll(/\b(L[1-5]|[A-H])\b/g)) {
    tokens.push(match[1]);
  }

  // De-dupe while keeping order.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    unique.push(t);
  }
  return unique;
}

const CLASS_TYPE_LABEL: Record<ClassType, string> = {
  LECTURE: "Lecture",
  LAB: "Lab",
  TUTORIAL: "Tutorial",
  SEMINAR: "Seminar",
  WORKSHOP: "Workshop",
  TA_DUTY: "TA Duty",
};

interface TimetableEntry {
  id: string;
  semester: number;
  year: number;
  term: Term;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slot?: string | null;
  venue?: string | null;
  roomNumber?: string | null;
  building?: string | null;
  classType: ClassType;
  instructor?: string | null;
  notes?: string | null;
  courseId?: string | null;
  googleEventId?: string | null;
  isApproved: boolean;
  isOfficial?: boolean;
  isOfficialCorrection?: boolean;
  canReportCorrection?: boolean;
  replacesOfficial?: {
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
  };
  approvedById?: string | null;
  approvedAt?: Date | null;
  createdById?: string | null;
  updatedById?: string | null;
  createdAt: Date;
  updatedAt: Date;
  course?: {
    id: string;
    code: string;
    name: string;
    credits: number;
  } | null;
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
    enrollmentId?: string | null;
  } | null;
  updatedBy?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  approvedBy?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface CourseOption {
  id: string;
  code: string;
  name: string;
  credits: number;
  ltpc?: string | null;
}

type TimetableEntryPayload = {
  courseId?: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slot?: string;
  venue?: string;
  classType?: ClassType;
  instructor?: string;
  notes?: string;
  requestApproval?: boolean;
};

type BulkCreatePayload = {
  courseId?: string;
  replaceExisting?: boolean;
  entries: Array<Omit<TimetableEntryPayload, "courseId">>;
};

type TimetableResponse = {
  context: { semester: number; year: number; term: Term };
  isAdmin: boolean;
  isPublishedSchedule: boolean;
  courses: CourseOption[];
  completedCourses: CourseOption[];
  entries: TimetableEntry[];
  planWarnings?: {
    hasSavedPlan: boolean;
    totalCredits: number;
    overThirtyCredits: boolean;
    clashes: Array<{ first: string; second: string }>;
  };
};

type TimetableAutofillData = {
  version: string;
  venues: string[];
  defaults: {
    nonIc: Record<string, { slot?: string; classroom?: string }>;
    ic: Record<string, { slot?: string; classroom?: string }>;
  };
  pcLab: Record<string, {
    kind: "IC" | "NON_IC";
    slot?: string;
    day?: string;
    venue?: string;
    time?: string;
    allocations?: Array<{
      branches?: string[];
      slot: string;
      day: string;
      venue: string;
      time: string;
      classType?: "LAB" | "TUTORIAL";
    }>;
  }>;
};

function findOfficialVenue(data: TimetableAutofillData | undefined, courseCode: string): string | undefined {
  if (!data || !courseCode) return undefined;
  const normalized = normalizeTimetableCourseCode(courseCode);
  const defaults = { ...data.defaults.nonIc, ...data.defaults.ic };
  const direct = defaults[normalized]?.classroom?.trim();
  if (direct) return direct;

  // Older cached data may only contain a section code such as HS-202-2.
  // Use it only when every matching section agrees on the same classroom.
  const candidates = Object.entries(defaults)
    .filter(([code, value]) => code.replace(/-\d+Y?$/, "") === normalized && value.classroom?.trim())
    .map(([, value]) => value.classroom!.trim());
  const unique = Array.from(new Set(candidates));
  return unique.length === 1 ? unique[0] : undefined;
}

function suggestKindAndSlot(
  courseCode: string,
  data: TimetableAutofillData
): { kind: TimetableKind; slot: string; classroom: string; pcLab?: TimetableAutofillData["pcLab"][string] } | null {
  const nonIcDefault = data.defaults.nonIc?.[courseCode];
  const icDefault = data.defaults.ic?.[courseCode];

  if (!nonIcDefault && !icDefault) return null;

  const nonIcSlot = nonIcDefault?.slot;
  const suggestedKind: TimetableKind =
    typeof nonIcSlot === "string" && nonIcSlot.toLowerCase().includes("ic courses time table")
      ? "IC"
      : courseCode.startsWith("IC-")
        ? "IC"
        : "NON_IC";

  const slot = (() => {
    if (suggestedKind === "IC") return icDefault?.slot?.trim() || "";
    const nonIc = nonIcDefault?.slot?.trim() || "";
    if (nonIc.toLowerCase().includes("ic courses time table")) {
      return icDefault?.slot?.trim() || "";
    }
    return nonIc;
  })();

  const classroom = (suggestedKind === "IC" ? icDefault?.classroom : nonIcDefault?.classroom) || "";
  const pcLab = data.pcLab?.[courseCode];
  return { kind: suggestedKind, slot, classroom, pcLab };
}

function buildEntriesFromSlot(opts: {
  slotRaw: string;
  kind: TimetableKind;
  ltpc?: string | null;
  defaultVenue: string;
  pcLab?: TimetableAutofillData["pcLab"][string];
}): { entries: Array<Omit<TimetableEntryPayload, "courseId">>; warnings: string[] } {
  const normalizedSlot = opts.slotRaw.trim();
  const warnings: string[] = [];
  const tokens = extractSlotTokens(normalizedSlot);

  if (!normalizedSlot) return { entries: [], warnings };

  const textUpper = normalizedSlot.toUpperCase();
  if (textUpper.includes("LAB SLOT") && !tokens.some((t) => t.startsWith("L"))) {
    warnings.push("This slot includes a lab component — add an L1–L5 slot to include the lab.");
  }

  const pcKind = opts.kind === "IC" ? "IC" : "NON_IC";
  const pcLabSlots = new Set((opts.pcLab?.slot || "").toUpperCase().match(/L[1-5]/g) || []);
  const pcLabApplies = opts.pcLab?.kind === pcKind;

  const next: Array<Omit<TimetableEntryPayload, "courseId">> = [];

  for (const token of tokens) {
    if (/^[A-H]$/.test(token)) {
      const sessions = opts.kind === "IC" ? IC_SLOTS[token] : NON_IC_SLOTS[token];
      for (const s of sessions || []) {
        next.push({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          slot: token,
          venue: opts.defaultVenue || undefined,
          classType: "LECTURE",
        });
      }
      const fourth =
        opts.kind === "NON_IC" && requiresFourthNonIcTheorySession(opts.ltpc)
          ? NON_IC_FOURTH_SESSION[token]
          : undefined;
      if (fourth) {
        next.push({
          dayOfWeek: fourth.dayOfWeek,
          startTime: fourth.startTime,
          endTime: fourth.endTime,
          slot: token,
          venue: opts.defaultVenue || undefined,
          classType: "LECTURE",
        });
      }
      continue;
    }

    if (/^L[1-5]$/.test(token)) {
      const base = LAB_SLOTS[token] || [];
      const pcMatches = pcLabApplies && (pcLabSlots.size === 0 || pcLabSlots.has(token));
      const pcRange = pcMatches ? parseTimeRange12h(opts.pcLab?.time || "") : null;
      const labVenue = pcMatches ? opts.pcLab?.venue : opts.defaultVenue;

      for (const s of base) {
        next.push({
          dayOfWeek: s.dayOfWeek,
          startTime: pcRange?.startTime || s.startTime,
          endTime: pcRange?.endTime || s.endTime,
          slot: token,
          venue: labVenue || undefined,
          classType: "LAB",
        });
      }
      continue;
    }
  }

  if (pcLabApplies && !tokens.some((t) => t.startsWith("L"))) {
    warnings.push("PC lab allocation found — add an L1–L5 slot to include the lab timing/venue.");
  }

  next.sort((a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek) || a.startTime.localeCompare(b.startTime));

  return { entries: next, warnings };
}

export function TimetableView({ userId }: TimetableViewProps) {
  const [view, setView] = useState<"week" | "list">("list");
  const [publishedScheduleMode, setPublishedScheduleMode] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [addingTaDuty, setAddingTaDuty] = useState(false);

  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();

  // Auto switch to list view on mobile
  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 768) setView("list");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const { data: timetable, isLoading } = useQuery<TimetableResponse>({
    queryKey: ["timetable", userId, publishedScheduleMode],
    queryFn: async () => {
      const res = await fetch(publishedScheduleMode ? "/api/timetable?mode=published" : "/api/timetable");
      if (!res.ok) throw new Error("Failed to fetch timetable");
      return res.json();
    },
    // Saved plans and course withdrawals can change on another dashboard page
    // (or another tab). Always reconcile with the server when this view opens
    // or regains focus instead of briefly showing the previous plan snapshot.
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const { data: autofillData } = useQuery<TimetableAutofillData>({
    queryKey: ["timetable-autofill"],
    queryFn: async () => {
      const res = await fetch("/api/timetable/autofill");
      if (!res.ok) throw new Error("Failed to load timetable data");
      return res.json();
    },
    staleTime: 60_000 * 60,
  });

  // Fetch pending entries for admin
  const { data: pendingData } = useQuery<{ entries: TimetableEntry[] }>({
    queryKey: ["timetable-pending"],
    queryFn: async () => {
      const res = await fetch("/api/timetable/admin");
      if (!res.ok) {
        if (res.status === 403) return { entries: [] }; // Not admin
        throw new Error("Failed to fetch pending entries");
      }
      return res.json();
    },
    enabled: Boolean(timetable?.context) && Boolean(timetable?.isAdmin) && publishedScheduleMode,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ entryId, action }: { entryId: string; action: "approve" | "reject" }) => {
      const res = await fetch("/api/timetable/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to process approval");
      }
      return res.json();
    },
    onSuccess: async (_, { action }) => {
      await queryClient.invalidateQueries({ queryKey: ["timetable-pending"] });
      await queryClient.invalidateQueries({ queryKey: ["timetable", userId] });
      showToast("success", action === "approve" ? "Entry approved" : "Entry rejected");
    },
    onError: (error: any) => {
      showToast("error", error?.message || "Failed to process approval");
    },
  });

  const saveEntryMutation = useMutation({
    mutationFn: async (args: { id?: string; payload: TimetableEntryPayload }) => {
      const { id, payload } = args;
      const reportingOfficial = Boolean(id?.startsWith("official:"));
      const res = await fetch(id && !reportingOfficial ? `/api/timetable/${id}` : "/api/timetable", {
        method: id && !reportingOfficial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportingOfficial ? {
          ...payload,
          requestApproval: true,
          replacesOfficial: editingEntry ? {
            dayOfWeek: editingEntry.dayOfWeek,
            startTime: editingEntry.startTime,
            endTime: editingEntry.endTime,
          } : undefined,
        } : payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || (id ? "Failed to submit timetable change" : "Failed to add class"));
      }
      return data as TimetableEntry;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["timetable", userId] });
      const reportedOfficial = Boolean(variables.id?.startsWith("official:"));
      showToast(
        "success",
        reportedOfficial || editingEntry?.isOfficialCorrection
          ? "Correction reported — waiting for admin approval"
          : editingEntry
            ? "Class updated"
            : "Class added",
      );
      setModalOpen(false);
      setEditingEntry(null);
    },
    onError: (error: any) => {
      showToast("error", error?.message || "Something went wrong");
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (payload: BulkCreatePayload) => {
      const res = await fetch("/api/timetable/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to add classes");
      }
      return data as { entries: TimetableEntry[] };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["timetable", userId] });
      showToast("success", "Classes added");
      setModalOpen(false);
      setEditingEntry(null);
    },
    onError: (error: any) => {
      showToast("error", error?.message || "Something went wrong");
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/timetable/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to delete class");
      return true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["timetable", userId] });
      showToast("success", "Class deleted");
      setModalOpen(false);
      setEditingEntry(null);
      setAddingTaDuty(false);
    },
    onError: (error: any) => {
      showToast("error", error?.message || "Failed to delete class");
    },
  });

  const autofillMissingMutation = useMutation({
    mutationFn: async (
      payloads: Array<{
        courseId: string;
        courseCode: string;
        entries: Array<Omit<TimetableEntryPayload, "courseId">>;
      }>
    ) => {
      const failures: Array<{ courseCode: string; error: string }> = [];
      let createdCourses = 0;
      let createdClasses = 0;

      for (const p of payloads) {
        try {
          const res = await fetch("/api/timetable/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ courseId: p.courseId, entries: p.entries } satisfies BulkCreatePayload),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            const msg = data?.error || "Failed to add classes";
            // If another user already created this schedule, treat as a soft failure.
            failures.push({ courseCode: p.courseCode, error: msg });
            continue;
          }

          createdCourses += 1;
          createdClasses += p.entries.length;
        } catch (e: any) {
          failures.push({ courseCode: p.courseCode, error: e?.message || "Failed to add classes" });
        }
      }

      return { createdCourses, createdClasses, failures };
    },
    onSuccess: async (summary) => {
      await queryClient.invalidateQueries({ queryKey: ["timetable", userId] });

      if (summary.failures.length > 0) {
        showToast(
          "warning",
          `Auto-filled ${summary.createdCourses} courses (${summary.createdClasses} classes). ${summary.failures.length} failed — open modal to add manually.`
        );
      } else {
        showToast("success", `Auto-filled ${summary.createdCourses} courses (${summary.createdClasses} classes).`);
      }
    },
    onError: (error: any) => {
      showToast("error", error?.message || "Failed to auto-fill timetable");
    },
  });

  const openAdd = () => {
    setAddingTaDuty(false);
    setEditingEntry(null);
    setModalOpen(true);
  };

  const openAddTADuty = () => {
    setAddingTaDuty(true);
    setEditingEntry(null);
    setModalOpen(true);
  };

  const openEdit = async (entry: TimetableEntry) => {
    if (!isAdmin && entry.isOfficial && entry.canReportCorrection === false) {
      showToast("info", "This official class is visible from course registration, but it is not linked to the course catalog yet.");
      return;
    }
    if (!isAdmin && entry.isOfficial) {
      const ok = await confirm({
        title: "Report a timetable correction?",
        message: `${formatCourseCode(entry.course?.code || "This course")} is shown from the approved Aug–Nov 2026 timetable. Any slot, time, or venue change you submit will be sent to the admin for approval; the official schedule stays visible until it is approved.`,
        confirmText: "Report correction",
      });
      if (!ok) return;
    } else if (!isAdmin && entry.isOfficialCorrection) {
      const ok = await confirm({
        title: "Update this approved correction?",
        message: "Your update will be sent for admin approval. The currently approved timing remains visible until the update is approved.",
        confirmText: "Update correction",
      });
      if (!ok) return;
    }
    setAddingTaDuty(false);
    setEditingEntry(entry);
    setModalOpen(true);
  };

  const handleDelete = async (entry: TimetableEntry) => {
    if (entry.isOfficial) {
      showToast("info", "Approved timetable classes cannot be deleted. Open the class to report a correction.");
      return;
    }
    if (entry.isOfficialCorrection && !isAdmin) {
      showToast("info", "Approved timetable corrections cannot be deleted. Submit another correction instead.");
      return;
    }
    const ok = await confirm({
      title: "Delete class?",
      message: `This will remove ${entry.course?.code || "this class"} from the shared timetable for everyone enrolled in this course.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    deleteEntryMutation.mutate(entry.id);
  };

  const handleDeleteCalendar = async (entry: TimetableEntry) => {
    if (!entry.googleEventId) return;
    try {
      const res = await fetch("/api/calendar/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: entry.googleEventId }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast("success", "Removed from Google Calendar");
      await queryClient.invalidateQueries({ queryKey: ["timetable", userId] });
    } catch {
      showToast("error", "Failed to remove from Google Calendar");
    }
  };

  const [clearingCalendar, setClearingCalendar] = useState(false);
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
  const [calendarSelected, setCalendarSelected] = useState<Set<string>>(new Set());
  const [calendarExporting, setCalendarExporting] = useState(false);
  const [autofillPickerOpen, setAutofillPickerOpen] = useState(false);
  const [autofillSelected, setAutofillSelected] = useState<Set<string>>(new Set());
  const [planWarningDismissed, setPlanWarningDismissed] = useState(false);
  const handleClearAllCalendar = async () => {
    const synced = entries.filter((e) => e.googleEventId);
    if (synced.length === 0) {
      showToast("info", "No calendar events to remove");
      return;
    }
    const ok = await confirm({
      title: "Remove all from Google Calendar?",
      message: `This will delete all ${synced.length} timetable events from your Google Calendar. You can add them again anytime.`,
      confirmText: "Remove all",
      variant: "danger",
    });
    if (!ok) return;
    setClearingCalendar(true);
    let removed = 0;
    await Promise.all(
      synced.map(async (entry) => {
        try {
          const res = await fetch("/api/calendar/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: entry.googleEventId }),
          });
          if (res.ok) removed++;
        } catch {}
      })
    );
    setClearingCalendar(false);
    showToast(removed > 0 ? "success" : "error", removed > 0 ? `Removed ${removed} events from Google Calendar` : "Failed to remove events");
    await queryClient.invalidateQueries({ queryKey: ["timetable", userId] });
  };

  const context = timetable?.context ?? null;
  const courses = useMemo(() => timetable?.courses ?? [], [timetable?.courses]);
  const completedCourses = useMemo(() => timetable?.completedCourses ?? [], [timetable?.completedCourses]);
  const isAdmin = Boolean(timetable?.isAdmin);
  const isPublishedSchedule = Boolean(timetable?.isPublishedSchedule);
  const entries = useMemo<TimetableEntry[]>(() =>
    (timetable?.entries ?? []).map((entry) => {
      if (entry.venue || !entry.course?.code) return entry;
      const officialVenue = findOfficialVenue(autofillData, entry.course.code);
      return officialVenue ? { ...entry, venue: officialVenue } : entry;
    }),
  [timetable?.entries, autofillData]);
  const canAddClass = courses.length > 0 && Boolean(context);
  const canAddTaDuty = Boolean(context);

  const modalCourses = useMemo(() => {
    const isTaDuty = addingTaDuty || editingEntry?.classType === "TA_DUTY";
    return isTaDuty ? completedCourses : courses;
  }, [addingTaDuty, editingEntry?.classType, completedCourses, courses]);

  const scheduledCourseIds = useMemo(() => new Set(entries.map((e) => e.courseId)), [entries]);

  const autofillCandidates = useMemo(() => {
    if (!autofillData) return [];
    const missing = courses.filter((c) => !scheduledCourseIds.has(c.id));

    const next: Array<{
      courseId: string;
      courseCode: string;
      entries: Array<Omit<TimetableEntryPayload, "courseId">>;
    }> = [];

    for (const c of missing) {
      const suggestion = suggestKindAndSlot(c.code, autofillData);
      if (!suggestion?.slot) continue;

      const result = buildEntriesFromSlot({
        slotRaw: suggestion.slot,
        kind: suggestion.kind,
        ltpc: c.ltpc,
        defaultVenue: suggestion.classroom,
        pcLab: suggestion.pcLab,
      });

      if (result.entries.length === 0) continue;

      next.push({ courseId: c.id, courseCode: c.code, entries: result.entries });
    }

    return next;
  }, [autofillData, courses, scheduledCourseIds]);

  const canAutofill = canAddClass && autofillCandidates.length > 0;

  const openCalendarPicker = () => {
    if (entries.length === 0) { showToast("warning", "No classes to export"); return; }
    // Pre-select all entries (synced + unsynced); user can deselect
    setCalendarSelected(new Set(entries.map((e) => e.id)));
    setCalendarPickerOpen(true);
  };

  const handleConfirmCalendarExport = async (selected: Set<string>) => {
    const toExport = entries.filter((e) => selected.has(e.id));
    if (toExport.length === 0) { setCalendarPickerOpen(false); return; }
    setCalendarExporting(true);
    try {
      const response = await fetch("/api/calendar/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: toExport }),
      });
      const data = await response.json();

      // Always refresh cache so googleEventId reflects new state
      await queryClient.invalidateQueries({ queryKey: ["timetable", userId] });
      setCalendarPickerOpen(false);

      if (response.ok && data.success) {
        showToast("success", data.message || "Events added to Google Calendar");
        if (data.failures?.length > 0) console.warn("[Calendar] Failed events:", data.failures);
        return;
      }
      if (response.ok && !data.success) {
        const firstErr = data.failures?.[0]?.error || "Unknown error";
        if (data.needs_reauth || /insufficient|scope|unauthorized|invalid_grant|token/i.test(firstErr)) {
          showToast("error", "Google Calendar: No permission — please Sign Out and Sign In again.");
        } else {
          showToast("error", `Calendar sync failed: ${firstErr}`);
        }
        return;
      }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          showToast("error", data.error || "Google Calendar auth expired — please sign out and sign in again.");
        } else {
          showToast("error", data.error || `Calendar error (${response.status})`);
        }
      }
    } catch {
      const endDate = new Date("2026-11-30T23:59:59+05:30");
      downloadICS(entries, `timetable-${context?.term || "current"}.ics`, endDate);
      showToast("warning", "Network error — calendar file downloaded as backup");
    } finally {
      setCalendarExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-96 bg-background-secondary dark:bg-surface rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!planWarningDismissed && timetable?.planWarnings &&
        (timetable.planWarnings.overThirtyCredits || timetable.planWarnings.clashes.length > 0) && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="plan-warning-title">
            <button
              type="button"
              className="absolute inset-0 bg-black/55 backdrop-blur-sm"
              onClick={() => setPlanWarningDismissed(true)}
              aria-label="Close warning"
            />
            <div className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-warning/30 bg-surface shadow-2xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-6 h-6 text-warning" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="plan-warning-title" className="text-lg font-semibold text-foreground">Please modify your course registration</h2>
                  <p className="mt-1 text-sm leading-6 text-foreground-secondary">
                    You have selected courses with clashing timings or a plan exceeding the 30-credit limit. Modify your course registration, save it, then come back to see the corrected timetable.
                  </p>
                </div>
                <button type="button" onClick={() => setPlanWarningDismissed(true)} className="dp-icon-btn shrink-0" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 space-y-2 text-sm">
                {timetable.planWarnings.overThirtyCredits && (
                  <p className="font-medium text-warning">{formatCredits(timetable.planWarnings.totalCredits)} credits selected · maximum 30</p>
                )}
                {timetable.planWarnings.clashes.map((clash) => (
                  <p key={`${clash.first}-${clash.second}`} className="text-foreground-secondary">
                    <span className="font-medium text-foreground">{formatCourseCode(clash.first)}</span> clashes with <span className="font-medium text-foreground">{formatCourseCode(clash.second)}</span>
                  </p>
                ))}
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <button type="button" onClick={() => setPlanWarningDismissed(true)} className="dp-btn dp-btn-outline sm:flex-1">View timetable anyway</button>
                <a href="/dashboard/pre-registration" className="dp-btn dp-btn-primary sm:flex-1 text-center">Modify course registration</a>
              </div>
            </div>
          </div>
        )}

      {/* Admin Pending Approvals */}
      {isAdmin && isPublishedSchedule && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Pending Approvals ({pendingData?.entries.length ?? 0})
            </h3>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
            Official timetable corrections and unscheduled/free-slot submissions wait for approval. TA duties remain personal and auto-approved.
          </p>
          {pendingData && pendingData.entries.length === 0 ? (
            <div className="text-xs text-amber-800 dark:text-amber-200 bg-white/60 dark:bg-surface/50 border border-amber-200/60 dark:border-amber-800/60 rounded-lg p-3">
              No pending approvals right now.
            </div>
          ) : (
            <div className="space-y-2">
              {(pendingData?.entries ?? []).map((entry) => (
              <div
                key={entry.id}
                className="bg-white dark:bg-surface rounded-lg border border-amber-200 dark:border-amber-800 p-3 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {formatCourseCode(entry.course?.code || "")} - {entry.classType}
                  </p>
                  {entry.isOfficialCorrection && entry.replacesOfficial && (
                    <p className="mt-1 inline-flex rounded-full border border-amber-300/70 bg-amber-100/80 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                      Official correction · replaces{" "}
                      {entry.replacesOfficial.dayOfWeek.charAt(0) + entry.replacesOfficial.dayOfWeek.slice(1).toLowerCase()}{" "}
                      {entry.replacesOfficial.startTime}-{entry.replacesOfficial.endTime}
                    </p>
                  )}
                  <p className="text-xs text-foreground-secondary mt-0.5">
                    {entry.dayOfWeek.charAt(0) + entry.dayOfWeek.slice(1).toLowerCase()} · {entry.startTime} - {entry.endTime}
                    {entry.venue && ` · ${entry.venue}`}
                  </p>
                  {entry.notes && (
                    <p className="mt-1 text-xs text-foreground-secondary">Note: {entry.notes}</p>
                  )}
                  <p className="text-xs text-foreground-muted mt-1">
                    Created by: {entry.createdBy?.name || entry.createdBy?.email || "Unknown"} ({entry.createdBy?.enrollmentId || "N/A"})
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => approveMutation.mutate({ entryId: entry.id, action: "approve" })}
                    disabled={approveMutation.isPending}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
                    aria-label="Approve"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => approveMutation.mutate({ entryId: entry.id, action: "reject" })}
                    disabled={approveMutation.isPending}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    aria-label="Reject"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {context ? `Semester ${context.semester} · ${context.term} ${context.year}` : "Current semester"}
          </p>
          <p className="mt-1 text-xs text-foreground-secondary">
            {isAdmin
              ? isPublishedSchedule
                ? `Published timetable management — ${courses.length} active current-term courses are available to edit.`
                : `Your timetable shows only your enrolled and course-registration courses. Open management to edit the full published timetable.`
              : `Schedule is shared across everyone enrolled in a course. ${courses.length > 0 ? `${courses.length} courses found.` : "No enrolled courses found."}`}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setPublishedScheduleMode((current) => !current)}
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 sm:w-auto"
            >
              <Calendar className="h-4 w-4" />
              {isPublishedSchedule ? "Back to my timetable" : "Manage published timetable"}
            </button>
          )}

          {/* Secondary actions: icon-strip on mobile, full labels on sm+ */}
          <div className="flex items-center gap-2">
            {/* Calendar add */}
            <button
              onClick={openCalendarPicker}
              disabled={entries.length === 0}
              className="dp-icon-btn sm:hidden disabled:opacity-50 disabled:cursor-not-allowed"
              title="Add to Google Calendar"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={openCalendarPicker}
              disabled={entries.length === 0}
              className="hidden sm:flex px-3 py-2 min-h-[36px] border border-border rounded-xl text-sm font-medium text-foreground-secondary hover:bg-background-secondary items-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Add to Calendar
            </button>

            {/* Calendar clear — icon only always */}
            {entries.some((e) => e.googleEventId) && (
              <button
                onClick={handleClearAllCalendar}
                disabled={clearingCalendar}
                className="dp-icon-btn text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed sm:hidden"
                title="Remove all from Google Calendar"
              >
                {clearingCalendar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
            {entries.some((e) => e.googleEventId) && (
              <button
                onClick={handleClearAllCalendar}
                disabled={clearingCalendar}
                className="hidden sm:flex px-3 py-2 min-h-[36px] border border-border rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 items-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {clearingCalendar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remove all
              </button>
            )}

            {/* View toggle */}
            <button
              onClick={() => setView(view === "week" ? "list" : "week")}
              className="dp-icon-btn md:hidden"
              title={view === "week" ? "List View" : "Week View"}
            >
              <Calendar className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView(view === "week" ? "list" : "week")}
              className="hidden md:flex px-3 py-2 min-h-[36px] border border-border rounded-xl text-sm font-medium text-foreground-secondary hover:bg-background-secondary items-center transition-colors active:scale-[0.99]"
            >
              {view === "week" ? "List View" : "Week View"}
            </button>

            {/* Autofill — icon on mobile, label on sm+ */}
            <button
              onClick={() => {
                if (!canAutofill) {
                  if (!canAddClass) showToast("warning", "Enroll in current semester courses to build the shared timetable");
                  else showToast("info", "No missing schedules found to auto-fill");
                  return;
                }
                setAutofillSelected(new Set(autofillCandidates.map((c) => c.courseId)));
                setAutofillPickerOpen(true);
              }}
              disabled={!canAutofill || autofillMissingMutation.isPending}
              className="dp-icon-btn sm:hidden disabled:opacity-60 disabled:cursor-not-allowed text-primary"
              title={`Auto-fill missing (${autofillCandidates.length})`}
            >
              {autofillMissingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                if (!canAutofill) {
                  if (!canAddClass) showToast("warning", "Enroll in current semester courses to build the shared timetable");
                  else showToast("info", "No missing schedules found to auto-fill");
                  return;
                }
                setAutofillSelected(new Set(autofillCandidates.map((c) => c.courseId)));
                setAutofillPickerOpen(true);
              }}
              disabled={!canAutofill || autofillMissingMutation.isPending}
              className="hidden sm:inline-flex px-3 py-2 min-h-[36px] rounded-xl border border-primary/25 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/15 transition-colors active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed items-center gap-2"
            >
              {autofillMissingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Auto-fill ({autofillCandidates.length})
            </button>
          </div>

          {/* Primary actions: always full-width on mobile, auto on sm+ */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!canAddClass) {
                  showToast("warning", isAdmin ? "No active current-term courses are available" : "Enroll in current semester courses to build the shared timetable");
                  return;
                }
                openAdd();
              }}
              disabled={!canAddClass}
              className="flex-1 sm:flex-none px-4 py-2 min-h-[44px] bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
              {isAdmin && isPublishedSchedule ? "Add any class" : "Add Class"}
            </button>
            <button
              onClick={() => {
                if (!canAddTaDuty) {
                  showToast("warning", "Current semester context not available");
                  return;
                }
                openAddTADuty();
              }}
              disabled={!canAddTaDuty}
              className="flex-1 sm:flex-none px-4 py-2 min-h-[44px] border-2 border-primary/50 bg-primary/5 text-primary rounded-xl text-sm font-semibold hover:bg-primary/10 flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add TA Duty
            </button>
          </div>

          {!isPublishedSchedule && (
            <TimetableImageActions
              semester={context?.semester ?? 0}
              term={context?.term ?? ""}
              year={context?.year ?? 0}
              entries={entries}
            />
          )}
        </div>
      </div>

      {view === "week" ? (
        <WeekView
          timetable={entries}
          isPublishedSchedule={isPublishedSchedule}
          onEdit={openEdit}
          onDelete={handleDelete}
          onDeleteCalendar={handleDeleteCalendar}
        />
      ) : (
        <ListView timetable={entries} onEdit={openEdit} onDelete={handleDelete} onDeleteCalendar={handleDeleteCalendar} />
      )}

      <>
        {calendarPickerOpen && (
          <CalendarPickerModal
            key="calendar-picker"
            entries={entries}
            selected={calendarSelected}
            exporting={calendarExporting}
            onToggle={(id) =>
              setCalendarSelected((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
              })
            }
            onToggleAll={(all) =>
              setCalendarSelected(all ? new Set(entries.map((e) => e.id)) : new Set())
            }
            onConfirm={() => handleConfirmCalendarExport(calendarSelected)}
            onClose={() => setCalendarPickerOpen(false)}
          />
        )}
        {modalOpen && (
          <TimetableEntryModal
            key={editingEntry?.id || "new"}
            initial={editingEntry}
            context={context || null}
            courses={modalCourses}
            existingEntries={entries}
            saving={saveEntryMutation.isPending || bulkCreateMutation.isPending}
            onClose={() => {
              setModalOpen(false);
              setEditingEntry(null);
              setAddingTaDuty(false);
            }}
            onSave={(payload) => saveEntryMutation.mutate({ id: editingEntry?.id, payload })}
            onSaveBulk={(payload) => bulkCreateMutation.mutate(payload)}
            onDeleteEntry={handleDelete}
            deleting={deleteEntryMutation.isPending}
            isAdmin={isAdmin}
            defaultClassType={addingTaDuty ? "TA_DUTY" : undefined}
          />
        )}
        {autofillPickerOpen && (
          <AutofillPickerModal
            key="autofill-picker"
            candidates={autofillCandidates}
            selected={autofillSelected}
            saving={autofillMissingMutation.isPending}
            onToggle={(courseId) =>
              setAutofillSelected((prev) => {
                const next = new Set(prev);
                if (next.has(courseId)) next.delete(courseId);
                else next.add(courseId);
                return next;
              })
            }
            onToggleAll={(all) =>
              setAutofillSelected(all ? new Set(autofillCandidates.map((c) => c.courseId)) : new Set())
            }
            onConfirm={() => {
              const picked = autofillCandidates.filter((c) => autofillSelected.has(c.courseId));
              if (picked.length === 0) { setAutofillPickerOpen(false); return; }
              autofillMissingMutation.mutate(picked, {
                onSettled: () => setAutofillPickerOpen(false),
              });
            }}
            onClose={() => setAutofillPickerOpen(false)}
          />
        )}
      </>
    </div>
  );
}

function CalendarPickerModal({
  entries,
  selected,
  exporting,
  onToggle,
  onToggleAll,
  onConfirm,
  onClose,
}: {
  entries: TimetableEntry[];
  selected: Set<string>;
  exporting: boolean;
  onToggle: (id: string) => void;
  onToggleAll: (all: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const allSelected = selected.size === entries.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Group entries by course
  const grouped = useMemo(() => {
    const map = new Map<string, TimetableEntry[]>();
    for (const e of entries) {
      const key = e.course?.code ?? "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [entries]);

  const syncedCount = entries.filter((e) => e.googleEventId).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-150"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl flex flex-col max-h-[85vh] transition-all duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Add to Google Calendar</h2>
            <p className="text-xs text-foreground-secondary mt-0.5">
              {syncedCount > 0
                ? `${syncedCount} already synced — re-selecting will replace them`
                : "Select which classes to add as weekly recurring events"}
            </p>
          </div>
          <button onClick={onClose} className="dp-icon-btn" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>

        {/* Select all */}
        <div className="px-5 py-3 border-b border-border/50 flex-shrink-0">
          <button
            onClick={() => onToggleAll(!allSelected)}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${allSelected ? "bg-primary border-primary" : "border-border"}`}>
              {allSelected && <span className="text-white text-[10px] font-bold">✓</span>}
            </span>
            {allSelected ? "Deselect all" : "Select all"}
            <span className="text-foreground-secondary font-normal">({selected.size}/{entries.length})</span>
          </button>
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {grouped.map(([courseCode, courseEntries]) => (
            <div key={courseCode}>
              <p className="text-[11px] font-semibold text-foreground-secondary uppercase tracking-wider px-2 mb-1">
                {formatCourseCode(courseCode)}
              </p>
              <div className="space-y-1">
                {courseEntries.map((entry) => {
                  const isChecked = selected.has(entry.id);
                  const isSynced = Boolean(entry.googleEventId);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => onToggle(entry.id)}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors border ${
                        isChecked ? "bg-primary/8 border-primary/25" : "bg-transparent border-transparent hover:bg-surface-hover"
                      }`}
                    >
                      <span className={`w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${isChecked ? "bg-primary border-primary" : "border-border"}`}>
                        {isChecked && <span className="text-white text-[10px] font-bold">✓</span>}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {entry.dayOfWeek.slice(0, 3).charAt(0) + entry.dayOfWeek.slice(1, 3).toLowerCase()} · {entry.startTime}–{entry.endTime}
                          </p>
                          <span className="text-xs text-foreground-secondary">
                            {CLASS_TYPE_LABEL[entry.classType as ClassType] ?? entry.classType}
                          </span>
                        </div>
                        {entry.venue && <p className="text-xs text-foreground-secondary truncate">{entry.venue}</p>}
                      </div>
                      {isSynced && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 font-medium flex-shrink-0">
                          synced
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="dp-btn dp-btn-outline flex-1">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={selected.size === 0 || exporting}
            className="dp-btn dp-btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Add {selected.size} {selected.size === 1 ? "class" : "classes"}
          </button>
        </div>
      </div>
    </div>
  );
}

const DAY_SHORT: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed",
  THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};
const CLASS_TYPE_SHORT: Record<string, string> = {
  LECTURE: "Lec", LAB: "Lab", TUTORIAL: "Tut",
  SEMINAR: "Sem", WORKSHOP: "Wkshp", TA_DUTY: "TA",
};

type AutofillCandidate = {
  courseId: string;
  courseCode: string;
  entries: Array<Omit<TimetableEntryPayload, "courseId">>;
};

function AutofillPickerModal({
  candidates,
  selected,
  saving,
  onToggle,
  onToggleAll,
  onConfirm,
  onClose,
}: {
  candidates: AutofillCandidate[];
  selected: Set<string>;
  saving: boolean;
  onToggle: (courseId: string) => void;
  onToggleAll: (all: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const allSelected = selected.size === candidates.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-150"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl flex flex-col max-h-[85vh] transition-all duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Auto-fill schedules</h2>
            <p className="text-xs text-foreground-secondary mt-0.5">Choose which courses to add</p>
          </div>
          <button onClick={onClose} className="dp-icon-btn" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>

        {/* Select all toggle */}
        <div className="px-5 py-3 border-b border-border/50 flex-shrink-0">
          <button
            onClick={() => onToggleAll(!allSelected)}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${allSelected ? "bg-primary border-primary" : "border-border"}`}>
              {allSelected && <span className="text-white text-[10px] font-bold">✓</span>}
            </span>
            {allSelected ? "Deselect all" : "Select all"}
            <span className="text-foreground-secondary font-normal">({selected.size}/{candidates.length})</span>
          </button>
        </div>

        {/* Course list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {candidates.map((c) => {
            const isChecked = selected.has(c.courseId);
            const sessionSummary = c.entries
              .map((e) => `${DAY_SHORT[e.dayOfWeek] ?? e.dayOfWeek} ${e.startTime}${e.classType && e.classType !== "LECTURE" ? ` (${CLASS_TYPE_SHORT[e.classType] ?? e.classType})` : ""}`)
              .join(" · ");
            return (
              <button
                key={c.courseId}
                type="button"
                onClick={() => onToggle(c.courseId)}
                className={`w-full flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors border ${
                  isChecked
                    ? "bg-primary/8 border-primary/25"
                    : "bg-transparent border-transparent hover:bg-surface-hover"
                }`}
              >
                <span className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${isChecked ? "bg-primary border-primary" : "border-border"}`}>
                  {isChecked && <span className="text-white text-[10px] font-bold">✓</span>}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{formatCourseCode(c.courseCode)}</p>
                  <p className="text-xs text-foreground-secondary mt-0.5 truncate">{sessionSummary}</p>
                  <p className="text-xs text-foreground-secondary/70 mt-0.5">{c.entries.length} {c.entries.length === 1 ? "class" : "classes"}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="dp-btn dp-btn-outline flex-1">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={selected.size === 0 || saving}
            className="dp-btn dp-btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Fill {selected.size} {selected.size === 1 ? "course" : "courses"}
          </button>
        </div>
      </div>
    </div>
  );
}

function timeToWeekMinutes(timeStr: string) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

function findWeekSlotIndex(time: string) {
  const exact = WEEK_VIEW_TIMES.indexOf(time);
  if (exact >= 0) return exact;
  const minutes = timeToWeekMinutes(time);
  for (let index = WEEK_VIEW_TIMES.length - 1; index >= 0; index--) {
    if (timeToWeekMinutes(WEEK_VIEW_TIMES[index]) <= minutes) return index;
  }
  return 0;
}

function calculateWeekRowSpan(startTime: string, endTime: string) {
  const startIndex = findWeekSlotIndex(startTime);
  const endMinutes = timeToWeekMinutes(endTime);
  let count = 0;
  for (let index = startIndex; index < WEEK_VIEW_TIMES.length; index++) {
    if (timeToWeekMinutes(WEEK_VIEW_TIMES[index]) < endMinutes) count++;
    else break;
  }
  return Math.max(1, count);
}

const DEFAULT_WEEK_VIEW_START_MINUTES = 8 * 60;
const DEFAULT_WEEK_VIEW_END_MINUTES = 20 * 60;
const MIN_WEEK_VIEW_START_MINUTES = 6 * 60;
const MAX_WEEK_VIEW_END_MINUTES = 22 * 60;
const DEFAULT_WEEK_HOUR_HEIGHT = 88;

function getWeekViewBounds(entries: TimetableEntry[]) {
  const timedEntries = entries
    .map((entry) => ({ start: timeToWeekMinutes(entry.startTime), end: timeToWeekMinutes(entry.endTime) }))
    .filter((entry) => Number.isFinite(entry.start) && Number.isFinite(entry.end) && entry.end > entry.start);

  if (timedEntries.length === 0) {
    return { start: DEFAULT_WEEK_VIEW_START_MINUTES, end: DEFAULT_WEEK_VIEW_END_MINUTES };
  }

  const earliest = Math.min(...timedEntries.map((entry) => entry.start));
  const latest = Math.max(...timedEntries.map((entry) => entry.end));
  const start = Math.min(
    DEFAULT_WEEK_VIEW_START_MINUTES,
    Math.max(MIN_WEEK_VIEW_START_MINUTES, Math.floor((earliest - 30) / 60) * 60),
  );
  const end = Math.max(
    DEFAULT_WEEK_VIEW_END_MINUTES,
    Math.min(MAX_WEEK_VIEW_END_MINUTES, Math.ceil((latest + 30) / 60) * 60),
  );
  return { start, end: Math.max(start + 120, end) };
}

function formatWeekDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

type WeekEventLayout = {
  entry: TimetableEntry;
  start: number;
  end: number;
  lane: number;
  laneCount: number;
};

function layoutWeekDay(entries: TimetableEntry[], viewStart: number, viewEnd: number): WeekEventLayout[] {
  const visible = entries
    .map((entry) => ({
      entry,
      start: Math.max(viewStart, timeToWeekMinutes(entry.startTime)),
      end: Math.min(viewEnd, timeToWeekMinutes(entry.endTime)),
    }))
    .filter((entry) => entry.end > entry.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const layouts: WeekEventLayout[] = [];
  let cluster: typeof visible = [];
  let clusterEnd = -Infinity;
  const flushCluster = () => {
    if (cluster.length === 0) return;
    const active: Array<{ end: number; lane: number }> = [];
    const positioned: WeekEventLayout[] = [];
    let laneCount = 0;
    for (const item of cluster) {
      for (let index = active.length - 1; index >= 0; index--) {
        if (active[index].end <= item.start) active.splice(index, 1);
      }
      const occupied = new Set(active.map((item) => item.lane));
      let lane = 0;
      while (occupied.has(lane)) lane++;
      active.push({ end: item.end, lane });
      laneCount = Math.max(laneCount, lane + 1);
      positioned.push({ ...item, lane, laneCount: 1 });
    }
    layouts.push(...positioned.map((item) => ({ ...item, laneCount })));
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of visible) {
    if (cluster.length > 0 && item.start >= clusterEnd) flushCluster();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flushCluster();
  return layouts;
}

function WeekView({
  timetable,
  isPublishedSchedule,
  onEdit,
  onDelete,
  onDeleteCalendar,
}: {
  timetable: TimetableEntry[];
  isPublishedSchedule?: boolean;
  onEdit: (entry: TimetableEntry) => void;
  onDelete: (entry: TimetableEntry) => void;
  onDeleteCalendar: (entry: TimetableEntry) => void;
}) {
  const [hourHeight, setHourHeight] = useState(DEFAULT_WEEK_HOUR_HEIGHT);
  const viewBounds = useMemo(() => getWeekViewBounds(timetable), [timetable]);
  const weekHours = useMemo(
    () => Array.from(
      { length: (viewBounds.end - viewBounds.start) / 60 + 1 },
      (_, index) => viewBounds.start + index * 60,
    ),
    [viewBounds.end, viewBounds.start],
  );
  const layoutsByDay = useMemo(
    () => new Map(WEEK_DAYS.map((day) => [
      day,
      layoutWeekDay(timetable.filter((entry) => entry.dayOfWeek === day), viewBounds.start, viewBounds.end),
    ])),
    [timetable, viewBounds.end, viewBounds.start],
  );
  const sessionCount = timetable.filter((entry) => WEEK_DAYS.includes(entry.dayOfWeek)).length;
  const labCount = timetable.filter((entry) => entry.classType === "LAB").length;
  const canvasHeight = ((viewBounds.end - viewBounds.start) / 60) * hourHeight;

  if (sessionCount === 0) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-10 text-center shadow-sm">
        <Calendar className="mx-auto mb-3 h-12 w-12 text-foreground-secondary opacity-50" />
        <p className="font-medium text-foreground">No timetable sessions yet</p>
        <p className="mt-1 text-sm text-foreground-secondary">
          {isPublishedSchedule
            ? "Published classes appear here as soon as a course has a schedule."
            : "Classes from your enrolled or course-registration plan appear here as soon as a schedule is published."}
        </p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm" aria-label="Weekly course calendar">
      <div className="flex flex-col gap-3 border-b border-border bg-gradient-to-br from-primary/[0.07] via-surface to-surface px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-sm font-semibold text-foreground">Weekly schedule</p>
          <p className="mt-0.5 text-xs text-foreground-secondary">
            {isPublishedSchedule
              ? "All published sessions, including Saturday labs"
              : "Your enrolled and course-registration sessions, including Saturday labs"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-foreground-secondary">
          <span className="rounded-full border border-border bg-surface px-2.5 py-1">{sessionCount} sessions</span>
          {labCount > 0 && <span className="rounded-full border border-border bg-surface px-2.5 py-1">{labCount} labs</span>}
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border bg-surface p-0.5" aria-label="Calendar zoom">
            <button
              type="button"
              onClick={() => setHourHeight((height) => Math.max(68, height - 12))}
              disabled={hourHeight <= 68}
              className="h-6 w-6 rounded text-sm hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Compact calendar"
              title="Compact calendar"
            >
              −
            </button>
            <span className="px-1 text-[10px]">Zoom</span>
            <button
              type="button"
              onClick={() => setHourHeight((height) => Math.min(124, height + 12))}
              disabled={hourHeight >= 124}
              className="h-6 w-6 rounded text-sm hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Expand calendar"
              title="Expand calendar"
            >
              +
            </button>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto overscroll-x-contain p-2 sm:p-3">
        <div className="min-w-[940px]">
          <div className="grid" style={{ gridTemplateColumns: `72px repeat(${WEEK_DAYS.length}, minmax(138px, 1fr))` }}>
            <div className="px-2 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Time</div>
            {WEEK_DAYS.map((day) => {
              const count = layoutsByDay.get(day)?.length ?? 0;
              return (
                <div key={day} className="border-l border-border px-3 pb-2 pt-1">
                  <div className="rounded-xl bg-background-secondary/70 px-3 py-2">
                    <p className="text-sm font-semibold text-foreground">{day.slice(0, 3)}</p>
                    <p className="text-[11px] font-medium text-foreground-secondary">{count === 0 ? "Free" : `${count} session${count === 1 ? "" : "s"}`}</p>
                  </div>
                </div>
              );
            })}

            <div className="relative border-t border-border bg-background-secondary/45" style={{ height: `${canvasHeight}px` }}>
              {weekHours.map((minutes) => (
                <span
                  key={minutes}
                  className="absolute right-3 -translate-y-1/2 text-[11px] font-medium tabular-nums text-foreground-muted"
                  style={{ top: `${((minutes - viewBounds.start) / 60) * hourHeight}px` }}
                >
                  {minutesToTime(minutes)}
                </span>
              ))}
            </div>

            {WEEK_DAYS.map((day) => (
              <div key={day} className="relative overflow-hidden border-l border-t border-border bg-surface" style={{ height: `${canvasHeight}px` }}>
                {weekHours.slice(0, -1).map((minutes) => (
                  <div
                    key={minutes}
                    className="absolute inset-x-0 border-t border-dashed border-border/70"
                    style={{ top: `${((minutes - viewBounds.start) / 60) * hourHeight}px` }}
                  />
                ))}
                {(layoutsByDay.get(day) ?? []).map((layout) => {
                  const { entry } = layout;
                  const color = getCourseColor(entry.course?.code || "", entry.classType);
                  const duration = layout.end - layout.start;
                  const isLong = duration >= 85;
                  const top = ((layout.start - viewBounds.start) / 60) * hourHeight + 3;
                  const height = Math.max(48, (duration / 60) * hourHeight - 6);
                  return (
                    <div
                      key={entry.id}
                      className="group absolute z-[1]"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `calc(${(layout.lane / layout.laneCount) * 100}% + 4px)`,
                        width: `calc(${100 / layout.laneCount}% - 8px)`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onEdit(entry)}
                        className={`relative h-full w-full overflow-hidden rounded-xl border ${color.border} ${color.bg} ${color.hover} px-2.5 py-2 text-left shadow-sm transition duration-150 hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60`}
                        title={`${entry.course?.code || "Class"} - ${entry.startTime} to ${entry.endTime}`}
                      >
                        <span className={`absolute inset-y-0 left-0 w-1 ${color.accent}`} />
                        <div className="flex min-w-0 items-start justify-between gap-1 pl-1">
                          <p className={`truncate text-xs font-bold ${color.text}`}>{formatCourseCode(entry.course?.code || "")}</p>
                          <span className={`shrink-0 rounded-md border ${color.border} bg-surface/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${color.text}`}>{entry.classType === "LECTURE" ? "Class" : CLASS_TYPE_LABEL[entry.classType]}</span>
                        </div>
                        <p className={`mt-0.5 pl-1 text-[11px] font-medium tabular-nums ${color.text} opacity-80`}>
                          {entry.startTime} - {entry.endTime} · {formatWeekDuration(duration)}
                        </p>
                        {isLong && <p className={`mt-1 line-clamp-2 pl-1 text-[11px] leading-4 ${color.text} opacity-90`}>{entry.course?.name || "Scheduled class"}</p>}
                        {isLong && entry.venue && <p className={`mt-1 flex items-center gap-1 truncate pl-1 text-[10px] ${color.text} opacity-75`}><MapPin className="h-3 w-3 shrink-0" />{entry.venue}</p>}
                      </button>
                      {entry.googleEventId && (
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); onDeleteCalendar(entry); }}
                          className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-md bg-surface/90 text-foreground-secondary shadow-sm transition hover:text-primary group-hover:flex focus:flex"
                          aria-label="Remove from Google Calendar"
                          title="Remove from Google Calendar"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {!entry.isOfficial && !entry.isOfficialCorrection && (
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); onDelete(entry); }}
                          className="absolute bottom-1 right-1 hidden h-6 w-6 items-center justify-center rounded-md bg-surface/90 text-red-500 shadow-sm transition hover:bg-red-50 group-hover:flex focus:flex"
                          aria-label="Delete class"
                          title="Delete class"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LegacyWeekView({
  timetable,
  onEdit,
  onDelete,
  onDeleteCalendar,
}: {
  timetable: TimetableEntry[];
  onEdit: (entry: TimetableEntry) => void;
  onDelete: (entry: TimetableEntry) => void;
  onDeleteCalendar: (entry: TimetableEntry) => void;
}) {
  // Track rows spanned by an entry so we skip rendering them
  const coveredCellsByDay = useMemo(() => {
    const map: Record<string, Set<number>> = Object.fromEntries(WEEK_DAYS.map((d) => [d, new Set<number>()]));
    for (const entry of timetable) {
      if (!WEEK_DAYS.includes(entry.dayOfWeek)) continue;
      const startIdx = findWeekSlotIndex(entry.startTime);
      const rowSpan = calculateWeekRowSpan(entry.startTime, entry.endTime);
      for (let i = 1; i < rowSpan; i++) {
        map[entry.dayOfWeek]?.add(startIdx + i);
      }
    }
    return map;
  }, [timetable]);

  // Get entry that starts within a given slot's 30-min window
  const getEntry = (day: string, slotIdx: number) => {
    const slotMins = timeToWeekMinutes(WEEK_VIEW_TIMES[slotIdx]);
    const nextMins = slotIdx + 1 < WEEK_VIEW_TIMES.length ? timeToWeekMinutes(WEEK_VIEW_TIMES[slotIdx + 1]) : slotMins + 30;
    return timetable.find(e => {
      if (e.dayOfWeek !== day) return false;
      const startMins = timeToWeekMinutes(e.startTime);
      return startMins >= slotMins && startMins < nextMins;
    });
  };

  // Each row = 30 min = 48px. Classes ≥ 1.5h span ≥ 3 rows = 144px+
  const ROW_HEIGHT = "h-12"; // 48px per 30-min slot

  return (
    <div className="bg-surface dark:bg-surface rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-border border-collapse">
          <thead className="bg-background-secondary dark:bg-background sticky top-0 z-10">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-foreground-secondary uppercase tracking-wider w-20 border-r border-border">
                Time
              </th>
              {WEEK_DAYS.map((day) => (
                <th
                  key={day}
                  className="px-3 py-3 text-left text-xs font-medium text-foreground-secondary uppercase tracking-wider border-r border-border last:border-r-0"
                >
                  {day.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-border">
            {WEEK_VIEW_TIMES.map((time, timeIdx) => (
              <tr key={time} className="divide-x divide-border">
                <td className={`px-3 py-1 text-xs text-foreground-secondary font-medium w-20 border-r border-border bg-background-secondary/50 dark:bg-background/50 ${ROW_HEIGHT} align-middle`}>
                  {time}
                </td>
                {WEEK_DAYS.map((day) => {
                  if (coveredCellsByDay[day]?.has(timeIdx)) return null;

                  const entry = getEntry(day, timeIdx);

                  if (!entry) {
                    return (
                      <td
                        key={day}
                        className={`px-2 text-sm border-r border-border last:border-r-0 hover:bg-background-secondary/30 transition-colors ${ROW_HEIGHT}`}
                      />
                    );
                  }

                  const rowSpan = calculateWeekRowSpan(entry.startTime, entry.endTime);
                  const durationMins = timeToWeekMinutes(entry.endTime) - timeToWeekMinutes(entry.startTime);
                  const isLong = durationMins >= 90; // 1.5h+
                  const color = getCourseColor(entry.course?.code || "", entry.classType);

                  return (
                    <td
                      key={day}
                      rowSpan={rowSpan}
                      className="px-2 py-1 text-sm border-r border-border last:border-r-0 align-top"
                      style={{ minHeight: `${rowSpan * 48}px` }}
                    >
                      <div className="relative group h-full min-h-full flex flex-col">
                        <button
                          type="button"
                          onClick={() => onEdit(entry)}
                          className={`flex-1 w-full text-left ${color.bg} border-l-4 ${color.border} rounded p-2 ${entry.googleEventId ? "pr-10" : "pr-6"} ${color.hover} transition-colors flex flex-col ${isLong ? "justify-start gap-1" : "justify-center"}`}
                        >
                          <p className={`font-semibold ${color.text} text-xs truncate`}>
                            {formatCourseCode(entry.course?.code || "")}
                          </p>
                          <p className={`text-xs ${color.text} opacity-75`}>
                            {entry.startTime}–{entry.endTime}
                          </p>
                          {isLong && (
                            <>
                              <div className={`flex items-center gap-1 text-xs ${color.text} opacity-80`}>
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{entry.venue || "TBA"}{entry.slot ? ` • Slot ${entry.slot}` : ""}</span>
                              </div>
                              {entry.instructor && (
                                <p className={`text-xs ${color.text} opacity-70 truncate`}>{entry.instructor}</p>
                              )}
                            </>
                          )}
                          {!isLong && entry.venue && (
                            <div className={`flex items-center gap-1 text-xs ${color.text} opacity-80 mt-0.5`}>
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{entry.venue}</span>
                            </div>
                          )}
                        </button>
                        {/* Official workbook entries are reported, not deleted. */}
                        {!entry.isOfficial && !entry.isOfficialCorrection && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDelete(entry); }}
                            className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                            aria-label="Delete class"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                        {/* Remove from Google Calendar */}
                        {entry.googleEventId && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDeleteCalendar(entry); }}
                            className="absolute top-1 right-6 w-5 h-5 flex items-center justify-center rounded text-foreground-secondary hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all"
                            aria-label="Remove from Google Calendar"
                          >
                            <Calendar className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ListView({
  timetable,
  onEdit,
  onDelete,
  onDeleteCalendar,
}: {
  timetable: TimetableEntry[];
  onEdit: (entry: TimetableEntry) => void;
  onDelete: (entry: TimetableEntry) => void;
  onDeleteCalendar: (entry: TimetableEntry) => void;
}) {
  const groupedByDay = DAYS.map((day) => ({
    day,
    classes: timetable.filter((e) => e.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  })).filter(({ classes }) => classes.length > 0);

  if (groupedByDay.length === 0) {
    return (
      <div className="bg-surface dark:bg-surface rounded-lg border border-border p-8 text-center">
        <Calendar className="w-12 h-12 text-foreground-secondary mx-auto mb-3 opacity-50" />
        <p className="text-foreground-secondary">No schedule added yet</p>
        <p className="text-xs text-foreground-muted mt-2">
          No published timing is available for the selected courses yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupedByDay.map(({ day, classes }) => (
        <div key={day} className="bg-surface rounded-2xl border border-border p-3 sm:p-6 shadow-sm">
          <h3 className="sticky top-0 z-10 -mx-3 -mt-3 mb-3 rounded-t-2xl border-b border-border/70 bg-surface/95 px-4 py-3 text-sm sm:static sm:m-0 sm:mb-3 sm:border-0 sm:bg-transparent sm:p-0 sm:text-lg font-semibold text-foreground backdrop-blur capitalize">{day.charAt(0) + day.slice(1).toLowerCase()}</h3>
          <div className="space-y-2 sm:space-y-3">
            {classes.map((entry) => {
              const color = getCourseColor(entry.course?.code || "", entry.classType);
              return (
              <div
                key={entry.id}
                className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3 sm:p-4 ${color.bg} rounded-lg border-l-4 ${color.border} hover:opacity-90 transition-all`}
              >
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  className="flex-1 min-w-0 text-left group"
                >
                  <h4 className={`font-medium ${color.text} text-sm sm:text-base truncate`}>
                    {entry.course?.name}
                  </h4>
                  <p className={`text-xs sm:text-sm ${color.text} mt-0.5 opacity-80`}>{formatCourseCode(entry.course?.code || "")}</p>
                  <div className={`flex flex-wrap gap-2 sm:gap-4 mt-2 text-xs sm:text-sm ${color.text} opacity-90`}>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      {entry.startTime} - {entry.endTime}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      {entry.venue || "TBA"}
                    </div>
                    {entry.slot && (
                      <span className={`px-2 py-0.5 bg-white/50 dark:bg-black/20 border ${color.border} ${color.text} rounded text-xs`}>
                        Slot {entry.slot}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 border ${color.border} ${color.text} rounded text-xs font-medium`}>
                      {CLASS_TYPE_LABEL[entry.classType] || entry.classType}
                    </span>
                    {(entry.isOfficial || entry.isOfficialCorrection) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                        <CheckCircle className="h-3 w-3" /> {entry.isOfficialCorrection ? "Approved correction" : "Approved"}
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-1 sm:ml-2 flex-shrink-0 self-end sm:self-auto">
                  {entry.googleEventId && (
                    <button
                      type="button"
                      onClick={() => onDeleteCalendar(entry)}
                      className={`min-w-[44px] min-h-[44px] flex items-center justify-center ${color.text} opacity-60 hover:opacity-100 hover:bg-white/50 dark:hover:bg-black/20 rounded-lg transition-all`}
                      aria-label="Remove from Google Calendar"
                      title="Remove from Google Calendar"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onEdit(entry)}
                    className={`min-w-[44px] min-h-[44px] flex items-center justify-center ${color.text} hover:bg-white/50 dark:hover:bg-black/20 rounded-lg transition-colors`}
                    aria-label="Edit class"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {!entry.isOfficial && !entry.isOfficialCorrection && (
                    <button
                      type="button"
                      onClick={() => onDelete(entry)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      aria-label="Delete class"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimetableEntryModal({
  initial,
  context,
  courses,
  existingEntries,
  saving,
  onClose,
  onSave,
  onSaveBulk,
  onDeleteEntry,
  deleting,
  isAdmin,
  defaultClassType,
}: {
  initial: TimetableEntry | null;
  context: TimetableResponse["context"] | null;
  courses: CourseOption[];
  existingEntries: TimetableEntry[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: TimetableEntryPayload) => void;
  onSaveBulk: (payload: BulkCreatePayload) => void;
  onDeleteEntry: (entry: TimetableEntry) => void;
  deleting: boolean;
  isAdmin: boolean;
  defaultClassType?: ClassType;
}) {
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();

  const isEditing = Boolean(initial);

  const { data: autofillData } = useQuery<TimetableAutofillData>({
    queryKey: ["timetable-autofill"],
    queryFn: async () => {
      const res = await fetch("/api/timetable/autofill");
      if (!res.ok) throw new Error("Failed to load timetable data");
      return res.json();
    },
    staleTime: 60_000 * 60,
  });

  const venueOptions = autofillData?.venues ?? [];
  const venueListId = "timetable-venue-options";

  const initialCourseId = initial?.courseId ?? courses[0]?.id ?? "";
  const initialStartTime = initial?.startTime ?? DEFAULT_START_TIME;
  const initialEndTime = initial?.endTime ?? DEFAULT_END_TIME;
  const safeInitialEndTime =
    initialEndTime > initialStartTime
      ? initialEndTime
      : END_TIMES.find((t) => t > initialStartTime) || DEFAULT_END_TIME;

  const [courseId, setCourseId] = useState<string>(initialCourseId);

  // Edit mode (single class)
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(initial?.dayOfWeek ?? "MONDAY");
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(safeInitialEndTime);
  const [slot, setSlot] = useState(initial?.slot ?? "");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const defaultDraftClassType: ClassType = defaultClassType ?? initial?.classType ?? "LECTURE";
  const [classType, setClassType] = useState<ClassType>(defaultDraftClassType);

  // Shared fields
  const [instructor, setInstructor] = useState(initial?.instructor ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Add mode (bulk)
  const [timetableKind, setTimetableKind] = useState<TimetableKind>("NON_IC");
  const [kindTouched, setKindTouched] = useState(false);
  const [slotInput, setSlotInput] = useState("");
  const [slotTouched, setSlotTouched] = useState(false);
  const initialExistingCount = initialCourseId
    ? existingEntries.filter((e) => e.courseId === initialCourseId).length
    : 0;
  const [replaceExisting, setReplaceExisting] = useState(initialExistingCount > 0);
  const [drafts, setDrafts] = useState<MeetingDraft[]>([]);
  const [draftsTouched, setDraftsTouched] = useState(false);

  const selectedCourse = useMemo(() => courses.find((c) => c.id === courseId) || null, [courses, courseId]);
  const courseCode = selectedCourse?.code ?? initial?.course?.code ?? "";

  const nonIcDefault = courseCode ? autofillData?.defaults?.nonIc?.[courseCode] : undefined;
  const icDefault = courseCode ? autofillData?.defaults?.ic?.[courseCode] : undefined;
  const pcLab = courseCode ? autofillData?.pcLab?.[courseCode] : undefined;

  const existingCount = useMemo(() => {
    if (!courseId) return 0;
    return existingEntries.filter((e) => e.courseId === courseId).length;
  }, [existingEntries, courseId]);

  const suggestedKind: TimetableKind = useMemo(() => {
    const nonIcSlot = nonIcDefault?.slot;
    if (typeof nonIcSlot === "string" && nonIcSlot.toLowerCase().includes("ic courses time table")) {
      return "IC";
    }
    if (courseCode.startsWith("IC-")) return "IC";
    return "NON_IC";
  }, [courseCode, nonIcDefault?.slot]);

  const effectiveKind: TimetableKind = kindTouched ? timetableKind : suggestedKind;

  const suggestedSlotFor = (kind: TimetableKind): string => {
    if (kind === "IC") return icDefault?.slot?.trim() || "";
    const nonIcSlot = nonIcDefault?.slot?.trim() || "";
    if (nonIcSlot.toLowerCase().includes("ic courses time table")) {
      return icDefault?.slot?.trim() || "";
    }
    return nonIcSlot;
  };

  const suggestedVenueFor = (kind: TimetableKind): string => {
    return (kind === "IC" ? icDefault?.classroom : nonIcDefault?.classroom) || "";
  };

  const effectiveSlotInput = slotTouched ? slotInput : suggestedSlotFor(effectiveKind);

  const buildDrafts = (slotRaw: string, kind: TimetableKind) => {
    const normalizedSlot = slotRaw.trim();
    const warnings: string[] = [];

    const defaultVenue = suggestedVenueFor(kind);
    const tokens = extractSlotTokens(normalizedSlot);

    if (!normalizedSlot) {
      return { drafts: [] as MeetingDraft[], warnings };
    }

    const textUpper = normalizedSlot.toUpperCase();
    if (textUpper.includes("LAB SLOT") && !tokens.some((t) => t.startsWith("L"))) {
      warnings.push("This slot includes a lab component — add an L1–L5 slot to include the lab.");
    }

    const pcKind = kind === "IC" ? "IC" : "NON_IC";
    const pcLabSlots = new Set((pcLab?.slot || "").toUpperCase().match(/L[1-5]/g) || []);
    const pcLabApplies = pcLab?.kind === pcKind;

    const next: MeetingDraft[] = [];
    if (tokens.length === 0) {
      warnings.push("Slot not recognized — add timings manually.");
      next.push({
        id: `manual|${normalizedSlot.toUpperCase()}`,
        dayOfWeek: "MONDAY",
        startTime: DEFAULT_START_TIME,
        endTime: DEFAULT_END_TIME,
        slot: normalizedSlot || undefined,
        venue: defaultVenue || undefined,
        classType: defaultDraftClassType,
      });
      return { drafts: next, warnings };
    }

    for (const token of tokens) {
      if (/^[A-H]$/.test(token)) {
        const sessions = kind === "IC" ? IC_SLOTS[token] : NON_IC_SLOTS[token];
        for (const s of sessions || []) {
          next.push({
            id: `slot|${token}|${s.dayOfWeek}|${s.startTime}|${s.endTime}|LECTURE`,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            slot: token,
            venue: defaultVenue || undefined,
            classType: defaultDraftClassType,
          });
        }
        const fourth =
          kind === "NON_IC" && requiresFourthNonIcTheorySession(selectedCourse?.ltpc)
            ? NON_IC_FOURTH_SESSION[token]
            : undefined;
        if (fourth) {
          next.push({
            id: `slot|${token}|${fourth.dayOfWeek}|${fourth.startTime}|${fourth.endTime}|LECTURE`,
            dayOfWeek: fourth.dayOfWeek,
            startTime: fourth.startTime,
            endTime: fourth.endTime,
            slot: token,
            venue: defaultVenue || undefined,
            classType: "LECTURE",
          });
        }
        continue;
      }

      if (/^L[1-5]$/.test(token)) {
        const base = LAB_SLOTS[token] || [];
        const pcMatches = pcLabApplies && (pcLabSlots.size === 0 || pcLabSlots.has(token));
        const pcRange = pcMatches ? parseTimeRange12h(pcLab?.time || "") : null;
        const labVenue = pcMatches ? pcLab?.venue : defaultVenue;

        for (const s of base) {
          const start = pcRange?.startTime || s.startTime;
          const end = pcRange?.endTime || s.endTime;
          next.push({
            id: `slot|${token}|${s.dayOfWeek}|${start}|${end}|LAB`,
            dayOfWeek: s.dayOfWeek,
            startTime: start,
            endTime: end,
            slot: token,
            venue: labVenue || undefined,
            classType: "LAB",
          });
        }
        continue;
      }
    }

    if (pcLabApplies && !tokens.some((t) => t.startsWith("L"))) {
      warnings.push("PC lab allocation found — add an L1–L5 slot to include the lab timing/venue.");
    }

    const dayOrder = (d: DayOfWeek) => DAYS.indexOf(d);
    next.sort((a, b) => dayOrder(a.dayOfWeek) - dayOrder(b.dayOfWeek) || a.startTime.localeCompare(b.startTime));

    return { drafts: next, warnings };
  };

  const slotResult = buildDrafts(effectiveSlotInput, effectiveKind);
  const activeDrafts = draftsTouched ? drafts : slotResult.drafts;

  const updateDraft = (id: string, patch: Partial<MeetingDraft>) => {
    setDraftsTouched(true);
    setDrafts((prev) => {
      const base = draftsTouched ? prev : slotResult.drafts;
      return base.map((d) => (d.id === id ? { ...d, ...patch } : d));
    });
  };

  const removeDraft = (id: string) => {
    setDraftsTouched(true);
    setDrafts((prev) => {
      const base = draftsTouched ? prev : slotResult.drafts;
      return base.filter((d) => d.id !== id);
    });
  };

  const addBlankDraft = () => {
    setDraftsTouched(true);
    setDrafts((prev) => {
      const base = draftsTouched ? prev : slotResult.drafts;
      return [
        ...base,
        {
          id: makeId(),
          dayOfWeek: "MONDAY",
          startTime: DEFAULT_START_TIME,
          endTime: DEFAULT_END_TIME,
          slot: effectiveSlotInput.trim() || undefined,
          venue: suggestedVenueFor(effectiveKind) || undefined,
          classType: defaultDraftClassType,
        },
      ];
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // (No effects to "sync" derived defaults into state: this keeps the UI responsive and avoids cascading renders.)

  const endOptions = useMemo(() => END_TIMES.filter((t) => t > startTime), [startTime]);

  const title = (() => {
    if (initial?.isOfficial) return isAdmin ? "Edit approved class" : "Report timetable correction";
    if (initial?.isOfficialCorrection) return isAdmin ? "Edit approved class" : "Update timetable correction";
    if (initial) return initial.classType === "TA_DUTY" ? "Edit TA duty" : "Edit class";
    if (defaultClassType === "TA_DUTY") return "Add TA duty";
    return "Add classes";
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // TA duties don't require a course
    if (!courseId && classType !== "TA_DUTY") {
      showToast("warning", "Select a course first (or create a TA duty without a course)");
      return;
    }

    if (isEditing) {
      if (!dayOfWeek || !startTime || !endTime) {
        showToast("warning", "Please fill the required fields");
        return;
      }
      if (endTime <= startTime) {
        showToast("warning", "End time must be after start time");
        return;
      }

      onSave({
        courseId: courseId || undefined,
        dayOfWeek,
        startTime,
        endTime,
        slot: slot.trim() || undefined,
        venue: venue.trim() || undefined,
        classType,
        instructor: instructor.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      return;
    }

    if (!selectedCourse && courseId) {
      showToast("warning", "Please select a valid course");
      return;
    }
    if (activeDrafts.length === 0) {
      showToast("warning", "Add at least one class timing");
      return;
    }

    for (const d of activeDrafts) {
      if (!d.dayOfWeek || !d.startTime || !d.endTime) {
        showToast("warning", "Please fill the required fields");
        return;
      }
      if (d.endTime <= d.startTime) {
        showToast("warning", "End time must be after start time");
        return;
      }
    }

    if (replaceExisting && existingCount > 0) {
      const ok = await confirm({
        title: "Replace existing schedule?",
        message: "This will replace the shared timetable for this course in the current semester for everyone enrolled in it.",
        confirmText: "Replace",
        variant: "danger",
      });
      if (!ok) return;
    }

    onSaveBulk({
      courseId: courseId || undefined,
      replaceExisting,
      entries: activeDrafts.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
        slot: d.slot,
        venue: d.venue,
        classType: d.classType,
        instructor: instructor.trim() || undefined,
        notes: notes.trim() || undefined,
      })),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 transition-opacity duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      <div
        className="relative w-full sm:max-w-xl max-h-[80vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-150"
      >
            <div className="p-4 sm:p-6 border-b border-border flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold text-foreground">{title}</h2>
                <p className="text-xs sm:text-sm text-foreground-secondary mt-1">
                  {context ? `Semester ${context.semester} · ${context.term} ${context.year}` : "Current semester"} ·{" "}
                  {initial ? "Update details" : "Generate from slots"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-surface-hover text-foreground-secondary hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <datalist id={venueListId}>
              {venueOptions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {/* Course picker */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Course {classType === "TA_DUTY" && "(optional for TA duties)"}
                </label>

                {initial ? (
                  <div className="p-3 rounded-xl bg-background-secondary border border-border">
                    <p className="text-sm text-foreground truncate">
                      {initial.course ? `${formatCourseCode(initial.course.code)} — ${initial.course.name}` : "TA Duty (No course)"}
                    </p>
                    <p className="text-xs text-foreground-secondary mt-0.5">
                      {initial.course ? "Course is fixed for an existing schedule entry." : "TA duties don't require a specific course."}
                    </p>
                  </div>
                ) : (
                  <select
                    value={courseId}
                      onChange={(e) => {
                      const nextCourseId = e.target.value;
                      setCourseId(nextCourseId);
                      setKindTouched(false);
                      setTimetableKind("NON_IC");
                      setSlotTouched(false);
                      setSlotInput("");
                      setDraftsTouched(false);
                      setDrafts([]);
                      setReplaceExisting(existingEntries.filter((en) => en.courseId === nextCourseId).length > 0);
                      }}
                      className="w-full px-3 py-3 min-h-[44px] rounded-xl border border-border bg-surface text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
                      disabled={courses.length === 0 && classType !== "TA_DUTY"}
                    >
                    {courses.length === 0 && classType !== "TA_DUTY" ? (
                      <option value="">No courses enrolled</option>
                    ) : (
                      <>
                        <option value="" disabled={classType !== "TA_DUTY"}>
                          {classType === "TA_DUTY" ? "No course (optional)" : "Select a course"}
                        </option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {formatCourseCode(c.code)} — {c.name} ({formatCredits(c.credits)} cr)
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                )}
              </div>

              {isEditing ? (
                <>
                  {/* Schedule (single) */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Day</label>
                      <select
                        value={dayOfWeek}
                        onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                      >
                        {DAYS.map((day) => (
                          <option key={day} value={day}>
                            {day.charAt(0) + day.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Start</label>
                      <select
                        value={startTime}
                        onChange={(e) => {
                          const nextStartTime = e.target.value;
                          setStartTime(nextStartTime);
                          if (endTime <= nextStartTime) {
                            const nextEndTime = END_TIMES.find((t) => t > nextStartTime);
                            if (nextEndTime) setEndTime(nextEndTime);
                          }
                        }}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                      >
                        {START_TIMES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">End</label>
                      <select
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                      >
                        {endOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Slot (optional)</label>
                      <input
                        value={slot}
                        onChange={(e) => setSlot(e.target.value)}
                        placeholder="e.g., A"
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Venue (optional)</label>
                      <input
                        list={venueListId}
                        value={venue}
                        onChange={(e) => setVenue(e.target.value)}
                        placeholder="Pick a classroom"
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Class Type</label>
                      <select
                        value={classType}
                        onChange={(e) => setClassType(e.target.value as ClassType)}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                      >
                        {Object.entries(CLASS_TYPE_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface cursor-pointer hover:bg-surface-hover transition-colors">
                      <input
                        type="radio"
                        name="tt-kind"
                        checked={effectiveKind === "NON_IC"}
                        onChange={() => {
                          const nextKind: TimetableKind = "NON_IC";
                          setKindTouched(true);
                          setTimetableKind(nextKind);
                          setDraftsTouched(false);
                          setDrafts([]);
                        }}
                        className="w-4 h-4 accent-primary"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">Non-IC</p>
                        <p className="text-xs text-foreground-secondary">Main timetable</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface cursor-pointer hover:bg-surface-hover transition-colors">
                      <input
                        type="radio"
                        name="tt-kind"
                        checked={effectiveKind === "IC"}
                        onChange={() => {
                          const nextKind: TimetableKind = "IC";
                          setKindTouched(true);
                          setTimetableKind(nextKind);
                          setDraftsTouched(false);
                          setDrafts([]);
                        }}
                        className="w-4 h-4 accent-primary"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">IC</p>
                        <p className="text-xs text-foreground-secondary">IC timetable</p>
                      </div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Slot</label>
                      <input
                        value={effectiveSlotInput}
                        onChange={(e) => {
                          setSlotTouched(true);
                          setSlotInput(e.target.value);
                        }}
                        placeholder="e.g., B, A + L4, L2, FS"
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                      />
                      <p className="text-[11px] text-foreground-secondary mt-2">
                        A–H auto-fills lecture timings. L1–L5 auto-fills labs. FS/NS can be entered manually.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftsTouched(true);
                        setDrafts(slotResult.drafts);
                      }}
                      className="px-4 py-2.5 min-h-[44px] rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={!effectiveSlotInput.trim()}
                    >
                      Auto-fill
                    </button>
                  </div>

                  {slotResult.warnings.length > 0 && (
                    <div className="rounded-xl border border-border bg-surface p-3">
                      <p className="text-xs font-semibold text-foreground mb-1">Heads up</p>
                      <ul className="text-xs text-foreground-secondary list-disc pl-4 space-y-1">
                        {slotResult.warnings.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">Classes ({activeDrafts.length})</p>
                    <button
                      type="button"
                      onClick={addBlankDraft}
                      className="px-3 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-medium transition-colors inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add meeting
                    </button>
                  </div>

                  {activeDrafts.length === 0 ? (
                    <div className="p-4 rounded-xl border border-border bg-surface text-sm text-foreground-secondary">
                      Enter a slot and click Auto-fill.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeDrafts.map((d) => {
                        const rowEndOptions = END_TIMES.filter((t) => t > d.startTime);
                        return (
                          <div key={d.id} className="rounded-xl border border-border bg-surface p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {d.slot && (
                                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                                    {d.slot}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-full bg-background-secondary border border-border/60 text-xs text-foreground-secondary">
                                  {CLASS_TYPE_LABEL[d.classType]}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeDraft(d.id)}
                                className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
                                aria-label="Remove meeting"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <select
                                value={d.dayOfWeek}
                                onChange={(e) => updateDraft(d.id, { dayOfWeek: e.target.value as DayOfWeek })}
                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                              >
                                {DAYS.map((day) => (
                                  <option key={day} value={day}>
                                    {day.charAt(0) + day.slice(1).toLowerCase()}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={d.startTime}
                                onChange={(e) => {
                                  const nextStart = e.target.value;
                                  const nextEnd = d.endTime <= nextStart ? (END_TIMES.find((t) => t > nextStart) || d.endTime) : d.endTime;
                                  updateDraft(d.id, { startTime: nextStart, endTime: nextEnd });
                                }}
                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                              >
                                {START_TIMES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={d.endTime}
                                onChange={(e) => updateDraft(d.id, { endTime: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                              >
                                {rowEndOptions.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>

                              <input
                                list={venueListId}
                                value={d.venue || ""}
                                onChange={(e) => updateDraft(d.id, { venue: e.target.value })}
                                placeholder="Venue"
                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                              />
                            </div>

                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <select
                                value={d.classType}
                                onChange={(e) => updateDraft(d.id, { classType: e.target.value as ClassType })}
                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                              >
                                {Object.entries(CLASS_TYPE_LABEL).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                              <div className="text-xs text-foreground-secondary flex items-center">
                                {d.venue ? "" : "Select a venue"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <label className="flex items-start gap-3 p-3 rounded-xl border border-border bg-surface">
                    <input
                      type="checkbox"
                      checked={replaceExisting}
                      onChange={(e) => setReplaceExisting(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-primary"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Replace existing course schedule</p>
                      <p className="text-xs text-foreground-secondary mt-0.5">
                        {existingCount > 0 ? `${existingCount} existing classes found.` : "No existing classes found."} Updates are shared.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Instructor (optional)</label>
                  <input
                    value={instructor}
                    onChange={(e) => setInstructor(e.target.value)}
                    placeholder="e.g., Prof. Sharma"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Notes (optional)</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any reminder…"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {initial && !initial.isOfficial && (!initial.isOfficialCorrection || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => onDeleteEntry(initial)}
                    disabled={deleting}
                    className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {deleting ? "Deleting..." : "Delete class"}
                  </button>
                )}
                {initial?.googleEventId && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm("Delete this event from Google Calendar? It will remain in the app.")) return;
                      try {
                        const res = await fetch("/api/calendar/delete", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ eventId: initial.googleEventId }),
                        });
                        if (!res.ok) throw new Error("Failed to delete from Google Calendar");
                        showToast("success", "Removed from Google Calendar");
                      } catch (error) {
                        showToast("error", "Failed to delete from Google Calendar");
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 font-medium transition-colors"
                  >
                    Remove from Google Calendar
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-foreground font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || (!isEditing && activeDrafts.length === 0)}
                  className="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {initial?.isOfficial || initial?.isOfficialCorrection
                    ? isAdmin ? "Save changes" : "Submit correction"
                    : initial
                      ? "Save changes"
                      : `Add classes (${activeDrafts.length})`}
                </button>
              </div>

              <p className="text-xs text-foreground-secondary">
                {initial?.isOfficial || initial?.isOfficialCorrection
                  ? isAdmin
                    ? "Your changes are applied to the shared timetable immediately."
                    : "The approved timetable stays visible until an admin approves this correction."
                  : "Changes update the shared timetable for everyone enrolled in the selected course."}
              </p>
            </form>
      </div>
    </div>
  );
}
