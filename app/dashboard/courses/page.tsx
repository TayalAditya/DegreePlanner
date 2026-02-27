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
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { formatCourseCode } from "@/lib/utils";

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
  isPassFailEligible?: boolean;
}

interface Enrollment {
  id: string;
  semester: number;
  year: number;
  term: string;
  status: string;
  grade?: string;
  courseType?: "CORE" | "DE" | "FREE_ELECTIVE" | "PE" | "MTP" | "ISTP";
  courseId: string;
  course: Course & {
    branchMappings?: {
      courseCategory: string;
      branch: string;
    }[];
  };
}

interface User {
  branch?: string;
  totalPassFailCredits?: number;
  batch?: number | null;
  enrollmentId?: string | null;
}

// Color scheme for each category
const categoryColors = {
  IC: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", bar: "bg-blue-500" },
  IC_BASKET: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", bar: "bg-cyan-500" },
  DC: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", bar: "bg-purple-500" },
  DE: { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400", bar: "bg-pink-500" },
  FE: { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", bar: "bg-green-500" },
  HSS: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", bar: "bg-orange-500" },
  IKS: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  MTP: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", bar: "bg-red-500" },
  ISTP: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", bar: "bg-teal-500" },
};

export default function CoursesPage() {
  const [tab, setTab] = useState<"my-courses" | "catalog">("my-courses");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [addingCourse, setAddingCourse] = useState<Course | null>(null);
  const [semester, setSemester] = useState<string>("");
  const [grade, setGrade] = useState<string>("");
  const [courseType, setCourseType] = useState<string>("AUTO");
  const [isPassFail, setIsPassFail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [enrollmentsRes, coursesRes, userRes] = await Promise.all([
        fetch("/api/enrollments"),
        fetch("/api/courses"),
        fetch("/api/user/settings"),
      ]);

      if (enrollmentsRes.ok) {
        const data = await enrollmentsRes.json();
        setEnrollments(data);
      }

      if (coursesRes.ok) {
        const data = await coursesRes.json();
        setAllCourses(data);
      }

      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      showToast("error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const departments = Array.from(
    new Set(allCourses.map((c) => c.department))
  ).sort();

  const codePattern = /^[A-Z]{2}-\d{3}$/;
  const allowedNormalized = new Set(["DP301P", "DP498P", "DP499P"]);
  const normalize = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const filteredCourses = allCourses.filter((course) => {
    if (!codePattern.test(course.code) && !allowedNormalized.has(normalize(course.code))) return false;
    const matchesSearch =
      course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === "all" || course.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
  const availableCourses = filteredCourses.filter(
    (c) => !enrolledCourseIds.has(c.id)
  );

  const totalCreditsCompleted = enrollments
    .filter((e) => e.status === "COMPLETED" && (!e.grade || e.grade !== "F"))
    .reduce((sum, e) => sum + e.course.credits, 0);

  const totalCreditsInProgress = enrollments
    .filter((e) => e.status === "IN_PROGRESS" || e.status === "ENROLLED")
    .reduce((sum, e) => sum + e.course.credits, 0);

  const maxPassFailCredits = 9;
  const passFailUsed = user?.totalPassFailCredits ?? 0;
  const passFailRemaining = Math.max(0, maxPassFailCredits - passFailUsed);

  const ICB1_CODES = new Set([
    "IC131",
    "IC136",
    "IC230",
  ]);

  const ICB2_CODES = new Set([
    "IC121",
    "IC240",
    "IC241",
    "IC253",
  ]);

  // Calculate credits by category
  const getCourseCategory = (enrollment: Enrollment): string => {
    // First try to get from branchMappings if available
    if (enrollment.course.branchMappings && enrollment.course.branchMappings.length > 0 && user?.branch) {
      const mapping = enrollment.course.branchMappings.find(
        (m) => m.branch === user.branch
      ) || (user.branch === "GE"
        ? enrollment.course.branchMappings.find((m) => m.branch.startsWith("GE"))
        : undefined);

      if (mapping) {
        return mapping.courseCategory;
      }
    }

    // Fallback to code analysis
    const code = enrollment.course.code.toUpperCase();
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);

    // Branch-specific basket rules
    if (user?.branch) {
      // Sem 1: ICB1 is compulsory. If ICB2 taken → FE
      if (enrollment.semester === 1 && isICB2) return "FE";
      
      // Sem 2: Branch-specific
      if (enrollment.semester === 2) {
        if (user.branch === "CSE") {
          // CSE Sem 2: IC253 (DSA) is compulsory. Other ICB2 → FE
          if (isICB2 && normalizedCode !== "IC253") return "FE";
        } else {
          // Other branches Sem 2: ICB2 is compulsory. If ICB1 taken → FE
          if (isICB1) return "FE";
        }
      }
    }

    if (isICB1 || isICB2) return "IC_BASKET";
    if (normalizedCode === "IC181") return "IKS";
    
    // Branch-specific course patterns
    if (user?.branch === "CSE" && code.startsWith("DS")) return "DE";
    if (user?.branch === "DSE" && code.startsWith("CS")) return "DE";
    
    if (normalizedCode.startsWith("IC")) return "IC";
    if (normalizedCode.startsWith("HS")) return "HSS";
    if (normalizedCode.startsWith("IKS") || normalizedCode.startsWith("IK")) return "IKS";
    if (normalizedCode.includes("MTP")) return "MTP";
    if (normalizedCode.includes("ISTP")) return "ISTP";

    // Fallback to courseType mapping
    switch (enrollment.courseType) {
      case "DE":
        return "DE";
      case "FREE_ELECTIVE":
      case "PE":
        return "FE";
      case "MTP":
        return "MTP";
      case "ISTP":
        return "ISTP";
      case "CORE":
      default:
        return "DC";
    }
  };

  const creditsByCategory: Record<string, number> = {
    IC: 0,
    IC_BASKET: 0,
    DC: 0,
    DE: 0,
    FE: 0,
    HSS: 0,
    IKS: 0,
    MTP: 0,
    ISTP: 0,
  };

  enrollments
    .filter((e) => e.status === "COMPLETED" && (!e.grade || e.grade !== "F"))
    .forEach((e) => {
      const category = getCourseCategory(e);
      if (category in creditsByCategory) {
        creditsByCategory[category] += e.course.credits;
      }
    });

  // Calculate HSS credits for smart type detection
  const hssCreditsCompleted = enrollments
    .filter((e) => e.course.code.startsWith("HS-") && e.status === "COMPLETED")
    .reduce((sum, e) => sum + e.course.credits, 0);

  const determineCourseType = (course: Course): string => {
    const code = course.code.toUpperCase();
    
    // HSS courses (HS-xxx)
    if (code.startsWith("HS-")) {
      // First 12 credits count as HSS/CORE, rest as FE
      if (hssCreditsCompleted < 12) {
        return "CORE";
      } else {
        return "FREE_ELECTIVE";
      }
    }
    
    // DC courses (Discipline Core) - starts with branch code
    if (code.startsWith("CS-") || code.startsWith("EE-") || 
        code.startsWith("ME-") || code.startsWith("CE-") ||
        code.match(/^[A-Z]{2,3}-[0-9]/)) {
      // Check if it's actually a DC course by looking at department
      if (course.department.includes("Computer") || 
          course.department.includes("Electrical") ||
          course.department.includes("Mechanical") ||
          course.department.includes("Civil")) {
        // Most parent discipline courses are DE (unless marked as core)
        return "DE";
      }
    }
    
    // Default to FE for other courses
    return "FREE_ELECTIVE";
  };

  const handleAddCourse = (course: Course) => {
    setAddingCourse(course);
    setSemester("");
    setGrade("");
    setCourseType("AUTO");
    setIsPassFail(false);
  };

  const inferBatchYear = () => {
    if (user?.batch && user.batch > 2000) return user.batch;
    if (user?.enrollmentId) {
      const match = user.enrollmentId.match(/B(\d{2})/i);
      if (match) return 2000 + parseInt(match[1], 10);
    }
    return new Date().getFullYear() - 3;
  };

  const submitEnrollment = async () => {
    if (!addingCourse || !semester) {
      showToast("error", "Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const semNum = parseInt(semester);
      const batchYear = inferBatchYear();
      const term = semNum % 2 === 1 ? "FALL" : "SPRING";
      
      // Calculate year based on semester
      // Sem 1-2: batch year, Sem 3-4: batch year + 1, Sem 5-6: batch year + 2, etc.
      const yearOffset = Math.floor((semNum - 1) / 2);
      const courseYear = batchYear + yearOffset;
      
      // Determine final course type
      let finalCourseType = courseType;
      if (courseType === "AUTO") {
        finalCourseType = determineCourseType(addingCourse);
      }

      const status = grade ? "COMPLETED" : semNum < 6 ? "COMPLETED" : "IN_PROGRESS";

      console.log("Frontend: Adding course to semester", semNum, "with status", status);

      const response = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: addingCourse.id,
          semester: semNum,
          year: courseYear,
          term,
          courseType: finalCourseType,
          grade: grade || undefined,
          status,
          isPassFail: isPassFail && finalCourseType === "FREE_ELECTIVE",
        }),
      });

      if (response.ok) {
        showToast("success", "Course added successfully!");
        setAddingCourse(null);
        await loadData();
      } else {
        const error = await response.json();
        showToast("error", error.error || "Failed to add course");
      }
    } catch (error) {
      console.error("Error adding course:", error);
      showToast("error", "Failed to add course");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteEnrollment = async (enrollmentId: string, courseName: string) => {
    const ok = await confirm({
      title: "Remove course?",
      message: `This will remove ${courseName} from your enrollments.`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "warning",
    });
    if (!ok) return;

    try {
      const response = await fetch(`/api/enrollments/${enrollmentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showToast("success", "Course removed successfully!");
        await loadData();
      } else {
        const error = await response.json();
        showToast("error", error.error || "Failed to remove course");
      }
    } catch (error) {
      console.error("Error removing course:", error);
      showToast("error", "Failed to remove course");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-700 rounded-2xl p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white mb-2">Courses</h1>
          <p className="text-white/90 text-lg">
            Manage your enrollments and explore the course catalog
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <Award className="w-6 h-6 opacity-80" />
            <span className="text-sm font-medium opacity-90">Completed</span>
          </div>
          <p className="text-3xl font-bold">{totalCreditsCompleted}</p>
          <p className="text-sm opacity-80">Credits Earned</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-6 text-white shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-6 h-6 opacity-80" />
            <span className="text-sm font-medium opacity-90">In Progress</span>
          </div>
          <p className="text-3xl font-bold">{totalCreditsInProgress}</p>
          <p className="text-sm opacity-80">Credits Current</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-6 text-white shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <BookOpen className="w-6 h-6 opacity-80" />
            <span className="text-sm font-medium opacity-90">Total</span>
          </div>
          <p className="text-3xl font-bold">{enrollments.length}</p>
          <p className="text-sm opacity-80">All Enrollments</p>
        </motion.div>
      </div>

      {/* Category Breakdown */}
      {enrollments.length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Credits by Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(creditsByCategory)
              .filter(([_, credits]) => credits > 0)
              .map(([category, credits]) => {
                const colors = categoryColors[category as keyof typeof categoryColors];
                const labels: Record<string, string> = {
                  IC: "Institute Core",
                  IC_BASKET: "IC Basket",
                  DC: "Discipline Core",
                  DE: "Discipline Electives",
                  FE: "Free Electives",
                  HSS: "HSS",
                  IKS: "IKS",
                  MTP: "MTP",
                  ISTP: "ISTP",
                };
                return (
                  <div key={category} className={`${colors.bg} rounded-lg p-4 border border-opacity-20`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${colors.bar}`}></div>
                      <span className={`text-xs font-semibold ${colors.text}`}>
                        {labels[category]}
                      </span>
                    </div>
                    <p className={`text-2xl font-bold ${colors.text}`}>{credits}</p>
                    <p className="text-xs text-foreground-secondary mt-1">credits</p>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tab Navigation with Add Button */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 p-1 bg-surface rounded-lg border border-border shadow-sm flex-1">
          <button
            onClick={() => setTab("my-courses")}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
              tab === "my-courses"
                ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg"
                : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            My Enrollments ({enrollments.length})
          </button>
          <button
            onClick={() => setTab("catalog")}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
              tab === "catalog"
                ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg"
                : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            Course Catalog ({allCourses.length})
          </button>
        </div>
        <button
          onClick={() => setTab("catalog")}
          className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Courses
        </button>
      </div>

      {/* My Courses Tab */}
      <AnimatePresence mode="wait">
        {tab === "my-courses" && (
          <motion.div
            key="my-courses"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {enrollments.length === 0 ? (
              <div className="text-center py-12 bg-surface rounded-xl border border-border">
                <BookOpen className="w-16 h-16 text-foreground-secondary mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No courses enrolled
                </h3>
                <p className="text-foreground-secondary mb-6">
                  Browse the catalog to start adding courses
                </p>
                <button
                  onClick={() => setTab("catalog")}
                  className="px-6 py-3 bg-primary text-white rounded-lg hover:shadow-lg transition-all inline-flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Browse Courses
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {Array.from(new Set(enrollments.map(e => e.semester)))
                  .sort((a, b) => a - b)
                  .map((semNum) => {
                    const semesterEnrollments = enrollments.filter(e => e.semester === semNum);
                    const semCredits = semesterEnrollments.reduce((sum, e) => sum + e.course.credits, 0);
                    
                    return (
                      <div key={semNum} className="space-y-3">
                        <div className="flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent rounded-lg p-4 border-l-4 border-primary">
                          <h3 className="text-xl font-bold text-foreground">
                            Semester {semNum}
                          </h3>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-foreground-secondary">
                              {semesterEnrollments.length} courses
                            </span>
                            <span className="px-4 py-1.5 bg-primary text-white rounded-full font-bold text-sm">
                              {semCredits} Credits
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid gap-3 pl-4">
                          {semesterEnrollments.map((enrollment) => (
                            <motion.div
                              key={enrollment.id}
                              className="group relative overflow-hidden bg-surface rounded-lg border border-border p-4 hover:border-primary hover:shadow-lg transition-all"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              <div className="relative z-10 flex items-start justify-between gap-4">
                                <button
                                  onClick={() => setSelectedCourse(enrollment.course)}
                                  className="flex-1 min-w-0 text-left"
                                >
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                                      {formatCourseCode(enrollment.course.code)}
                                    </h3>
                                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20">
                                      {enrollment.course.credits} Cr
                                    </span>
                                    <span
                                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                        enrollment.status === "COMPLETED"
                                          ? "bg-green-500/10 text-green-600 border border-green-500/30"
                                          : "bg-blue-500/10 text-blue-600 border border-blue-500/30"
                                      }`}
                                    >
                                      {enrollment.status}
                                    </span>
                                  </div>
                                  <p className="text-foreground font-medium mb-2 text-sm">
                                    {enrollment.course.name}
                                  </p>
                                  <div className="flex flex-wrap gap-2 text-xs text-foreground-secondary">
                                    <span className="px-2 py-1 bg-surface-hover rounded">
                                      {enrollment.term} {enrollment.year}
                                    </span>
                                    <span className="px-2 py-1 bg-surface-hover rounded">
                                      {enrollment.course.department}
                                    </span>
                                  </div>
                                </button>
                                <div className="flex flex-col gap-2">
                                  {enrollment.grade && (
                                    <div className="text-center">
                                      <p className="text-xs text-foreground-secondary mb-1">
                                        Grade
                                      </p>
                                      <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-lg">
                                        <p className="text-xl font-bold text-white">
                                          {enrollment.grade}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteEnrollment(enrollment.id, enrollment.course.name);
                                    }}
                                    className="p-2 bg-red-500/10 text-red-600 rounded-lg hover:bg-red-500/20 transition-colors"
                                    title="Remove course"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </motion.div>
        )}

        {/* Course Catalog Tab */}
        {tab === "catalog" && (
          <motion.div
            key="catalog"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-5"
          >
            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-foreground-secondary group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Search by course code or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-surface border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground placeholder-foreground-secondary transition-all shadow-sm"
                />
              </div>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="px-6 py-3 bg-surface border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground font-medium shadow-sm transition-all cursor-pointer min-w-[200px]"
              >
                <option value="all">All Departments ({departments.length})</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Course List */}
            {filteredCourses.length === 0 ? (
              <div className="text-center py-12 bg-surface rounded-xl border border-border">
                <Filter className="w-16 h-16 text-foreground-secondary mx-auto mb-4 opacity-50" />
                <p className="text-foreground-secondary">No courses found</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredCourses.map((course) => (
                  <motion.button
                    key={course.id}
                    onClick={() => setSelectedCourse(course)}
                    whileHover={{ scale: 1.01 }}
                    className="group relative overflow-hidden bg-surface rounded-lg border border-border p-5 hover:border-primary hover:shadow-xl transition-all text-left"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors mb-1">
                            {formatCourseCode(course.code)} - {course.name}
                          </h3>
                          <p className="text-sm text-foreground-secondary line-clamp-1">
                            {course.description}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-semibold rounded-full border border-primary/20 whitespace-nowrap">
                          {course.credits} Cr
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="px-3 py-1 bg-surface-hover rounded font-medium text-foreground">
                          {course.department}
                        </span>
                        <span className="px-3 py-1 bg-surface-hover rounded text-foreground-secondary">
                          L{course.level}
                        </span>
                        {enrolledCourseIds.has(course.id) ? (
                          <span className="px-3 py-1 bg-green-500/10 text-green-600 rounded font-medium border border-green-500/30 ml-auto">
                            ✓ Enrolled
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddCourse(course);
                            }}
                            className="ml-auto px-4 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-hover font-medium transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-4 h-4" />
                            Add
                          </button>
                        )}
                        <div className="flex gap-2">
                          {course.offeredInFall && (
                            <span className="px-2 py-1 bg-orange-500/10 text-orange-600 rounded text-xs font-semibold">
                              Fall
                            </span>
                          )}
                          {course.offeredInSpring && (
                            <span className="px-2 py-1 bg-green-500/10 text-green-600 rounded text-xs font-semibold">
                              Spring
                            </span>
                          )}
                          {course.offeredInSummer && (
                            <span className="px-2 py-1 bg-blue-500/10 text-blue-600 rounded text-xs font-semibold">
                              Summer
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Course Details Modal */}
      <AnimatePresence>
        {selectedCourse && (
          <motion.div
            key="modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedCourse(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-foreground mb-2">
                    {formatCourseCode(selectedCourse.code)}
                  </h2>
                  <p className="text-xl text-foreground-secondary">
                    {selectedCourse.name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="p-2 hover:bg-surface-hover rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-surface-hover rounded-lg p-4">
                  <p className="text-sm text-foreground-secondary mb-1">
                    Credits
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {selectedCourse.credits}
                  </p>
                </div>
                <div className="bg-surface-hover rounded-lg p-4">
                  <p className="text-sm text-foreground-secondary mb-1">Level</p>
                  <p className="text-2xl font-bold text-primary">
                    {selectedCourse.level}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold text-foreground mb-3">
                  Offerings
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedCourse.offeredInFall && (
                    <span className="px-4 py-2 bg-orange-500/10 text-orange-600 rounded-lg font-medium border border-orange-500/20">
                      Fall
                    </span>
                  )}
                  {selectedCourse.offeredInSpring && (
                    <span className="px-4 py-2 bg-green-500/10 text-green-600 rounded-lg font-medium border border-green-500/20">
                      Spring
                    </span>
                  )}
                  {selectedCourse.offeredInSummer && (
                    <span className="px-4 py-2 bg-blue-500/10 text-blue-600 rounded-lg font-medium border border-blue-500/20">
                      Summer
                    </span>
                  )}
                </div>
              </div>

              {selectedCourse.description && (
                <div className="mb-6">
                  <h3 className="font-semibold text-foreground mb-2">
                    Description
                  </h3>
                  <p className="text-foreground-secondary leading-relaxed">
                    {selectedCourse.description}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedCourse.code);
                    showToast("success", "Course code copied!");
                  }}
                  className="flex-1 px-6 py-3 border-2 border-border text-foreground rounded-lg hover:bg-surface-hover transition-all font-medium"
                >
                  Copy Code
                </button>
                {!enrolledCourseIds.has(selectedCourse.id) && (
                  <button
                    onClick={() => {
                      setSelectedCourse(null);
                      handleAddCourse(selectedCourse);
                    }}
                    className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all font-medium flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add Course
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Course Modal */}
      <AnimatePresence>
        {addingCourse && (
          <motion.div
            key="add-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAddingCourse(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface rounded-2xl p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto mt-[0.8vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Add Course</h2>
                <button
                  onClick={() => setAddingCourse(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-hover transition-colors text-foreground-secondary hover:text-foreground"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {/* Course Info */}
                <div className="p-4 bg-surface-hover rounded-lg border border-border">
                  <h3 className="font-bold text-lg text-foreground mb-1">
                    {formatCourseCode(addingCourse.code)}
                  </h3>
                  <p className="text-foreground-secondary">{addingCourse.name}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-1 bg-primary/10 text-primary text-sm font-semibold rounded">
                      {addingCourse.credits} Credits
                    </span>
                    <span className="px-2 py-1 bg-surface text-foreground-secondary text-sm rounded">
                      {addingCourse.department}
                    </span>
                  </div>
                </div>

                {/* Semester Input */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Semester Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    placeholder="e.g., 3"
                    className="w-full px-4 py-3 bg-background border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
                  />
                  <p className="text-xs text-foreground-secondary mt-1">
                    Which semester did you take this course?
                  </p>
                </div>

                {/* Grade Input */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Grade (Optional)
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-4 py-3 bg-background border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
                  >
                    <option value="">No grade yet</option>
                    <option value="A+">A+</option>
                    <option value="A">A</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B">B</option>
                    <option value="B-">B-</option>
                    <option value="C+">C+</option>
                    <option value="C">C</option>
                    <option value="C-">C-</option>
                    <option value="D">D</option>
                    <option value="F">F</option>
                    <option value="P">P (Pass)</option>
                    <option value="NP">NP (Not Pass)</option>
                  </select>
                </div>

                {/* Course Type */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Course Type
                  </label>
                  <select
                    value={courseType}
                    onChange={(e) => setCourseType(e.target.value)}
                    className="w-full px-4 py-3 bg-background border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
                  >
                    <option value="AUTO">Auto-detect (Recommended)</option>
                    <option value="CORE">Core (IC/DC)</option>
                    <option value="DE">Discipline Elective (DE)</option>
                    <option value="FREE_ELECTIVE">Free Elective (FE)</option>
                    <option value="PE">Program Elective (PE)</option>
                  </select>
                  <p className="text-xs text-foreground-secondary mt-1">
                    {courseType === "AUTO" && (
                      <>
                        {addingCourse.code.startsWith("HS-") ? (
                          hssCreditsCompleted < 12 ? (
                            <span className="text-green-600">→ Will be marked as HSS/Core ({12 - hssCreditsCompleted} credits remaining)</span>
                          ) : (
                            <span className="text-blue-600">→ Will be marked as Free Elective (HSS limit reached)</span>
                          )
                        ) : (
                          <span>→ Will auto-detect based on course code</span>
                        )}
                      </>
                    )}
                  </p>
                </div>

                {/* Pass/Fail Option (FE only) */}
                {(() => {
                  const inferredType = courseType === "AUTO"
                    ? determineCourseType(addingCourse)
                    : courseType;
                  const isFE = inferredType === "FREE_ELECTIVE";
                  const eligible = Boolean(addingCourse.isPassFailEligible);
                  const canUsePF = isFE && eligible && passFailRemaining > 0;

                  return (
                    <div className="p-4 bg-surface-hover rounded-lg border border-border">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">Pass/Fail (P/F)</p>
                          <p className="text-xs text-foreground-secondary">
                            You can take up to {maxPassFailCredits} P/F credits. Remaining: {passFailRemaining}.
                          </p>
                          {!isFE && (
                            <p className="text-xs text-foreground-secondary mt-1">Only Free Electives can be taken as P/F.</p>
                          )}
                          {isFE && !eligible && (
                            <p className="text-xs text-foreground-secondary mt-1">This course is not P/F eligible.</p>
                          )}
                        </div>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isPassFail}
                            onChange={(e) => setIsPassFail(e.target.checked)}
                            disabled={!canUsePF}
                            className="h-4 w-4"
                          />
                          <span className="text-sm text-foreground">Take as P/F</span>
                        </label>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setAddingCourse(null)}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 border-2 border-border text-foreground rounded-lg hover:bg-surface-hover transition-all font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitEnrollment}
                  disabled={submitting || !semester}
                  className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Adding..." : "Add Course"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
