"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Search,
  Filter,
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  X,
  Award,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";

interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  department: string;
  level: number;
  description?: string;
  offeredInFall: boolean;
  offeredInSpring: boolean;
  offeredInSummer: boolean;
}

interface Enrollment {
  id: string;
  semester: number;
  year: number;
  term: string;
  status: string;
  grade?: string;
  courseId: string;
  course: Course;
}

export default function CoursesPage() {
  const [tab, setTab] = useState<"my-courses" | "catalog">("my-courses");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchEnrollments();
    fetchCourses();
  }, []);

  const fetchEnrollments = async () => {
    try {
      const res = await fetch("/api/enrollments");
      if (res.ok) {
        const data = await res.json();
        setEnrollments(data);
      }
    } catch (error) {
      console.error("Failed to fetch enrollments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/courses");
      if (res.ok) {
        const data = await res.json();
        setAllCourses(data);
      }
    } catch (error) {
      console.error("Failed to fetch courses:", error);
    }
  };

  const departments = Array.from(
    new Set(allCourses.map((c) => c.department))
  ).sort();

  const filteredCourses = allCourses.filter((course) => {
    const matchesSearch =
      course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === "all" || course.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const totalCredits = enrollments
    .filter((e) => e.status === "COMPLETED" && e.grade && e.grade !== "F")
    .reduce((sum, e) => sum + e.course.credits, 0);

  const inProgressCredits = enrollments
    .filter((e) => e.status === "IN_PROGRESS")
    .reduce((sum, e) => sum + e.course.credits, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 sm:w-64 sm:h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">My Courses</h1>
          <p className="text-white/90 text-sm sm:text-base">
            Browse your enrollments and explore the course catalog
          </p>
        </div>
      </div>

      {/* Animated Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="group relative overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5 will-change-transform">
          <div className="absolute top-0 right-0 w-20 h-20 sm:w-32 sm:h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <Award className="w-5 h-5 sm:w-8 sm:h-8 text-white/90" />
              <span className="text-xs sm:text-sm text-white/80 font-medium hidden sm:block">Completed</span>
            </div>
            <p className="text-2xl sm:text-4xl font-bold text-white">{totalCredits}</p>
            <p className="text-white/80 text-xs sm:text-sm mt-1">Credits Earned</p>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5 will-change-transform">
          <div className="absolute top-0 right-0 w-20 h-20 sm:w-32 sm:h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 sm:w-8 sm:h-8 text-white/90" />
              <span className="text-xs sm:text-sm text-white/80 font-medium hidden sm:block">Active</span>
            </div>
            <p className="text-2xl sm:text-4xl font-bold text-white">{inProgressCredits}</p>
            <p className="text-white/80 text-xs sm:text-sm mt-1">In Progress</p>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5 will-change-transform">
          <div className="absolute top-0 right-0 w-20 h-20 sm:w-32 sm:h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <BookOpen className="w-5 h-5 sm:w-8 sm:h-8 text-white/90" />
              <span className="text-xs sm:text-sm text-white/80 font-medium hidden sm:block">Total</span>
            </div>
            <p className="text-2xl sm:text-4xl font-bold text-white">{enrollments.length}</p>
            <p className="text-white/80 text-xs sm:text-sm mt-1">All Courses</p>
          </div>
        </div>
      </div>

      {/* Modern View Toggle */}
      <div className="flex gap-1 sm:gap-2 p-1 bg-surface rounded-xl border border-border shadow-sm w-full sm:w-fit">
        <button
          onClick={() => setView("enrolled")}
          className={`flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 ${
            view === "enrolled"
              ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/30"
              : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
          }`}
        >
          My Enrollments ({enrollments.length})
        </button>
        <button
          onClick={() => setView("catalog")}
          className={`flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 ${
            view === "catalog"
              ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/30"
              : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
          }`}
        >
          Course Catalog ({allCourses.length})
        </button>
      </div>

      {/* Content */}
      {view === "enrolled" ? (
        <div className="space-y-4">
          {enrollments.length === 0 ? (
            <div className="bg-surface rounded-lg border border-border p-8 text-center">
              <BookOpen className="w-12 h-12 text-foreground-secondary mx-auto mb-3" />
              <p className="text-foreground-secondary">No course enrollments found</p>
            </div>
          ) : (
            enrollments.map((enrollment) => (
              <button
                type="button"
                key={enrollment.id}
                onClick={() => setDetails({ course: enrollment.course, enrollment })}
                className="group relative overflow-hidden bg-surface rounded-xl border border-border p-6 hover:border-primary hover:shadow-xl transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                        {enrollment.course.code}
                      </h3>
                      <span className="px-3 py-1 bg-gradient-to-r from-primary/20 to-primary/10 text-primary text-sm font-semibold rounded-full border border-primary/20">
                        {enrollment.course.credits} Credits
                      </span>
                      <span
                        className={`px-3 py-1 text-sm font-semibold rounded-full ${
                          enrollment.status === "COMPLETED"
                            ? "bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-600 border border-green-500/30"
                            : enrollment.status === "IN_PROGRESS"
                            ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-600 border border-blue-500/30"
                            : "bg-gray-500/20 text-gray-600 border border-gray-500/30"
                        }`}
                      >
                        {enrollment.status}
                      </span>
                    </div>
                    <p className="text-lg text-foreground mb-2 font-medium">{enrollment.course.name}</p>
                    <div className="text-sm text-foreground-secondary flex flex-wrap items-center gap-2">
                      <span className="px-2 py-1 bg-surface-hover rounded">{enrollment.term} {enrollment.year}</span>
                      <span className="px-2 py-1 bg-surface-hover rounded">Semester {enrollment.semester}</span>
                      <span className="px-2 py-1 bg-surface-hover rounded">{enrollment.course.department}</span>
                    </div>
                  </div>
                  {enrollment.grade && (
                    <div className="self-start sm:self-auto sm:text-right">
                      <p className="text-sm text-foreground-secondary mb-1">Grade</p>
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg">
                        <p className="text-2xl sm:text-3xl font-bold text-white">{enrollment.grade}</p>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Modern Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-foreground-secondary group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Search courses by code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-surface border-2 border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground placeholder-foreground-secondary transition-all shadow-sm hover:shadow-md"
              />
            </div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-6 py-3 bg-surface border-2 border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground font-medium shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Course List */}
          <div className="space-y-3">
            {filteredCourses.length === 0 ? (
              <div className="bg-surface rounded-lg border border-border p-8 text-center">
                <Filter className="w-12 h-12 text-foreground-secondary mx-auto mb-3" />
                <p className="text-foreground-secondary">No courses found</p>
              </div>
            ) : (
              filteredCourses.map((course) => (
                <button
                  type="button"
                  key={course.id}
                  onClick={() => setDetails({ course })}
                  className="group relative overflow-hidden bg-surface rounded-xl border border-border p-4 sm:p-6 hover:border-primary hover:shadow-xl transition-all duration-300 text-left"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  <div className="relative z-10">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                        <h3 className="text-base sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                          {course.code}
                        </h3>
                        <span className="px-2 py-0.5 bg-gradient-to-r from-primary/20 to-primary/10 text-primary text-xs sm:text-sm font-semibold rounded-full border border-primary/20">
                          {course.credits} Cr
                        </span>
                        <span className="px-2 py-0.5 bg-gray-500/10 text-gray-600 text-xs sm:text-sm font-semibold rounded-full border border-gray-500/20">
                          L{course.level}
                        </span>
                      </div>
                      <p className="text-sm sm:text-base font-medium text-foreground mb-2 sm:mb-3">{course.name}</p>
                      {course.description && (
                        <p className="text-sm text-foreground-secondary mb-3 line-clamp-2">
                          {course.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="px-3 py-1 bg-surface-hover rounded-lg font-medium text-foreground">
                          {course.department}
                        </span>
                        <div className="flex gap-2">
                          {course.offeredInFall && (
                            <span className="px-2 py-1 bg-orange-500/10 text-orange-600 rounded-lg text-xs font-semibold">
                              Fall
                            </span>
                          )}
                          {course.offeredInSpring && (
                            <span className="px-2 py-1 bg-green-500/10 text-green-600 rounded-lg text-xs font-semibold">
                              Spring
                            </span>
                          )}
                          {course.offeredInSummer && (
                            <span className="px-2 py-1 bg-blue-500/10 text-blue-600 rounded-lg text-xs font-semibold">
                              Summer
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <CourseDetailsModal
        open={!!details}
        details={details}
        onClose={() => setDetails(null)}
        reducedMotion={reducedMotion}
        onCopyCode={async (code) => {
          try {
            await navigator.clipboard.writeText(code);
            showToast("success", "Course code copied");
          } catch {
            showToast("error", "Failed to copy");
          }
        }}
      />
    </div>
  );
}

function CourseDetailsModal({
  open,
  details,
  onClose,
  onCopyCode,
  reducedMotion,
}: {
  open: boolean;
  details: { course: Course; enrollment?: Enrollment } | null;
  onClose: () => void;
  onCopyCode: (code: string) => void | Promise<void>;
  reducedMotion: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const course = details?.course;
  const enrollment = details?.enrollment;

  return (
    <AnimatePresence>
      {open && course && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Course details"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close course details"
          />

          <motion.div
            initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative w-full sm:max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-4 sm:p-6 border-b border-border flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm font-semibold text-primary">{course.code}</p>
                  <span className="px-2 py-0.5 bg-primary/10 dark:bg-primary/20 text-primary text-xs font-semibold rounded-full border border-primary/20">
                    {course.credits} credits
                  </span>
                  <span className="px-2 py-0.5 bg-surface-hover text-foreground-secondary text-xs font-semibold rounded-full border border-border">
                    Level {course.level}
                  </span>
                </div>
                <h2 className="text-lg sm:text-2xl font-bold text-foreground mt-2 break-words">
                  {course.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-3 text-xs sm:text-sm text-foreground-secondary">
                  <span className="px-2 py-1 bg-background-secondary rounded-lg border border-border">
                    {course.department}
                  </span>
                  <span className="px-2 py-1 bg-background-secondary rounded-lg border border-border">
                    Offered:
                    <span className="ml-2 inline-flex gap-1">
                      {course.offeredInFall && <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-700 dark:text-orange-300">Fall</span>}
                      {course.offeredInSpring && <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-300">Spring</span>}
                      {course.offeredInSummer && <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">Summer</span>}
                      {!course.offeredInFall && !course.offeredInSpring && !course.offeredInSummer && (
                        <span className="px-2 py-0.5 rounded bg-surface-hover text-foreground-secondary">TBA</span>
                      )}
                    </span>
                  </span>
                </div>
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

            <div className="p-4 sm:p-6 space-y-4">
              {enrollment && (
                <div className="rounded-xl border border-border bg-background-secondary/60 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Your enrollment</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-1 rounded-lg bg-surface border border-border text-foreground-secondary">
                        {enrollment.term} {enrollment.year}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-surface border border-border text-foreground-secondary">
                        Semester {enrollment.semester}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 font-semibold">
                        {enrollment.status}
                      </span>
                      {enrollment.grade && (
                        <span className="px-2 py-1 rounded-lg bg-surface border border-border text-foreground-secondary">
                          Grade: <span className="font-semibold text-foreground">{enrollment.grade}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {course.description ? (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">About</h3>
                  <p className="text-sm text-foreground-secondary leading-relaxed whitespace-pre-wrap">
                    {course.description}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-surface-hover p-4">
                  <p className="text-sm text-foreground-secondary">
                    No description available yet.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onCopyCode(course.code)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-foreground font-medium transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy code
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
