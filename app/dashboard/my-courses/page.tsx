"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Info,
  Lightbulb,
  X,
} from "lucide-react";

interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  semester: number;
  category: string;
  grade?: string;
}

interface Preferences {
  doingMTP: boolean;
  doingISTP: boolean;
  branch: string;
}

const CATEGORIES = {
  IC: "Institute Core",
  ICB: "IC Basket",
  HSS: "HSS/IKS",
  DC: "Discipline Core",
  DE: "Discipline Elective",
  FE: "Free Elective",
  MTP: "Major Tech Project",
  ISTP: "ISTP",
};

const BRANCH_REQUIREMENTS: Record<string, { dc: number; de: number }> = {
  CSE: { dc: 38, de: 28 },
  DSE: { dc: 33, de: 33 },
  EE: { dc: 52, de: 20 },
  ME: { dc: 50, de: 16 },
  CE: { dc: 49, de: 17 },
  BE: { dc: 42, de: 24 },
  EP: { dc: 37, de: 29 },
  MnC: { dc: 51, de: 15 },
  MSE: { dc: 45, de: 21 },
  GE: { dc: 36, de: 30 },
  VLSI: { dc: 54, de: 12 },
  CS: { dc: 59, de: 23 }, // B.S. Chemical Sciences
};

export default function MyCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [preferences, setPreferences] = useState<Preferences>({
    doingMTP: true,
    doingISTP: true,
    branch: "CSE",
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentSemester, setCurrentSemester] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [enrollmentsRes, settingsRes] = await Promise.all([
        fetch("/api/enrollments"),
        fetch("/api/user/settings"),
      ]);
      
      if (enrollmentsRes.ok) {
        const data = await enrollmentsRes.json();
        setCourses(data.map((e: any) => ({
          id: e.id,
          code: e.course.code,
          name: e.course.name,
          credits: e.course.credits,
          semester: e.semester || 1,
          category: e.courseType || "FE",
          grade: e.grade,
        })));
      }

      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setPreferences({
          doingMTP: settings.doingMTP ?? true,
          doingISTP: settings.doingISTP ?? true,
          branch: settings.branch || "CSE",
        });
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (newPrefs: Preferences) => {
    try {
      await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrefs),
      });
      setPreferences(newPrefs);
    } catch (error) {
      console.error("Failed to save preferences:", error);
    }
  };

  const calculateProgress = () => {
    const totals = {
      IC: 0,
      ICB: 0,
      HSS: 0,
      DC: 0,
      DE: 0,
      FE: 0,
      MTP: 0,
      ISTP: 0,
    };

    courses.forEach((course) => {
      if (course.category in totals) {
        totals[course.category as keyof typeof totals] += course.credits;
      }
    });

    const requirements = {
      IC: 39,
      ICB: 6,
      HSS: 15, // 12 HSS + 3 IKS
      DC: BRANCH_REQUIREMENTS[preferences.branch]?.dc || 38,
      DE: BRANCH_REQUIREMENTS[preferences.branch]?.de || 28,
      FE: 22,
      MTP: 0,
      ISTP: 0,
    };

    // Adjust for MTP/ISTP
    if (preferences.doingMTP) {
      requirements.MTP = 8;
    } else {
      requirements.DE += 8;
    }

    if (preferences.doingISTP) {
      requirements.ISTP = 4;
    } else {
      requirements.FE += 4;
    }

    // Calculate what's remaining
    const remaining: Record<string, number> = {};
    Object.keys(requirements).forEach((key) => {
      const req = requirements[key as keyof typeof requirements];
      const done = totals[key as keyof typeof totals];
      remaining[key] = Math.max(0, req - done);
    });

    const totalRequired = Object.values(requirements).reduce((a, b) => a + b, 0);
    const totalCompleted = Object.values(totals).reduce((a, b) => a + b, 0);

    return { totals, requirements, remaining, totalRequired, totalCompleted };
  };

  const progress = calculateProgress();

  const getRecommendations = () => {
    const recs: string[] = [];
    const sem = Math.max(...courses.map((c) => c.semester), 1);

    // Early semesters (1-4)
    if (sem <= 4) {
      if (progress.remaining.IC > 0) {
        recs.push("🎯 Focus on completing Institute Core courses first");
      }
      if (progress.remaining.DC > 20) {
        recs.push("📚 Start taking Discipline Core courses");
      }
    }

    // Mid semesters (5-6)
    if (sem >= 5 && sem <= 6) {
      if (progress.remaining.DE > 15) {
        recs.push("💡 Prioritize Discipline Electives - take them before final semesters");
      }
      if (progress.remaining.HSS > 6) {
        recs.push("✍️ Complete HSS courses now - they fill up in later semesters");
      }
      if (progress.totals.FE > 10) {
        recs.push("⚠️ You've taken many Free Electives. Save FE slots for final semesters!");
      }
    }

    // Late semesters (7-8)
    if (sem >= 7) {
      recs.push("🎓 Use Free Electives to fill remaining requirements");
      if (progress.remaining.DE > 0) {
        recs.push("⚡ Complete pending Discipline Electives as priority");
      }
      if (preferences.doingMTP && sem === 7) {
        recs.push("📝 Register for MTP-1 (3 credits) this semester");
      }
      if (preferences.doingMTP && sem === 8) {
        recs.push("📝 Complete MTP-2 (5 credits) this semester");
      }
    }

    // ISTP reminder
    if (preferences.doingISTP && sem === 6) {
      recs.push("🔧 ISTP (4 credits) is typically done in 6th semester");
    }

    return recs;
  };

  const recommendations = getRecommendations();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            My Courses
          </h1>
          <p className="text-muted-foreground mt-2">
            Track your course completion and manage your degree progress
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Course
        </button>
      </div>

      {/* Preferences */}
      <PreferencesSection
        preferences={preferences}
        onUpdate={savePreferences}
      />

      {/* Progress Overview */}
      <ProgressOverview progress={progress} />

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <RecommendationsCard recommendations={recommendations} />
      )}

      {/* Semester-wise Courses */}
      <SemesterCourses
        courses={courses}
        onDeleteCourse={async (id) => {
          try {
            await fetch(`/api/enrollments/${id}`, { method: "DELETE" });
            setCourses(courses.filter((c) => c.id !== id));
          } catch (error) {
            console.error("Failed to delete course:", error);
          }
        }}
      />

      {/* Add Course Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddCourseModal
            onClose={() => setShowAddModal(false)}
            onAdd={(course) => {
              setCourses([...courses, course]);
              setShowAddModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PreferencesSection({
  preferences,
  onUpdate,
}: {
  preferences: Preferences;
  onUpdate: (prefs: Preferences) => void;
}) {
  return (
    <div className="bg-card p-6 rounded-xl border">
      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
        <Info className="h-5 w-5 text-blue-600" />
        Academic Preferences
      </h3>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium mb-2">Branch</label>
          <select
            value={preferences.branch}
            onChange={(e) => onUpdate({ ...preferences, branch: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border bg-background"
          >
            {Object.keys(BRANCH_REQUIREMENTS).map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="mtp"
            checked={preferences.doingMTP}
            onChange={(e) => onUpdate({ ...preferences, doingMTP: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <label htmlFor="mtp" className="text-sm font-medium">
            Doing MTP (8 credits)
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="istp"
            checked={preferences.doingISTP}
            onChange={(e) => onUpdate({ ...preferences, doingISTP: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <label htmlFor="istp" className="text-sm font-medium">
            Doing ISTP (4 credits)
          </label>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        {!preferences.doingMTP && "Not doing MTP will add 8 credits to DE requirements. "}
        {!preferences.doingISTP && "Not doing ISTP will add 4 credits to FE requirements."}
      </p>
    </div>
  );
}

function ProgressOverview({ progress }: { progress: any }) {
  const percentage = Math.round(
    (progress.totalCompleted / progress.totalRequired) * 100
  );

  const categories = [
    { key: "IC", label: "Institute Core", color: "blue" },
    { key: "ICB", label: "IC Basket", color: "cyan" },
    { key: "HSS", label: "HSS/IKS", color: "green" },
    { key: "DC", label: "Discipline Core", color: "purple" },
    { key: "DE", label: "Discipline Elective", color: "pink" },
    { key: "FE", label: "Free Elective", color: "orange" },
    { key: "MTP", label: "MTP", color: "red" },
    { key: "ISTP", label: "ISTP", color: "yellow" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-6 rounded-xl border border-blue-500/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-xl">Overall Progress</h3>
          <span className="text-3xl font-bold text-blue-600">{percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
          <div
            className="bg-gradient-to-r from-blue-600 to-purple-600 h-4 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {progress.totalCompleted} of {progress.totalRequired} credits completed
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {categories.map((cat) => {
          const required = progress.requirements[cat.key];
          const completed = progress.totals[cat.key];
          const remaining = progress.remaining[cat.key];
          
          if (required === 0) return null;

          return (
            <div
              key={cat.key}
              className="bg-card p-4 rounded-lg border hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-muted-foreground">
                  {cat.label}
                </span>
                {remaining === 0 ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{completed}</span>
                <span className="text-sm text-muted-foreground">/ {required}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className={`bg-${cat.color}-600 h-2 rounded-full transition-all`}
                  style={{ width: `${Math.min((completed / required) * 100, 100)}%` }}
                />
              </div>
              {remaining > 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  {remaining} credits remaining
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecommendationsCard({ recommendations }: { recommendations: string[] }) {
  return (
    <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 p-6 rounded-xl border border-yellow-500/20">
      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-yellow-600" />
        Smart Recommendations
      </h3>
      <div className="space-y-2">
        {recommendations.map((rec, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-white/50 dark:bg-black/20">
            <TrendingUp className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm">{rec}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SemesterCourses({
  courses,
  onDeleteCourse,
}: {
  courses: Course[];
  onDeleteCourse: (id: string) => void;
}) {
  const semesterGroups: Record<number, Course[]> = {};
  courses.forEach((course) => {
    if (!semesterGroups[course.semester]) {
      semesterGroups[course.semester] = [];
    }
    semesterGroups[course.semester].push(course);
  });

  const semesters = Object.keys(semesterGroups)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-xl">Courses by Semester</h3>
      {semesters.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No courses added yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Click "Add Course" to start tracking your progress
          </p>
        </div>
      ) : (
        semesters.map((sem) => (
          <div key={sem} className="bg-card p-6 rounded-xl border">
            <h4 className="font-semibold text-lg mb-4">
              Semester {sem} ({semesterGroups[sem].reduce((sum, c) => sum + c.credits, 0)}{" "}
              credits)
            </h4>
            <div className="space-y-2">
              {semesterGroups[sem].map((course) => (
                <div
                  key={course.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-blue-600 font-semibold">
                        {course.code}
                      </span>
                      <span className="text-sm">{course.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs px-2 py-1 rounded-full bg-purple-500/10 text-purple-600">
                        {CATEGORIES[course.category as keyof typeof CATEGORIES]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {course.credits} credits
                      </span>
                      {course.grade && (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600">
                          Grade: {course.grade}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteCourse(course.id)}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function AddCourseModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (course: Course) => void;
}) {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    credits: 3,
    semester: 1,
    category: "FE",
    grade: "",
  });
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const res = await fetch("/api/courses");
      if (res.ok) {
        const data = await res.json();
        setAvailableCourses(data.courses || []);
      }
    } catch (error) {
      console.error("Failed to load courses:", error);
    }
  };

  const filteredCourses = availableCourses.filter(
    (c) =>
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseCode: formData.code,
          semester: formData.semester,
          courseType: formData.category,
          grade: formData.grade || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onAdd({
          id: data.id,
          code: formData.code,
          name: formData.name,
          credits: formData.credits,
          semester: formData.semester,
          category: formData.category,
          grade: formData.grade,
        });
      }
    } catch (error) {
      console.error("Failed to add course:", error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card p-6 rounded-xl border max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Add Course</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Search & Select Course
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code or name..."
              className="w-full px-3 py-2 rounded-lg border bg-background"
            />
            {searchQuery && (
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
                {filteredCourses.slice(0, 10).map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        code: course.code,
                        name: course.name,
                        credits: course.credits,
                      });
                      setSearchQuery("");
                    }}
                    className="w-full text-left p-3 hover:bg-accent transition-colors"
                  >
                    <div className="font-mono text-sm text-blue-600">{course.code}</div>
                    <div className="text-sm">{course.name}</div>
                    <div className="text-xs text-muted-foreground">{course.credits} credits</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-2">Course Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Credits</label>
              <input
                type="number"
                value={formData.credits}
                onChange={(e) =>
                  setFormData({ ...formData, credits: Number(e.target.value) })
                }
                required
                min="1"
                max="10"
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Course Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border bg-background"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-2">Semester</label>
              <select
                value={formData.semester}
                onChange={(e) =>
                  setFormData({ ...formData, semester: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg border bg-background"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <option key={sem} value={sem}>
                    Semester {sem}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              >
                {Object.entries(CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Grade (Optional)
            </label>
            <select
              value={formData.grade}
              onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border bg-background"
            >
              <option value="">Not graded yet</option>
              <option value="A">A (10)</option>
              <option value="A-">A- (9)</option>
              <option value="B">B (8)</option>
              <option value="B-">B- (7)</option>
              <option value="C">C (6)</option>
              <option value="C-">C- (5)</option>
              <option value="D">D (4)</option>
              <option value="F">F (0)</option>
              <option value="P">P (Pass)</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
            >
              Add Course
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
