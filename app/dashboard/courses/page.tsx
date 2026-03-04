"use client";

import { useEffect, useMemo, useState } from "react";
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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { StatCard } from "@/components/StatCard";
import { formatCourseCode } from "@/lib/utils";
import { buildNonMgmtMinorCountedCourseCodeSet, useMinorPlannerSelection } from "@/lib/minorPlannerClient";

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
  IC: { bg: "bg-info/10", text: "text-info", bar: "bg-info", border: "border-info/20" },
  IC_BASKET: { bg: "bg-accent/10", text: "text-accent", bar: "bg-accent", border: "border-accent/20" },
  DC: { bg: "bg-primary/10", text: "text-primary", bar: "bg-primary", border: "border-primary/20" },
  DE: { bg: "bg-secondary/10", text: "text-secondary", bar: "bg-secondary", border: "border-secondary/20" },
  FE: { bg: "bg-success/10", text: "text-success", bar: "bg-success", border: "border-success/20" },
  HSS: { bg: "bg-warning/10", text: "text-warning", bar: "bg-warning", border: "border-warning/20" },
  IKS: { bg: "bg-warning/10", text: "text-warning", bar: "bg-warning", border: "border-warning/20" },
  MTP: { bg: "bg-error/10", text: "text-error", bar: "bg-error", border: "border-error/20" },
  ISTP: { bg: "bg-accent/10", text: "text-accent", bar: "bg-accent", border: "border-accent/20" },
};

const DEPARTMENT_PAGE_SIZE = 20;

type SchoolKey =
  | "SCEE" // School of Computing and Electrical Engineering
  | "SMSS" // School of Mathematical and Statistical Sciences
  | "SMME" // School of Mechanical, Materials and Energy Engineering
  | "SPS" // School of Physical Sciences
  | "SCENE" // School of Civil and Environmental Engineering
  | "SCS" // School of Chemical Sciences
  | "SBS" // School of Bio Sciences
  | "SHSS" // School of Humanities & Social Sciences
  | "COMMON"
  | "OTHER";

type SchoolFilter = "all" | SchoolKey;

const SCHOOL_META: Record<SchoolKey, { label: string; order: number; prefixes: string[] }> = {
  SCEE: {
    label: "SCEE (CSE, DSE, EE, VL)",
    order: 10,
    prefixes: ["CS", "DS", "EE", "VL", "MV", "EC", "ECE", "ET"],
  },
  SMSS: { label: "SMSS (MNC)", order: 20, prefixes: ["MC", "MA", "ST"] },
  SMME: { label: "SMME (GE, MSE, ME)", order: 30, prefixes: ["GE", "ME", "MS", "MT", "AR", "EN", "EM", "MI"] },
  SPS: { label: "SPS (EP)", order: 40, prefixes: ["EP", "PH"] },
  SCENE: { label: "SCENE (CE)", order: 50, prefixes: ["CE"] },
  SCS: { label: "SCS (BS CS)", order: 60, prefixes: ["CY", "CH"] },
  SBS: { label: "SBS (BE)", order: 70, prefixes: ["BE", "BY", "BT", "BS"] },
  SHSS: { label: "SHSS (HS)", order: 80, prefixes: ["HS", "MB"] },
  COMMON: { label: "Common (IC/IKS/DP)", order: 90, prefixes: ["IC", "IK", "IKS", "DP", "RM"] },
  OTHER: { label: "Other", order: 99, prefixes: [] },
};

const SCHOOL_ORDER: SchoolKey[] = Object.entries(SCHOOL_META)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([key]) => key as SchoolKey);

function getCoursePrefix(code: string): string {
  const upper = String(code ?? "").trim().toUpperCase();
  const match = upper.match(/^([A-Z]{2,4})/);
  return match?.[1] ?? "";
}

function getCourseSchoolKey(course: Pick<Course, "code" | "department">): SchoolKey {
  const prefix = getCoursePrefix(course.code);
  for (const key of SCHOOL_ORDER) {
    const meta = SCHOOL_META[key];
    if (meta.prefixes.includes(prefix)) return key;
  }

  const dept = String(course.department ?? "").toLowerCase();
  if (dept.includes("humanities")) return "SHSS";
  if (dept.includes("comput") || dept.includes("electrical") || dept.includes("vlsi")) return "SCEE";
  if (dept.includes("mathemat") || dept.includes("statistical")) return "SMSS";
  if (dept.includes("mechanical") || dept.includes("material") || dept.includes("energy")) return "SMME";
  if (dept.includes("physical") || dept.includes("physics")) return "SPS";
  if (dept.includes("civil") || dept.includes("environment")) return "SCENE";
  if (dept.includes("chemical")) return "SCS";
  if (dept.includes("bio")) return "SBS";
  if (dept.includes("institute core") || dept.includes("indian knowledge") || dept === "dp") return "COMMON";
  return "OTHER";
}

export default function CoursesPage() {
  const [tab, setTab] = useState<"my-courses" | "catalog">("my-courses");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<SchoolFilter>("all");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [addingCourse, setAddingCourse] = useState<Course | null>(null);
  const [semester, setSemester] = useState<string>("");
  const [grade, setGrade] = useState<string>("");
  const [courseType, setCourseType] = useState<string>("AUTO");
  const [isPassFail, setIsPassFail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedDepartments, setExpandedDepartments] = useState<string[]>([]);
  const [departmentVisibleCounts, setDepartmentVisibleCounts] = useState<Record<string, number>>({});
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();

  // Auto-calculate current semester from batch year (2023) + current date
  // Odd sems = Fall (Aug-Dec), Even sems = Spring (Jan-May)
  const currentSem = (() => {
    const now = new Date();
    const batch = 2023;
    const yearsElapsed = now.getFullYear() - batch;
    const isSpring = now.getMonth() + 1 <= 6;
    return isSpring ? yearsElapsed * 2 : yearsElapsed * 2 + 1;
  })();

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

  const schoolCounts: Record<string, number> = {};
  for (const course of allCourses) {
    const key = getCourseSchoolKey(course);
    schoolCounts[key] = (schoolCounts[key] ?? 0) + 1;
  }

  const schoolOptions = SCHOOL_ORDER
    .map((key) => ({ key, label: SCHOOL_META[key].label, count: schoolCounts[key] ?? 0 }))
    .filter((o) => o.count > 0);

  const normalizeCourseCodeForSearch = (text: string) =>
    text.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const searchNormalized = normalizeCourseCodeForSearch(searchQuery);
  const searchLower = searchQuery.trim().toLowerCase();

  const filteredCourses = allCourses.filter((course) => {
    const matchesSearch =
      !searchLower ||
      normalizeCourseCodeForSearch(course.code).includes(searchNormalized) ||
      course.name.toLowerCase().includes(searchLower);
    const matchesDept = selectedDept === "all" || getCourseSchoolKey(course) === selectedDept;
    return matchesSearch && matchesDept;
  });

  const departmentGroups = (() => {
    const bySchool: Record<string, Course[]> = {};
    for (const course of filteredCourses) {
      const key = getCourseSchoolKey(course);
      const list = bySchool[key] ?? [];
      list.push(course);
      bySchool[key] = list;
    }

    return SCHOOL_ORDER
      .filter((key) => (bySchool[key]?.length ?? 0) > 0)
      .map((key) => ({
        dept: key,
        label: SCHOOL_META[key].label,
        courses: (bySchool[key] ?? []).sort((a, b) => a.code.localeCompare(b.code)),
      }));
  })();

  const toggleDepartment = (dept: string) => {
    setExpandedDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
    setDepartmentVisibleCounts((prev) =>
      prev[dept] ? prev : { ...prev, [dept]: DEPARTMENT_PAGE_SIZE }
    );
  };

  const expandAllDepartments = () => {
    const all = departmentGroups.map((g) => g.dept);
    setExpandedDepartments(all);
    setDepartmentVisibleCounts((prev) => {
      const next = { ...prev };
      for (const dept of all) {
        if (!next[dept]) next[dept] = DEPARTMENT_PAGE_SIZE;
      }
      return next;
    });
  };

  const collapseAllDepartments = () => setExpandedDepartments([]);

  useEffect(() => {
    if (tab !== "catalog") return;
    if (selectedDept === "all") return;

    setExpandedDepartments([selectedDept]);
    setDepartmentVisibleCounts((prev) =>
      prev[selectedDept] ? prev : { ...prev, [selectedDept]: DEPARTMENT_PAGE_SIZE }
    );
  }, [selectedDept, tab]);

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

  const minorPlanner = useMinorPlannerSelection();
  const nonMgmtMinorCourseCodes = useMemo(() => {
    if (!minorPlanner.enabled) return new Set<string>();
    const eligible = buildNonMgmtMinorCountedCourseCodeSet(minorPlanner.codes);
    if (!minorPlanner.countedCourseCodesConfigured) return eligible;

    const selected = new Set(
      (minorPlanner.countedCourseCodes ?? [])
        .map((c) => formatCourseCode(String(c ?? "")))
        .filter((c) => Boolean(c))
    );

    const out = new Set<string>();
    selected.forEach((code) => {
      if (eligible.has(code)) out.add(code);
    });
    return out;
  }, [
    minorPlanner.enabled,
    minorPlanner.codes,
    minorPlanner.countedCourseCodes,
    minorPlanner.countedCourseCodesConfigured,
  ]);

  const applyMinorDeOverride = (category: string, enrollment: Enrollment): string => {
    if (category !== "DE") return category;
    const code = formatCourseCode(enrollment.course.code);
    if (!code) return category;
    return nonMgmtMinorCourseCodes.has(code) ? "FE" : category;
  };

  // Calculate credits by category
  const getCourseCategory = (enrollment: Enrollment): string => {
    // First try to get from branchMappings if available
    if (enrollment.course.branchMappings && enrollment.course.branchMappings.length > 0 && user?.branch) {
      const mappingBranch = user.branch === "CSE" ? "CS" : user.branch;
      const mapping = enrollment.course.branchMappings.find(
        (m) => m.branch === mappingBranch || m.branch === "COMMON"
      ) || (user.branch === "GE"
        ? enrollment.course.branchMappings.find((m) => m.branch.startsWith("GE"))
        : undefined);

      if (mapping) {
        if (mapping.courseCategory === "NA") {
          return "FE";
        }
        return applyMinorDeOverride(mapping.courseCategory, enrollment);
      }
    }

    // Fallback to code analysis
    const code = enrollment.course.code.toUpperCase();
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);

    if (isICB1 || isICB2) return "IC_BASKET";
    if (normalizedCode === "IC181") return "IKS";
    
    // Branch-specific course patterns
    if (user?.branch === "CSE" && code.startsWith("DS")) return applyMinorDeOverride("DE", enrollment);
    if (user?.branch === "DSE" && (code.startsWith("DS") || code.startsWith("CS"))) return applyMinorDeOverride("DE", enrollment);
    
    if (normalizedCode.startsWith("IC")) return "IC";
    if (normalizedCode.startsWith("HS")) return "HSS";
    if (normalizedCode.startsWith("IKS") || normalizedCode.startsWith("IK")) return "IKS";

    // Special DP codes (ISTP/MTP don't contain "ISTP"/"MTP" in the code)
    if (normalizedCode === "DP301P") return "ISTP";
    if (normalizedCode === "DP498P" || normalizedCode === "DP499P") return "MTP";
    if (normalizedCode.includes("MTP")) return "MTP";
    if (normalizedCode.includes("ISTP")) return "ISTP";

    // Fallback to courseType mapping
    switch (enrollment.courseType) {
      case "DE":
        return applyMinorDeOverride("DE", enrollment);
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
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");

    // Special DP codes
    if (normalizedCode === "DP301P") return "ISTP";
    if (normalizedCode === "DP498P" || normalizedCode === "DP499P") return "MTP";
    
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
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/12 via-transparent to-accent/12"
          aria-hidden="true"
        />
        <div className="relative p-6 sm:p-8">
          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Courses
          </h1>
          <p className="mt-2 text-sm sm:text-base text-foreground-secondary">
            Manage your enrollments and explore the course catalog
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Award className="w-full h-full" />}
          label="Completed"
          value={totalCreditsCompleted}
          sublabel="Credits earned"
          valueColor="text-success"
          iconBg="bg-success/10"
          iconColor="text-success"
          accentBgColor="bg-success/10"
          delay={0}
        />

        <StatCard
          icon={<Clock className="w-full h-full" />}
          label="In Progress"
          value={totalCreditsInProgress}
          sublabel="Credits current"
          valueColor="text-info"
          iconBg="bg-info/10"
          iconColor="text-info"
          accentBgColor="bg-info/10"
          delay={0.05}
        />

        <StatCard
          icon={<BookOpen className="w-full h-full" />}
          label="Total"
          value={enrollments.length}
          sublabel="All enrollments"
          valueColor="text-primary"
          iconBg="bg-primary/10"
          iconColor="text-primary"
          accentBgColor="bg-primary/10"
          delay={0.1}
        />
      </div>

      {/* Category Breakdown */}
          {enrollments.length > 0 && (
          <div className="bg-surface rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Credits by Category</h3>
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
                  <div key={category} className={`${colors.bg} ${colors.border} rounded-lg p-4 border`}>
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
          className="dp-btn dp-btn-primary sm:self-start"
        >
          <Plus className="w-4 h-4" />
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
                  className="dp-btn dp-btn-primary"
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
                                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-semibold rounded-full border border-primary/20">
                                      {enrollment.course.credits} Cr
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                                        enrollment.status === "COMPLETED"
                                          ? "bg-success/10 text-success border border-success/30"
                                          : "bg-info/10 text-info border border-info/30"
                                      }`}
                                    >
                                      {enrollment.status}
                                    </span>
                                  </div>
                                  <p className="text-foreground font-medium mb-2 text-sm">
                                    {enrollment.course.name}
                                  </p>
                                  <div className="flex flex-wrap gap-2 text-xs text-foreground-secondary mb-3">
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
                                    className="p-2 bg-error/10 text-error rounded-lg hover:bg-error/20 transition-colors"
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
                onChange={(e) => setSelectedDept(e.target.value as SchoolFilter)}
                className="px-6 py-3 bg-surface border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground font-medium shadow-sm transition-all cursor-pointer min-w-[200px]"
              >
                <option value="all">All Schools ({schoolOptions.length})</option>
                {schoolOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
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
              <>
                {searchLower ? (
                  <div className="grid gap-3">
                    {filteredCourses.map((course) => (
                      <motion.div
                        key={course.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedCourse(course)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedCourse(course);
                          }
                        }}
                        whileHover={{ scale: 1.01 }}
                        className="group relative overflow-hidden bg-surface rounded-lg border border-border p-5 hover:border-primary hover:shadow-xl transition-all text-left cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative z-10">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="min-w-0">
                              <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors mb-1 truncate">
                                {formatCourseCode(course.code)} - {course.name}
                              </h3>
                              {course.description && (
                                <p className="text-sm text-foreground-secondary line-clamp-1">
                                  {course.description}
                                </p>
                              )}
                            </div>
                            <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-semibold rounded-full border border-primary/20 whitespace-nowrap">
                              {course.credits} Cr
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-sm">
                        {(() => {
                          const schoolKey = getCourseSchoolKey(course);
                          return (
                            <span
                              title={SCHOOL_META[schoolKey].label}
                              className="px-3 py-1 bg-surface-hover rounded font-medium text-foreground"
                            >
                              {schoolKey}
                            </span>
                          );
                        })()}
                        <span className="px-3 py-1 bg-surface-hover rounded text-foreground-secondary">
                          L{course.level}
                        </span>
                            {enrolledCourseIds.has(course.id) ? (
                              <span className="px-3 py-1 bg-success/10 text-success rounded font-medium border border-success/30 ml-auto">
                                ✓ Enrolled
                              </span>
                            ) : (
                              <button
                                type="button"
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
                                <span className="px-2 py-1 bg-warning/10 text-warning rounded text-xs font-semibold">
                                  Fall
                                </span>
                              )}
                              {course.offeredInSpring && (
                                <span className="px-2 py-1 bg-success/10 text-success rounded text-xs font-semibold">
                                  Spring
                                </span>
                              )}
                              {course.offeredInSummer && (
                                <span className="px-2 py-1 bg-info/10 text-info rounded text-xs font-semibold">
                                  Summer
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-foreground-secondary">
                      <p>Tap a school to expand its courses.</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={expandAllDepartments}
                          className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-hover transition-colors"
                        >
                          Expand all
                        </button>
                        <button
                          type="button"
                          onClick={collapseAllDepartments}
                          className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-hover transition-colors"
                        >
                          Collapse all
                        </button>
                      </div>
                    </div>

                    {departmentGroups.map(({ dept, label, courses }) => {
                      const isExpanded = expandedDepartments.includes(dept);
                      const visibleCount = departmentVisibleCounts[dept] || DEPARTMENT_PAGE_SIZE;
                      const visibleCourses = courses.slice(0, visibleCount);

                      return (
                        <div key={dept} className="bg-surface rounded-xl border border-border overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleDepartment(dept)}
                            aria-expanded={isExpanded}
                            className="w-full p-4 hover:bg-surface-hover transition-colors flex items-center justify-between gap-4 text-left"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{label}</p>
                              <p className="text-xs text-foreground-secondary">
                                {courses.length} courses
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full border border-border bg-surface-hover text-foreground-secondary">
                                {courses.length}
                              </span>
                              <ChevronDown
                                className={`w-4 h-4 text-foreground-secondary transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              />
                            </div>
                          </button>

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="border-t border-border p-4 space-y-3">
                                  {visibleCourses.map((course) => (
                                    <motion.div
                                      key={course.id}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => setSelectedCourse(course)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          setSelectedCourse(course);
                                        }
                                      }}
                                      whileHover={{ scale: 1.01 }}
                                      className="group relative overflow-hidden bg-card rounded-lg border border-border p-4 hover:border-primary hover:shadow-lg transition-all text-left w-full cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                                    >
                                      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                      <div className="relative z-10">
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                          <div className="min-w-0">
                                            <h3 className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors mb-1 truncate">
                                              {formatCourseCode(course.code)} - {course.name}
                                            </h3>
                                            {course.description && (
                                              <p className="text-xs sm:text-sm text-foreground-secondary line-clamp-1">
                                                {course.description}
                                              </p>
                                            )}
                                          </div>
                                          <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20 whitespace-nowrap">
                                            {course.credits} Cr
                                          </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                                          <span className="px-3 py-1 bg-surface-hover rounded font-medium text-foreground">
                                            L{course.level}
                                          </span>
                                          {enrolledCourseIds.has(course.id) ? (
                                            <span className="px-3 py-1 bg-success/10 text-success rounded font-medium border border-success/30 ml-auto">
                                              ✓ Enrolled
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
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
                                              <span className="px-2 py-1 bg-warning/10 text-warning rounded text-xs font-semibold">
                                                Fall
                                              </span>
                                            )}
                                            {course.offeredInSpring && (
                                              <span className="px-2 py-1 bg-success/10 text-success rounded text-xs font-semibold">
                                                Spring
                                              </span>
                                            )}
                                            {course.offeredInSummer && (
                                              <span className="px-2 py-1 bg-info/10 text-info rounded text-xs font-semibold">
                                                Summer
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  ))}

                                  {visibleCount < courses.length && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDepartmentVisibleCounts((prev) => ({
                                          ...prev,
                                          [dept]: Math.min(
                                            (prev[dept] || DEPARTMENT_PAGE_SIZE) + DEPARTMENT_PAGE_SIZE,
                                            courses.length
                                          ),
                                        }))
                                      }
                                      className="w-full px-4 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover transition-colors text-sm font-medium text-foreground"
                                    >
                                      Show more ({courses.length - visibleCount} remaining)
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
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
              className="bg-surface rounded-2xl p-4 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 break-all sm:break-normal">
                    {formatCourseCode(selectedCourse.code)}
                  </h2>
                  <p className="text-base sm:text-xl text-foreground-secondary">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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
                    <span className="px-4 py-2 bg-warning/10 text-warning rounded-lg font-medium border border-warning/20">
                      Fall
                    </span>
                  )}
                  {selectedCourse.offeredInSpring && (
                    <span className="px-4 py-2 bg-success/10 text-success rounded-lg font-medium border border-success/20">
                      Spring
                    </span>
                  )}
                  {selectedCourse.offeredInSummer && (
                    <span className="px-4 py-2 bg-info/10 text-info rounded-lg font-medium border border-info/20">
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

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedCourse.code);
                    showToast("success", "Course code copied!");
                  }}
                  className="w-full sm:flex-1 px-6 py-3 border-2 border-border text-foreground rounded-lg hover:bg-surface-hover transition-all font-medium"
                >
                  Copy Code
                </button>
                {!enrolledCourseIds.has(selectedCourse.id) && (
                  <button
                    onClick={() => {
                      setSelectedCourse(null);
                      handleAddCourse(selectedCourse);
                    }}
                    className="w-full sm:flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all font-medium flex items-center justify-center gap-2"
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
              className="bg-surface rounded-2xl p-4 sm:p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto mt-[0.8vh]"
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
                    Semester Number <span className="text-error">*</span>
                  </label>
                  {(() => {
                    const { offeredInFall, offeredInSpring } = addingCourse;
                    const offeredBothSemesters = offeredInFall && offeredInSpring;
                    const offeredOddOnly = offeredInFall && !offeredInSpring;
                    const offeredEvenOnly = !offeredInFall && offeredInSpring;

                    // If course is offered in both semesters OR neither specified, show all semesters up to currentSem
                    if (offeredBothSemesters || (!offeredInFall && !offeredInSpring)) {
                      return (
                        <>
                          <select
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            className="w-full px-4 py-3 bg-background border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
                          >
                            <option value="">Select semester...</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8].filter((s) => s <= currentSem).map((sem) => (
                              <option key={sem} value={sem}>
                                Semester {sem} ({sem % 2 === 1 ? "Fall" : "Spring"})
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-foreground-secondary mt-1">
                            Showing up to Sem {currentSem} (current semester)
                          </p>
                        </>
                      );
                    }

                    // Odd semester only (Fall only) - semesters 1, 3, 5, 7
                    if (offeredOddOnly) {
                      return (
                        <>
                          <select
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            className="w-full px-4 py-3 bg-background border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
                          >
                            <option value="">Select semester...</option>
                            {[1, 3, 5, 7].filter((s) => s <= currentSem).map((sem) => (
                              <option key={sem} value={sem}>
                                Semester {sem} (Fall)
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-warning mt-1">
                            ⚠️ Fall semesters only — up to Sem {currentSem}
                          </p>
                        </>
                      );
                    }

                    // Even semester only (Spring only) - semesters 2, 4, 6, 8
                    if (offeredEvenOnly) {
                      return (
                        <>
                          <select
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            className="w-full px-4 py-3 bg-background border-2 border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
                          >
                            <option value="">Select semester...</option>
                            {[2, 4, 6, 8].filter((s) => s <= currentSem).map((sem) => (
                              <option key={sem} value={sem}>
                                Semester {sem} (Spring)
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-info mt-1">
                            ℹ️ Spring semesters only — up to Sem {currentSem}
                          </p>
                        </>
                      );
                    }

                    // Fallback (shouldn't reach here)
                    return (
                      <>
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
                      </>
                    );
                  })()}
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
                    <option value="ISTP">ISTP</option>
                    <option value="MTP">MTP</option>
                  </select>
                  <p className="text-xs text-foreground-secondary mt-1">
                    {courseType === "AUTO" && (
                      <>
                        {addingCourse.code.startsWith("HS-") ? (
                          hssCreditsCompleted < 12 ? (
                            <span className="text-success">→ Will be marked as HSS/Core ({12 - hssCreditsCompleted} credits remaining)</span>
                          ) : (
                            <span className="text-info">→ Will be marked as Free Elective (HSS limit reached)</span>
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
