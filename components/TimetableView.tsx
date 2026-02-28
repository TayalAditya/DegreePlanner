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
  Search,
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
const START_TIMES = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", 
  "14:00", "15:00", "16:00", "17:00", "18:00"
];
const END_TIMES = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00",
];

type DayOfWeek = (typeof DAYS)[number];

interface TimetableEntry {
  id: string;
  semester: number;
  year: number;
  term: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  venue?: string | null;
  roomNumber?: string | null;
  building?: string | null;
  classType?: string | null;
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
  department?: string;
}

type TimetableEntryPayload = {
  semester: number;
  courseId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  venue?: string;
  classType?: string;
  instructor?: string;
  notes?: string;
};

export function TimetableView({ userId }: TimetableViewProps) {
  const [selectedSemester, setSelectedSemester] = useState(1);
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

  const { data: timetable, isLoading } = useQuery({
    queryKey: ["timetable", userId, selectedSemester],
    queryFn: async () => {
      const res = await fetch(`/api/timetable?semester=${selectedSemester}`);
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
      await queryClient.invalidateQueries({ queryKey: ["timetable", userId, selectedSemester] });
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
      await queryClient.invalidateQueries({ queryKey: ["timetable", userId, selectedSemester] });
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
      message: `This will remove ${entry.course?.code || "this class"} from your timetable.`,
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

  const entries: TimetableEntry[] = timetable || [];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-foreground whitespace-nowrap">Semester:</label>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(Number(e.target.value))}
            className="flex-1 sm:flex-none px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface text-foreground focus:ring-2 focus:ring-primary text-sm"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <option key={sem} value={sem}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === "week" ? "list" : "week")}
            className="hidden md:flex px-4 py-2 min-h-[44px] border border-border rounded-md text-sm font-medium text-foreground-secondary hover:bg-background-secondary items-center"
          >
            {view === "week" ? "List View" : "Week View"}
          </button>
          <button
            onClick={openAdd}
            className="flex-1 sm:flex-none px-4 py-2 min-h-[44px] bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            Add Class
          </button>
        </div>
      </div>

      {view === "week" ? (
        <WeekView timetable={entries} onEdit={openEdit} />
      ) : (
        <ListView timetable={entries} onEdit={openEdit} onDelete={handleDelete} />
      )}

      <TimetableEntryModal
        open={modalOpen}
        initial={editingEntry}
        semester={selectedSemester}
        saving={saveEntryMutation.isPending}
        onClose={() => {
          setModalOpen(false);
          setEditingEntry(null);
        }}
        onSave={(payload) => saveEntryMutation.mutate({ id: editingEntry?.id, payload })}
      />
    </div>
  );
}

function WeekView({
  timetable,
  onEdit,
}: {
  timetable: TimetableEntry[];
  onEdit: (entry: TimetableEntry) => void;
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
                        <button
                          type="button"
                          onClick={() => onEdit(entry)}
                          className="w-full text-left bg-primary/10 dark:bg-primary/20 border-l-4 border-primary rounded p-2 hover:bg-primary/15 dark:hover:bg-primary/25 transition-colors"
                        >
                          <p className="font-medium text-foreground text-xs truncate">
                            {formatCourseCode(entry.course?.code || "")}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-foreground-secondary mt-1">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{entry.venue || "TBA"}</span>
                          </div>
                        </button>
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
        <p className="text-foreground-secondary">No classes scheduled for this semester</p>
        <p className="text-xs text-foreground-muted mt-2">Tap “Add Class” to build your timetable.</p>
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
                    {entry.classType && (
                      <span className="px-2 py-0.5 bg-primary/10 dark:bg-primary/20 text-primary rounded text-xs">
                        {entry.classType}
                      </span>
                    )}
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
  open,
  initial,
  semester,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: TimetableEntry | null;
  semester: number;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: TimetableEntryPayload) => void;
}) {
  const reducedMotion = useReducedMotion();
  const { showToast } = useToast();

  const [courseId, setCourseId] = useState<string>("");
  const [courseLabel, setCourseLabel] = useState<string>("");
  const [courseSearch, setCourseSearch] = useState("");
  const [courseResults, setCourseResults] = useState<CourseOption[]>([]);
  const [courseSearching, setCourseSearching] = useState(false);

  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>("MONDAY");
  const [startTime, setStartTime] = useState(START_TIMES[2]);
  const [endTime, setEndTime] = useState(END_TIMES[2]);
  const [venue, setVenue] = useState("");
  const [classType, setClassType] = useState("");
  const [instructor, setInstructor] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;

    setCourseId(initial?.courseId || "");
    setCourseLabel(initial?.course ? `${initial.course.code} — ${initial.course.name}` : "");
    setCourseSearch("");
    setCourseResults([]);

    setDayOfWeek(initial?.dayOfWeek || "MONDAY");
    setStartTime(initial?.startTime || START_TIMES[2]);
    setEndTime(initial?.endTime || END_TIMES[2]);
    setVenue(initial?.venue || "");
    setClassType(initial?.classType || "");
    setInstructor(initial?.instructor || "");
    setNotes(initial?.notes || "");
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;

    const q = courseSearch.trim();
    if (q.length < 2) {
      setCourseResults([]);
      setCourseSearching(false);
      return;
    }

    setCourseSearching(true);
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/courses?search=${encodeURIComponent(q)}`);
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.error || "Failed to search courses");
        setCourseResults((data || []).slice(0, 10));
      } catch (error: any) {
        setCourseResults([]);
      } finally {
        setCourseSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [courseSearch, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const endOptions = useMemo(() => {
    return END_TIMES.filter((t) => t > startTime);
  }, [startTime]);

  useEffect(() => {
    if (!endOptions.includes(endTime)) {
      setEndTime(endOptions[0] || endTime);
    }
  }, [endOptions, endTime]);

  const title = initial ? "Edit class" : "Add class";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!courseId) {
      showToast("warning", "Select a course first");
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
      semester,
      courseId,
      dayOfWeek,
      startTime,
      endTime,
      venue: venue.trim() || undefined,
      classType: classType.trim() || undefined,
      instructor: instructor.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const selectCourse = (course: CourseOption) => {
    setCourseId(course.id);
    setCourseLabel(`${course.code} — ${course.name}`);
    setCourseSearch("");
    setCourseResults([]);
  };

  return (
    <AnimatePresence>
      {open && (
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
                  Semester {semester} • {initial ? "Update details" : "Create a new entry"}
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

                {courseLabel ? (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-background-secondary border border-border">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{courseLabel}</p>
                      <p className="text-xs text-foreground-secondary mt-0.5">Tap to change course</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCourseLabel("");
                        setCourseId("");
                        setCourseSearch("");
                        setCourseResults([]);
                      }}
                      className="shrink-0 px-3 py-2 rounded-lg bg-surface hover:bg-surface-hover border border-border text-sm font-medium"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-secondary" />
                    <input
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      placeholder="Search by course code or name…"
                      className="w-full pl-10 pr-10 py-3 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-4 focus:ring-primary/15"
                    />
                    {courseSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-secondary animate-spin" />
                    )}

                    {courseResults.length > 0 && (
                      <div className="absolute z-10 mt-2 w-full rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
                        <div className="max-h-64 overflow-y-auto divide-y divide-border">
                          {courseResults.map((course) => (
                            <button
                              key={course.id}
                              type="button"
                              onClick={() => selectCourse(course)}
                              className="w-full text-left px-4 py-3 hover:bg-surface-hover transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-mono text-sm font-semibold text-primary">{course.code}</p>
                                  <p className="text-sm text-foreground truncate">{course.name}</p>
                                  {course.department && (
                                    <p className="text-xs text-foreground-secondary mt-0.5">{course.department}</p>
                                  )}
                                </div>
                                <span className="text-xs font-semibold text-foreground-secondary shrink-0">
                                  {course.credits} cr
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    onChange={(e) => setStartTime(e.target.value)}
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
                  <label className="block text-sm font-medium text-foreground mb-2">Class Type (optional)</label>
                  <input
                    value={classType}
                    onChange={(e) => setClassType(e.target.value)}
                    placeholder="Lecture / Lab / Tutorial"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:ring-4 focus:ring-primary/15"
                  />
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

              {!initial && (
                <p className="text-xs text-foreground-secondary">
                  Tip: You can tap a class in Week View to quickly edit it.
                </p>
              )}
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
