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
} from "lucide-react";
import { getAllDefaultCourses, getDefaultCurriculum, DefaultCourse } from "@/lib/defaultCurriculum";

interface SelectedCourse extends DefaultCourse {
  selected: boolean;
  grade?: string;
}

export default function ImportCoursesPage() {
  const [branch, setBranch] = useState("CSE");
  const [currentSemester, setCurrentSemester] = useState(6);
  const [courses, setCourses] = useState<SelectedCourse[]>([]);
  const [expandedSemesters, setExpandedSemesters] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadUserSettings();
  }, []);

  useEffect(() => {
    loadDefaultCourses();
  }, [branch, currentSemester]);

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
    const defaultCourses = getAllDefaultCourses(branch, currentSemester);
    const coursesWithSelection = defaultCourses.map((course) => ({
      ...course,
      selected: true, // By default all are selected
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

  const toggleCourse = (code: string) => {
    setCourses(
      courses.map((c) => (c.code === code ? { ...c, selected: !c.selected } : c))
    );
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
        body: JSON.stringify({ enrollments }),
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
          <p className="text-muted-foreground mb-6">
            Your courses have been added to your profile. You can now view them in My Courses.
          </p>
          <a
            href="/dashboard/my-courses"
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all inline-block"
          >
            View My Courses
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
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Import Your Courses
        </h1>
        <p className="text-muted-foreground mt-2">
          Select courses you've completed from semesters 1-{currentSemester}
        </p>
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
              className="w-full px-3 py-2 rounded-lg border bg-background"
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
          </div>
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
        <div className="bg-card p-4 rounded-xl border">
          <div className="text-sm text-muted-foreground mb-1">Selected Courses</div>
          <div className="text-3xl font-bold text-blue-600">{selectedCount}</div>
        </div>
        <div className="bg-card p-4 rounded-xl border">
          <div className="text-sm text-muted-foreground mb-1">Total Credits</div>
          <div className="text-3xl font-bold text-purple-600">{totalCredits}</div>
        </div>
        <div className="bg-card p-4 rounded-xl border">
          <div className="text-sm text-muted-foreground mb-1">Semesters</div>
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
              <div key={sem} className="bg-card rounded-xl border overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-accent/50 transition-colors flex items-center justify-between"
                  onClick={() => toggleSemester(sem)}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllInSemester(sem);
                      }}
                      className="p-1 hover:bg-accent rounded"
                    >
                      {semCourses.every((c) => c.selected) ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : semCourses.some((c) => c.selected) ? (
                        <Circle className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <div>
                      <h3 className="font-semibold text-lg">Semester {sem}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedInSem} of {semCourses.length} courses • {creditsInSem} credits
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t p-4 space-y-2">
                    {semCourses.map((course) => (
                      <div
                        key={course.code}
                        className={`p-4 rounded-lg border transition-all ${
                          course.selected
                            ? "bg-blue-500/5 border-blue-500/20"
                            : "bg-accent/30 border-transparent"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleCourse(course.code)}
                            className="mt-1"
                          >
                            {course.selected ? (
                              <CheckCircle className="h-5 w-5 text-blue-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-mono text-sm font-semibold text-blue-600">
                                {course.code}
                              </span>
                              <span className="text-sm">{course.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs px-2 py-1 rounded-full bg-purple-500/10 text-purple-600">
                                {course.category}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {course.credits} credits
                              </span>
                            </div>
                          </div>
                          {course.selected && (
                            <div className="w-32">
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
      <div className="sticky bottom-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="text-white">
            <p className="text-sm opacity-90">Ready to import</p>
            <p className="font-bold text-lg">
              {selectedCount} courses • {totalCredits} credits
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedCount === 0}
            className="px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
