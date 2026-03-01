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
  Trash2,
  X,
} from "lucide-react";
import { useConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./ToastProvider";
import { formatCourseCode } from "@/lib/utils";

interface TimetableViewProps {
  userId: string;
}

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const pad2 = (n: number) => String(n).padStart(2, "0");
const minutesToTime = (minutes: number) => `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;

const TIME_OPTIONS = Array.from({ length: (19 - 8) * 2 + 1 }, (_, i) => minutesToTime(8 * 60 + i * 30));
const START_TIMES = TIME_OPTIONS.slice(0, -1);
const END_TIMES = TIME_OPTIONS.slice(1);
const DEFAULT_START_TIME = START_TIMES.includes("10:00") ? "10:00" : START_TIMES[0];
const DEFAULT_END_TIME = END_TIMES.includes("11:00") ? "11:00" : END_TIMES[0];

type DayOfWeek = (typeof DAYS)[number];
type Term = "FALL" | "SPRING" | "SUMMER";
type ClassType = "LECTURE" | "LAB" | "TUTORIAL" | "SEMINAR" | "WORKSHOP";
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
  courseId: string;
  course?: {
    id: string;
    code: string;
    name: string;
    credits: number;
  } | null;
}

interface CourseOption {
  id: string;
  code: string;
  name: string;
  credits: number;
}

type TimetableEntryPayload = {
  courseId: string;
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
  courseId: string;
  replaceExisting?: boolean;
  entries: Array<Omit<TimetableEntryPayload, "courseId">>;
};

type TimetableResponse = {
  context: { semester: number; year: number; term: Term };
  courses: CourseOption[];
  entries: TimetableEntry[];
};

export function TimetableView({ userId }: TimetableViewProps) {
  const [view, setView] = useState<"week" | "list">("list");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);

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
    },
    onError: (error: any) => {
      showToast("error", error?.message || "Failed to delete class");
    },
  });

  const openAdd = () => {
    setEditingEntry(null);
    setModalOpen(true);
  };

  const openEdit = (entry: TimetableEntry) => {
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

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-96 bg-background-secondary dark:bg-surface rounded-lg"></div>
      </div>
    );
  }

  const context = timetable?.context;
  const courses = timetable?.courses || [];
  const entries: TimetableEntry[] = timetable?.entries || [];
  const canAdd = courses.length > 0 && Boolean(context);

  return (
    <div className="space-y-6">
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === "week" ? "list" : "week")}
            className="hidden md:flex px-4 py-2 min-h-[44px] border border-border rounded-xl text-sm font-medium text-foreground-secondary hover:bg-background-secondary items-center transition-colors"
          >
            {view === "week" ? "List View" : "Week View"}
          </button>
          <button
            onClick={() => {
              if (!canAdd) {
                showToast("warning", "Enroll in current semester courses to build the shared timetable");
                return;
              }
              openAdd();
            }}
            disabled={!canAdd}
            className="flex-1 sm:flex-none px-4 py-2 min-h-[44px] bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Class
          </button>
        </div>
      </div>

      {view === "week" ? (
        <WeekView timetable={entries} onEdit={openEdit} onDelete={handleDelete} />
      ) : (
        <ListView timetable={entries} onEdit={openEdit} onDelete={handleDelete} />
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
            }}
            onSave={(payload) => saveEntryMutation.mutate({ id: editingEntry?.id, payload })}
            onSaveBulk={(payload) => bulkCreateMutation.mutate(payload)}
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
}: {
  timetable: TimetableEntry[];
  onEdit: (entry: TimetableEntry) => void;
  onDelete: (entry: TimetableEntry) => void;
}) {
  const index = useMemo(() => {
    const map = new Map<string, TimetableEntry>();
    for (const entry of timetable) {
      map.set(`${entry.dayOfWeek}-${entry.startTime}`, entry);
    }
    return map;
  }, [timetable]);

  return (
    <div className="bg-surface dark:bg-surface rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full divide-y divide-border">
          <thead className="bg-background-secondary dark:bg-background">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground-secondary uppercase tracking-wider w-24">
                Time
              </th>
              {DAYS.map((day) => (
                <th
                  key={day}
                  className="px-4 py-3 text-left text-xs font-medium text-foreground-secondary uppercase tracking-wider"
                >
                  {day.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-border">
            {START_TIMES.map((time) => (
              <tr key={time}>
                <td className="px-4 py-3 text-sm text-foreground-secondary font-medium">
                  {time}
                </td>
                {DAYS.map((day) => {
                  const entry = index.get(`${day}-${time}`);
                  return (
                    <td
                      key={day}
                      className="px-2 py-2 text-sm border-l border-border"
                    >
                      {entry && (
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={() => onEdit(entry)}
                            className="w-full text-left bg-primary/10 dark:bg-primary/20 border-l-4 border-primary rounded p-2 pr-6 hover:bg-primary/15 dark:hover:bg-primary/25 transition-colors"
                          >
                            <p className="font-medium text-foreground text-xs truncate">
                              {formatCourseCode(entry.course?.code || "")}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-foreground-secondary mt-1">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">
                                {entry.venue || "TBA"}
                                {entry.slot ? ` • Slot ${entry.slot}` : ""}
                              </span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDelete(entry); }}
                            className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                            aria-label="Delete class"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
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
}: {
  timetable: TimetableEntry[];
  onEdit: (entry: TimetableEntry) => void;
  onDelete: (entry: TimetableEntry) => void;
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
            {classes.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3 sm:p-4 bg-background-secondary dark:bg-background rounded-lg border border-border/60 hover:border-border transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  className="flex-1 min-w-0 text-left group"
                >
                  <h4 className="font-medium text-foreground text-sm sm:text-base truncate group-hover:text-primary transition-colors">
                    {entry.course?.name}
                  </h4>
                  <p className="text-xs sm:text-sm text-foreground-secondary mt-0.5">{formatCourseCode(entry.course?.code || "")}</p>
                  <div className="flex flex-wrap gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-foreground-secondary">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      {entry.startTime} - {entry.endTime}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      {entry.venue || "TBA"}
                    </div>
                    {entry.slot && (
                      <span className="px-2 py-0.5 bg-background-secondary dark:bg-background border border-border/60 text-foreground-secondary rounded text-xs">
                        Slot {entry.slot}
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-primary/10 dark:bg-primary/20 text-primary rounded text-xs">
                      {CLASS_TYPE_LABEL[entry.classType] || entry.classType}
                    </span>
                  </div>
                </button>
                <div className="flex items-center gap-1 sm:ml-2 flex-shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => onEdit(entry)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground-secondary hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors"
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
            ))}
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
}: {
  initial: TimetableEntry | null;
  context: TimetableResponse["context"] | null;
  courses: CourseOption[];
  existingEntries: TimetableEntry[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: TimetableEntryPayload) => void;
  onSaveBulk: (payload: BulkCreatePayload) => void;
}) {
  const reducedMotion = useReducedMotion();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();

  const isEditing = Boolean(initial);

  const { data: autofillData } = useQuery<{
    version: string;
    venues: string[];
    defaults: {
      nonIc: Record<string, { slot?: string; classroom?: string }>;
      ic: Record<string, { slot?: string; classroom?: string }>;
    };
    pcLab: Record<string, { kind: "IC" | "NON_IC"; slot: string; venue: string; time: string }>;
  }>({
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
  const [classType, setClassType] = useState<ClassType>(initial?.classType ?? "LECTURE");

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
        classType: "LECTURE",
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
          classType: "LECTURE",
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

    if (!courseId) {
      showToast("warning", "Select a course first");
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
        courseId,
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

    if (!selectedCourse) {
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
      courseId,
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
        className="relative w-full sm:max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden"
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

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
              {/* Course picker */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Course</label>

                {initial ? (
                  <div className="p-3 rounded-xl bg-background-secondary border border-border">
                    <p className="text-sm text-foreground truncate">
                      {initial.course ? `${formatCourseCode(initial.course.code)} — ${initial.course.name}` : "Selected course"}
                    </p>
                    <p className="text-xs text-foreground-secondary mt-0.5">
                      Course is fixed for an existing schedule entry.
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
                      disabled={courses.length === 0}
                    >
                    {courses.length === 0 ? (
                      <option value="">No courses enrolled</option>
                    ) : (
                      <>
                        <option value="" disabled>
                          Select a course
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
