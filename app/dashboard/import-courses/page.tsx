"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Circle,
  ChevronDown,
  ChevronUp,
  Upload,
  Info,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import { getAllDefaultCourses, getDefaultCurriculum, DefaultCourse } from "@/lib/defaultCurriculum";

interface SelectedCourse extends DefaultCourse {
  selected: boolean;
  grade?: string;
}

export default function ImportCoursesPage() {
  const [branch, setBranch] = useState("CSE");
  const [geSubBranch, setGeSubBranch] = useState("GERAI");
  const [currentSemester, setCurrentSemester] = useState(6);
  const [courses, setCourses] = useState<SelectedCourse[]>([]);
  const [expandedSemesters, setExpandedSemesters] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadUserSettings();
  }, []);

  useEffect(() => {
    loadDefaultCourses();
  }, [branch, geSubBranch, currentSemester]);

  const loadUserSettings = async () => {
    try {
      const res = await fetch("/api/user/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.branch) setBranch(data.branch);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const loadDefaultCourses = () => {
    const effectiveBranch = branch === "GE" ? geSubBranch : branch;
    const defaultCourses = getAllDefaultCourses(effectiveBranch, currentSemester);
    // ICB basket + mixed-sem courses start unchecked — user must pick manually
    const MANUAL_PICK_CODES = ["IC140", "IC102P", "IC181"];
    // ISTP/MTP courses are auto-selected for semester 6+ (all branches have them)
    const ISTP_MTP_CODES = ["DP 301P", "DP 498P", "DP 499P"];
    const coursesWithSelection = defaultCourses.map((course) => ({
      ...course,
      selected: (course.category !== "ICB" && !MANUAL_PICK_CODES.includes(course.code)) || ISTP_MTP_CODES.includes(course.code),
    }));
    setCourses(coursesWithSelection);
  };

  const toggleSemester = (sem: number) => {
    if (expandedSemesters.includes(sem)) {
      setExpandedSemesters(expandedSemesters.filter((s) => s !== sem));
    } else {
      setExpandedSemesters([...expandedSemesters, sem]);
    }
  };

  const toggleCourse = (code: string, semester: number) => {
    setCourses((prev) => {
      const clicked = prev.find((c) => c.code === code && c.semester === semester);
      if (!clicked) return prev;
      const nowSelected = !clicked.selected;

      return prev.map((c) => {
        // Toggle the clicked course itself
        if (c.code === code && c.semester === semester) {
          return { ...c, selected: nowSelected };
        }

        if (nowSelected) {
          // IC140/IC102P/IC181: selecting in one semester deselects the same course in the other
          if (
            ["IC140", "IC102P", "IC181"].includes(code) &&
            c.code === code &&
            c.semester !== semester
          ) {
            return { ...c, selected: false };
          }

          // ICB basket: selecting one deselects all other ICB courses in the SAME semester
          if (clicked.category === "ICB" && c.category === "ICB" && c.semester === semester) {
            return { ...c, selected: false };
          }

          // IC140 ↔ IC102P pairing: always in opposite semesters
          if (code === "IC140" || code === "IC102P") {
            const paired = code === "IC140" ? "IC102P" : "IC140";
            // Auto-select paired course in the OTHER semester
            if (c.code === paired && c.semester !== semester) return { ...c, selected: true };
            // Auto-deselect paired course in the SAME semester
            if (c.code === paired && c.semester === semester) return { ...c, selected: false };
          }
        }

        return c;
      });
    });
  };

  const toggleAllInSemester = (sem: number) => {
    const semCourses = courses.filter((c) => c.semester === sem);
    const allSelected = semCourses.every((c) => c.selected);
    
    setCourses(
      courses.map((c) =>
        c.semester === sem ? { ...c, selected: !allSelected } : c
      )
    );
  };

  const updateGrade = (code: string, grade: string) => {
    setCourses(
      courses.map((c) => (c.code === code ? { ...c, grade } : c))
    );
  };

  const handleReset = async () => {
    if (!confirm("Are you sure? This will delete ALL your enrolled courses.")) return;
    setResetting(true);
    try {
      const res = await fetch("/api/enrollments", { method: "DELETE" });
      if (res.ok) {
        alert("All courses deleted. You can now re-import.");
      } else {
        alert("Failed to delete courses.");
      }
    } catch {
      alert("An error occurred.");
    } finally {
      setResetting(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const selectedCourses = courses.filter((c) => c.selected);
      
      const enrollments = selectedCourses.map((course) => ({
        courseCode: course.code,
        semester: course.semester,
        courseType: course.category,
        grade: course.grade || undefined,
      }));

      const res = await fetch("/api/enrollments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollments, currentSemester }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        alert("Failed to import courses. Please try again.");
      }
    } catch (error) {
      console.error("Failed to import courses:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Courses Imported Successfully!</h2>
          <p className="text-foreground-secondary mb-6">
            Your courses have been added to your profile. You can now view them in My Courses.
          </p>
          <a
            href="/dashboard/courses"
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all inline-block"
          >
            View Courses
          </a>
        </motion.div>
      </div>
    );
  }

  const semesterGroups: Record<number, SelectedCourse[]> = {};
  courses.forEach((course) => {
    if (!semesterGroups[course.semester]) {
      semesterGroups[course.semester] = [];
    }
    semesterGroups[course.semester].push(course);
  });

  const selectedCount = courses.filter((c) => c.selected).length;
  const totalCredits = courses
    .filter((c) => c.selected)
    .reduce((sum, c) => sum + c.credits, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Import Your Courses
          </h1>
          <p className="text-foreground-secondary mt-2">
            Select courses you've completed from semesters 1-{currentSemester}
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Reset All
        </button>
      </div>

      {/* Configuration */}
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-6 rounded-xl border border-blue-500/20">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-600" />
          Your Configuration
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium mb-2">Branch</label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={branch !== ""}
              className="w-full px-3 py-2 rounded-lg border bg-background disabled:opacity-60 disabled:cursor-not-allowed"
              title={branch ? "Branch cannot be changed after selection" : ""}
            >
              <option value="CSE">CSE</option>
              <option value="DSE">DSE</option>
              <option value="EE">EE</option>
              <option value="ME">ME</option>
              <option value="CE">CE</option>
              <option value="BE">BE</option>
              <option value="EP">EP</option>
              <option value="MNC">MNC</option>
              <option value="MSE">MSE</option>
              <option value="GE">GE</option>
              <option value="MEVLSI">MEVLSI</option>
              <option value="BSCS">BSCS (B.S.)</option>
            </select>
            {branch && (
              <p className="text-xs text-foreground-secondary mt-1">
                ℹ️ Branch is locked and cannot be changed
              </p>
            )}
          </div>
          {branch === "GE" && (
            <div>
              <label className="block text-sm font-medium mb-2">GE Sub-Branch</label>
              <select
                value={geSubBranch}
                onChange={(e) => setGeSubBranch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              >
                <option value="GERAI">Robotics &amp; AI</option>
                <option value="GECE">Communication Engineering</option>
                <option value="GEMECH">Mechatronics</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-2">Current Semester</label>
            <select
              value={currentSemester}
              onChange={(e) => setCurrentSemester(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border bg-background"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={sem}>
                  Semester {sem}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadDefaultCourses}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reload Courses
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="text-sm text-foreground-secondary mb-1">Selected Courses</div>
          <div className="text-3xl font-bold text-blue-600">{selectedCount}</div>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="text-sm text-foreground-secondary mb-1">Total Credits</div>
          <div className="text-3xl font-bold text-purple-600">{totalCredits}</div>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="text-sm text-foreground-secondary mb-1">Semesters</div>
          <div className="text-3xl font-bold text-pink-600">1-{currentSemester}</div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex gap-3">
        <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-yellow-900 dark:text-yellow-100">
            These are the standard courses for {branch} branch
          </p>
          <p className="text-yellow-800 dark:text-yellow-200 mt-1">
            Uncheck any courses you haven't taken. You can add grades optionally. Additional courses can be added later from "My Courses" page.
          </p>
          <p className="text-yellow-800 dark:text-yellow-200 mt-2">
            Selecting IC140 in a semester auto-checks IC102P in the other (they always pair across semesters). IC181 is semester-exclusive. IC Basket courses allow only one selection per semester.
          </p>
        </div>
      </div>

      {/* Semester-wise Courses */}
      <div className="space-y-4">
        {Object.keys(semesterGroups)
          .map(Number)
          .sort((a, b) => a - b)
          .map((sem) => {
            const semCourses = semesterGroups[sem];
            const selectedInSem = semCourses.filter((c) => c.selected).length;
            const creditsInSem = semCourses
              .filter((c) => c.selected)
              .reduce((sum, c) => sum + c.credits, 0);
            const isExpanded = expandedSemesters.includes(sem);

            return (
              <div key={sem} className="bg-surface rounded-xl border border-border overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-surface-hover transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  onClick={() => toggleSemester(sem)}
                >
                  <div className="flex items-start sm:items-center gap-4 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllInSemester(sem);
                      }}
                      className="p-1 hover:bg-surface-hover rounded"
                    >
                      {semCourses.every((c) => c.selected) ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : semCourses.some((c) => c.selected) ? (
                        <Circle className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-foreground-secondary" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg">Semester {sem}</h3>
                      <p className="text-sm text-foreground-secondary">
                        {selectedInSem} of {semCourses.length} courses • {creditsInSem} credits
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-foreground-secondary" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-foreground-secondary" />
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-2">
                    {/* ICB basket header — shown once before first basket course */}
                    {semCourses.some((c) => c.category === "ICB") && (
                      <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide px-1 pt-1">
                        IC Basket — choose exactly one ↓
                      </p>
                    )}
                    {semCourses.map((course) => (
                      <div
                        key={`${course.code}-${course.semester}`}
                        className={`p-4 rounded-lg border transition-all ${
                          course.selected
                            ? course.category === "ICB"
                              ? "bg-orange-500/5 border-orange-500/40"
                              : "bg-blue-500/5 border-blue-500/20"
                            : "bg-background-secondary/60 border-border"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                          <button
                            onClick={() => toggleCourse(course.code, course.semester)}
                            className="mt-1"
                          >
                            {course.selected ? (
                              <CheckCircle className="h-5 w-5 text-blue-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-foreground-secondary" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="font-mono text-sm font-semibold text-blue-600">
                                {course.code}
                              </span>
                              <span className="text-sm text-foreground">{course.name}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                course.category === "ICB"
                                  ? "bg-orange-500/10 text-orange-600"
                                  : "bg-purple-500/10 text-purple-600"
                              }`}>
                                {course.category === "ICB" ? "IC Basket" : course.category}
                              </span>
                              <span className="text-xs text-foreground-secondary">
                                {course.credits} credits
                              </span>
                            </div>
                          </div>
                          {course.selected && (
                            <div className="w-full sm:w-32 sm:shrink-0">
                              <select
                                value={course.grade || ""}
                                onChange={(e) => updateGrade(course.code, e.target.value)}
                                className="w-full px-2 py-1 text-sm rounded-lg border bg-background"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">Grade</option>
                                <option value="A">A (10)</option>
                                <option value="A-">A- (9)</option>
                                <option value="B">B (8)</option>
                                <option value="B-">B- (7)</option>
                                <option value="C">C (6)</option>
                                <option value="C-">C- (5)</option>
                                <option value="D">D (4)</option>
                                <option value="P">P (Pass)</option>
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Submit Button */}
      <div className="sticky bottom-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-4 sm:p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-white">
            <p className="text-sm opacity-90">Ready to import</p>
            <p className="font-bold text-lg">
              {selectedCount} courses • {totalCredits} credits
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedCount === 0}
            className="w-full sm:w-auto px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                Import Courses
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
