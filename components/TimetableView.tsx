"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import { formatCourseCode } from "@/lib/utils";
import { downloadICS } from "@/lib/icsGenerator";

interface TimetableViewProps {
  userId: string;
}

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const WEEK_DAYS = DAYS.slice(0, 5); // Mon–Fri only (no Saturday in week view)

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

type SlotSession = {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
};

type MeetingDraft = {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slot?: string;
  venue?: string;
  classType: ClassType;
};

const NON_IC_SLOTS: Record<string, SlotSession[]> = {
  A: [
    { dayOfWeek: "MONDAY", startTime: "08:00", endTime: "08:50" },
    { dayOfWeek: "TUESDAY", startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "THURSDAY", startTime: "09:00", endTime: "09:50" },
  ],
  B: [
    { dayOfWeek: "MONDAY", startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "TUESDAY", startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "THURSDAY", startTime: "10:00", endTime: "10:50" },
  ],
  C: [
    { dayOfWeek: "MONDAY", startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "08:00", endTime: "08:50" },
    { dayOfWeek: "THURSDAY", startTime: "11:00", endTime: "11:50" },
  ],
  D: [
    { dayOfWeek: "MONDAY", startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "THURSDAY", startTime: "12:00", endTime: "12:50" },
  ],
  E: [
    { dayOfWeek: "MONDAY", startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "FRIDAY", startTime: "09:00", endTime: "09:50" },
  ],
  F: [
    { dayOfWeek: "TUESDAY", startTime: "08:00", endTime: "08:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "FRIDAY", startTime: "11:00", endTime: "11:50" },
  ],
  G: [
    { dayOfWeek: "TUESDAY", startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "THURSDAY", startTime: "08:00", endTime: "08:50" },
    { dayOfWeek: "FRIDAY", startTime: "10:00", endTime: "10:50" },
  ],
  H: [
    { dayOfWeek: "TUESDAY", startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "FRIDAY", startTime: "08:00", endTime: "08:50" },
  ],
};

const IC_SLOTS: Record<string, SlotSession[]> = {
  A: [
    { dayOfWeek: "MONDAY", startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "FRIDAY", startTime: "09:00", endTime: "09:50" },
  ],
  B: [
    { dayOfWeek: "MONDAY", startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "FRIDAY", startTime: "11:00", endTime: "11:50" },
  ],
  C: [
    { dayOfWeek: "TUESDAY", startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "THURSDAY", startTime: "10:00", endTime: "10:50" },
  ],
  D: [
    { dayOfWeek: "MONDAY", startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "TUESDAY", startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "FRIDAY", startTime: "10:00", endTime: "10:50" },
  ],
  E: [
    { dayOfWeek: "TUESDAY", startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "THURSDAY", startTime: "11:00", endTime: "11:50" },
  ],
  F: [
    { dayOfWeek: "MONDAY", startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "FRIDAY", startTime: "12:00", endTime: "12:50" },
  ],
  G: [
    { dayOfWeek: "TUESDAY", startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "THURSDAY", startTime: "12:00", endTime: "12:50" },
  ],
  H: [{ dayOfWeek: "THURSDAY", startTime: "09:00", endTime: "09:50" }],
};

const LAB_SLOTS: Record<string, SlotSession[]> = {
  L1: [{ dayOfWeek: "MONDAY", startTime: "14:00", endTime: "17:00" }],
  L2: [{ dayOfWeek: "TUESDAY", startTime: "14:00", endTime: "17:00" }],
  L3: [{ dayOfWeek: "WEDNESDAY", startTime: "14:00", endTime: "17:00" }],
  L4: [{ dayOfWeek: "THURSDAY", startTime: "14:00", endTime: "17:00" }],
  L5: [{ dayOfWeek: "FRIDAY", startTime: "14:00", endTime: "17:00" }],
};

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const COURSE_COLORS = [
  { bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-500", text: "text-blue-700 dark:text-blue-300", hover: "hover:bg-blue-150 dark:hover:bg-blue-900/40" },
  { bg: "bg-green-100 dark:bg-green-900/30", border: "border-green-500", text: "text-green-700 dark:text-green-300", hover: "hover:bg-green-150 dark:hover:bg-green-900/40" },
  { bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-500", text: "text-purple-700 dark:text-purple-300", hover: "hover:bg-purple-150 dark:hover:bg-purple-900/40" },
  { bg: "bg-orange-100 dark:bg-orange-900/30", border: "border-orange-500", text: "text-orange-700 dark:text-orange-300", hover: "hover:bg-orange-150 dark:hover:bg-orange-900/40" },
  { bg: "bg-pink-100 dark:bg-pink-900/30", border: "border-pink-500", text: "text-pink-700 dark:text-pink-300", hover: "hover:bg-pink-150 dark:hover:bg-pink-900/40" },
  { bg: "bg-teal-100 dark:bg-teal-900/30", border: "border-teal-500", text: "text-teal-700 dark:text-teal-300", hover: "hover:bg-teal-150 dark:hover:bg-teal-900/40" },
  { bg: "bg-indigo-100 dark:bg-indigo-900/30", border: "border-indigo-500", text: "text-indigo-700 dark:text-indigo-300", hover: "hover:bg-indigo-150 dark:hover:bg-indigo-900/40" },
  { bg: "bg-red-100 dark:bg-red-900/30", border: "border-red-500", text: "text-red-700 dark:text-red-300", hover: "hover:bg-red-150 dark:hover:bg-red-900/40" },
  { bg: "bg-yellow-100 dark:bg-yellow-900/30", border: "border-yellow-500", text: "text-yellow-700 dark:text-yellow-300", hover: "hover:bg-yellow-150 dark:hover:bg-yellow-900/40" },
  { bg: "bg-cyan-100 dark:bg-cyan-900/30", border: "border-cyan-500", text: "text-cyan-700 dark:text-cyan-300", hover: "hover:bg-cyan-150 dark:hover:bg-cyan-900/40" },
];

function getCourseColor(courseCode: string, classType?: string): typeof COURSE_COLORS[0] {
  // Special color for TA duties
  if (classType === "TA_DUTY") {
    return { bg: "bg-amber-100 dark:bg-amber-900/30", border: "border-amber-600", text: "text-amber-800 dark:text-amber-200", hover: "hover:bg-amber-150 dark:hover:bg-amber-900/40" };
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
};

type BulkCreatePayload = {
  courseId?: string;
  replaceExisting?: boolean;
  entries: Array<Omit<TimetableEntryPayload, "courseId">>;
};

type TimetableResponse = {
  context: { semester: number; year: number; term: Term };
  courses: CourseOption[];
  entries: TimetableEntry[];
};

type TimetableAutofillData = {
  version: string;
  venues: string[];
  defaults: {
    nonIc: Record<string, { slot?: string; classroom?: string }>;
    ic: Record<string, { slot?: string; classroom?: string }>;
  };
  pcLab: Record<string, { kind: "IC" | "NON_IC"; slot: string; venue: string; time: string }>;
};

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
    queryKey: ["timetable", userId],
    queryFn: async () => {
      const res = await fetch("/api/timetable");
      if (!res.ok) throw new Error("Failed to fetch timetable");
      return res.json();
    },
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
    enabled: timetable?.context !== null,
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
      const res = await fetch(id ? `/api/timetable/${id}` : "/api/timetable", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || (id ? "Failed to update class" : "Failed to add class"));
      }
      return data as TimetableEntry;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["timetable", userId] });
      showToast("success", editingEntry ? "Class updated" : "Class added");
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

  const openEdit = (entry: TimetableEntry) => {
    setAddingTaDuty(false);
    setEditingEntry(entry);
    setModalOpen(true);
  };

  const handleDelete = async (entry: TimetableEntry) => {
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

  const context = timetable?.context ?? null;
  const courses = useMemo(() => timetable?.courses ?? [], [timetable?.courses]);
  const entries = useMemo<TimetableEntry[]>(() => timetable?.entries ?? [], [timetable?.entries]);
  const canAddClass = courses.length > 0 && Boolean(context);
  const canAddTaDuty = Boolean(context);

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
        defaultVenue: suggestion.classroom,
        pcLab: suggestion.pcLab,
      });

      if (result.entries.length === 0) continue;

      next.push({ courseId: c.id, courseCode: c.code, entries: result.entries });
    }

    return next;
  }, [autofillData, courses, scheduledCourseIds]);

  const canAutofill = canAddClass && autofillCandidates.length > 0;

  const handleExportCalendar = async () => {
    if (entries.length === 0) {
      showToast("warning", "No classes to export");
      return;
    }
    
    // Try to add directly to Google Calendar via API
    try {
      console.log("[Calendar Export] Sending", entries.length, "entries to API...");
      const response = await fetch("/api/calendar/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });

      const data = await response.json();
      console.log("[Calendar Export] Response:", response.status, data);

      if (response.ok && data.success) {
        const msg = data.failures?.length > 0
          ? `${data.message}`
          : data.message || "Events added to Google Calendar";
        showToast("success", msg);
        if (data.failures?.length > 0) {
          console.warn("[Calendar Export] Failed events:", data.failures);
        }
        return;
      }

      if (response.ok && !data.success) {
        // All events failed (200 but no events created)
        const firstErr = data.failures?.[0]?.error || "Unknown error";
        console.error("[Calendar Export] All events failed. First error:", firstErr, data.failures);
        if (data.needs_reauth || /insufficient|scope|unauthorized|invalid_grant|token/i.test(firstErr)) {
          showToast("error", "Google Calendar: No permission — please Sign Out and Sign In again to grant calendar access.");
        } else {
          showToast("error", `Calendar sync failed: ${firstErr}`);
        }
        return;
      }

      if (!response.ok) {
        const errorMsg = data.error || `Server error ${response.status}`;
        console.error("[Calendar Export] API error:", errorMsg, data);
        if (response.status === 401 || response.status === 403) {
          showToast("error", data.error || "Google Calendar auth expired — please sign out and sign in again.");
        } else {
          window.open("https://calendar.google.com", "_blank");
          showToast("warning", `Calendar sync failed — opening Google Calendar. Re-sign in if needed.`);
        }
        return;
      }
    } catch (error) {
      console.error("[Calendar Export] Network error:", error);
      // Fallback to .ics on network error only
      const endDate = new Date("2026-05-01");
      const filename = `timetable-${context?.term || "current"}-${context?.year || "semester"}.ics`;
      downloadICS(entries, filename, endDate);
      showToast("warning", "Network error — calendar file downloaded as backup");
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
      {/* Admin Pending Approvals */}
      {pendingData && pendingData.entries.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Pending Approvals ({pendingData.entries.length})
            </h3>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
            Review and approve timetable changes submitted by students
          </p>
          <div className="space-y-2">
            {pendingData.entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white dark:bg-surface rounded-lg border border-amber-200 dark:border-amber-800 p-3 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {formatCourseCode(entry.course?.code || "")} - {entry.classType}
                  </p>
                  <p className="text-xs text-foreground-secondary mt-0.5">
                    {entry.dayOfWeek.charAt(0) + entry.dayOfWeek.slice(1).toLowerCase()} · {entry.startTime} - {entry.endTime}
                    {entry.venue && ` · ${entry.venue}`}
                  </p>
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
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {context ? `Semester ${context.semester} · ${context.term} ${context.year}` : "Current semester"}
          </p>
          <p className="mt-1 text-xs text-foreground-secondary">
            Schedule is shared across everyone enrolled in a course. {courses.length > 0 ? `${courses.length} courses found.` : "No enrolled courses found."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <button
            onClick={handleExportCalendar}
            disabled={entries.length === 0}
            className="flex px-4 py-2 min-h-[44px] border border-border rounded-xl text-sm font-medium text-foreground-secondary hover:bg-background-secondary items-center gap-2 transition-colors transition-transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Add to Google Calendar
          </button>
          <button
            onClick={() => setView(view === "week" ? "list" : "week")}
            className="hidden md:flex px-4 py-2 min-h-[44px] border border-border rounded-xl text-sm font-medium text-foreground-secondary hover:bg-background-secondary items-center transition-colors transition-transform active:scale-[0.99]"
          >
            {view === "week" ? "List View" : "Week View"}
          </button>
          <button
            onClick={async () => {
              if (!canAutofill) {
                if (!canAddClass) showToast("warning", "Enroll in current semester courses to build the shared timetable");
                else showToast("info", "No missing schedules found to auto-fill");
                return;
              }

              const totalClasses = autofillCandidates.reduce((sum, c) => sum + c.entries.length, 0);
              const ok = await confirm({
                title: "Auto-fill missing schedules?",
                message: `This will create shared timetable entries for ${autofillCandidates.length} courses (${totalClasses} classes) for the current semester. Anyone enrolled will see them.`,
                confirmText: "Auto-fill",
                variant: "info",
              });
              if (!ok) return;

              autofillMissingMutation.mutate(autofillCandidates);
            }}
            disabled={!canAutofill || autofillMissingMutation.isPending}
            className="w-full sm:w-auto px-4 py-2 min-h-[44px] rounded-xl border border-primary/25 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/15 transition-colors transition-transform active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {autofillMissingMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Auto-fill missing ({autofillCandidates.length})
          </button>
          <button
            onClick={() => {
              if (!canAddClass) {
                showToast("warning", "Enroll in current semester courses to build the shared timetable");
                return;
              }
              openAdd();
            }}
            disabled={!canAddClass}
            className="flex-1 sm:flex-none px-4 py-2 min-h-[44px] bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Class
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
      </div>

      {view === "week" ? (
        <WeekView timetable={entries} onEdit={openEdit} onDelete={handleDelete} onDeleteCalendar={handleDeleteCalendar} />
      ) : (
        <ListView timetable={entries} onEdit={openEdit} onDelete={handleDelete} onDeleteCalendar={handleDeleteCalendar} />
      )}

      <AnimatePresence>
        {modalOpen && (
          <TimetableEntryModal
            key={editingEntry?.id || "new"}
            initial={editingEntry}
            context={context || null}
            courses={courses}
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
            defaultClassType={addingTaDuty ? "TA_DUTY" : undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function WeekView({
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
  const timeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  // Find the slot index that contains this time (floor to nearest 30-min slot)
  const findSlotIndex = (time: string) => {
    const exact = WEEK_VIEW_TIMES.indexOf(time);
    if (exact >= 0) return exact;
    const mins = timeToMinutes(time);
    for (let i = WEEK_VIEW_TIMES.length - 1; i >= 0; i--) {
      if (timeToMinutes(WEEK_VIEW_TIMES[i]) <= mins) return i;
    }
    return 0;
  };

  // How many 30-min slot rows does this entry span?
  const calculateRowSpan = (startTime: string, endTime: string) => {
    const startIdx = findSlotIndex(startTime);
    const endMins = timeToMinutes(endTime);
    let count = 0;
    for (let i = startIdx; i < WEEK_VIEW_TIMES.length; i++) {
      if (timeToMinutes(WEEK_VIEW_TIMES[i]) < endMins) count++;
      else break;
    }
    return Math.max(1, count);
  };

  // Track rows spanned by an entry so we skip rendering them
  const coveredCellsByDay = useMemo(() => {
    const map: Record<string, Set<number>> = Object.fromEntries(WEEK_DAYS.map((d) => [d, new Set<number>()]));
    for (const entry of timetable) {
      if (!WEEK_DAYS.includes(entry.dayOfWeek)) continue;
      const startIdx = findSlotIndex(entry.startTime);
      const rowSpan = calculateRowSpan(entry.startTime, entry.endTime);
      for (let i = 1; i < rowSpan; i++) {
        map[entry.dayOfWeek]?.add(startIdx + i);
      }
    }
    return map;
  }, [timetable]);

  // Get entry that starts within a given slot's 30-min window
  const getEntry = (day: string, slotIdx: number) => {
    const slotMins = timeToMinutes(WEEK_VIEW_TIMES[slotIdx]);
    const nextMins = slotIdx + 1 < WEEK_VIEW_TIMES.length ? timeToMinutes(WEEK_VIEW_TIMES[slotIdx + 1]) : slotMins + 30;
    return timetable.find(e => {
      if (e.dayOfWeek !== day) return false;
      const startMins = timeToMinutes(e.startTime);
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

                  const rowSpan = calculateRowSpan(entry.startTime, entry.endTime);
                  const durationMins = timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime);
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
                        {/* Delete from timetable */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onDelete(entry); }}
                          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                          aria-label="Delete class"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
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
          Add timings for your enrolled courses — updates show up for everyone taking that course.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupedByDay.map(({ day, classes }) => (
        <div key={day} className="bg-surface dark:bg-surface rounded-lg border border-border p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 capitalize">{day.charAt(0) + day.slice(1).toLowerCase()}</h3>
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
                  <button
                    type="button"
                    onClick={() => onDelete(entry)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    aria-label="Delete class"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
  defaultClassType?: ClassType;
}) {
  const reducedMotion = useReducedMotion();
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

  const title = initial ? "Edit class" : "Add classes";

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4"
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

      <motion.div
        initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="relative w-full sm:max-w-xl max-h-[80vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
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
                            {formatCourseCode(c.code)} — {c.name}
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
                {initial && (
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
                  disabled={saving || (!isEditing && drafts.length === 0)}
                  className="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {initial ? "Save changes" : `Add classes (${drafts.length})`}
                </button>
              </div>

              <p className="text-xs text-foreground-secondary">
                Changes update the shared timetable for everyone enrolled in the selected course.
              </p>
            </form>
      </motion.div>
    </motion.div>
  );
}
