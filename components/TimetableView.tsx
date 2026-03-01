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
            saving={saveEntryMutation.isPending}
            onClose={() => {
              setModalOpen(false);
              setEditingEntry(null);
            }}
            onSave={(payload) => saveEntryMutation.mutate({ id: editingEntry?.id, payload })}
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
  saving,
  onClose,
  onSave,
}: {
  initial: TimetableEntry | null;
  context: TimetableResponse["context"] | null;
  courses: CourseOption[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: TimetableEntryPayload) => void;
}) {
  const reducedMotion = useReducedMotion();
  const { showToast } = useToast();

  const initialCourseId = initial?.courseId ?? courses[0]?.id ?? "";
  const initialStartTime = initial?.startTime ?? DEFAULT_START_TIME;
  const initialEndTime = initial?.endTime ?? DEFAULT_END_TIME;
  const safeInitialEndTime =
    initialEndTime > initialStartTime
      ? initialEndTime
      : END_TIMES.find((t) => t > initialStartTime) || DEFAULT_END_TIME;

  const [courseId, setCourseId] = useState<string>(initialCourseId);
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(initial?.dayOfWeek ?? "MONDAY");
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(safeInitialEndTime);
  const [slot, setSlot] = useState(initial?.slot ?? "");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [classType, setClassType] = useState<ClassType>(initial?.classType ?? "LECTURE");
  const [instructor, setInstructor] = useState(initial?.instructor ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const selectedCourse = useMemo(() => {
    return courses.find((c) => c.id === courseId) || null;
  }, [courses, courseId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const endOptions = useMemo(() => {
    return END_TIMES.filter((t) => t > startTime);
  }, [startTime]);

  const title = initial ? "Edit class" : "Add class";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!courseId) {
      showToast("warning", "Select a course first");
      return;
    }
    if (!selectedCourse && !initial) {
      showToast("warning", "Please select a valid course");
      return;
    }
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
                  {context ? `Semester ${context.semester} • ${context.term} ${context.year}` : "Current semester"} •{" "}
                  {initial ? "Update details" : "Create a new entry"}
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
                    onChange={(e) => setCourseId(e.target.value)}
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

              {/* Schedule */}
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
                    placeholder="e.g., A1"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                  />
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Venue (optional)</label>
                  <input
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g., LHC-101"
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
                  disabled={saving}
                  className="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {initial ? "Save changes" : "Add class"}
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
