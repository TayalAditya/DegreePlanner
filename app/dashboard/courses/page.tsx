"use client";

import { useEffect, useState } from "react";
import { BookOpen, Search, Filter, Clock, Award } from "lucide-react";

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
  course: Course;
}

export default function CoursesPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"enrolled" | "catalog">("enrolled");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("all");

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
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 rounded-2xl p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white mb-2">My Courses</h1>
          <p className="text-white/90">
            Browse your enrollments and explore the course catalog
          </p>
        </div>
      </div>

      {/* Animated Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="group relative overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <Award className="w-8 h-8 text-white/90" />
              <span className="text-sm text-white/80 font-medium">Completed</span>
            </div>
            <p className="text-4xl font-bold text-white">{totalCredits}</p>
            <p className="text-white/80 text-sm mt-1">Credits Earned</p>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 text-white/90" />
              <span className="text-sm text-white/80 font-medium">Active</span>
            </div>
            <p className="text-4xl font-bold text-white">{inProgressCredits}</p>
            <p className="text-white/80 text-sm mt-1">In Progress</p>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <BookOpen className="w-8 h-8 text-white/90" />
              <span className="text-sm text-white/80 font-medium">Total</span>
            </div>
            <p className="text-4xl font-bold text-white">{enrollments.length}</p>
            <p className="text-white/80 text-sm mt-1">All Courses</p>
          </div>
        </div>
      </div>

      {/* Modern View Toggle */}
      <div className="flex gap-2 p-1 bg-surface rounded-xl border border-border shadow-sm w-fit">
        <button
          onClick={() => setView("enrolled")}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
            view === "enrolled"
              ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/30"
              : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
          }`}
        >
          My Enrollments ({enrollments.length})
        </button>
        <button
          onClick={() => setView("catalog")}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
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
              <div
                key={enrollment.id}
                className="group relative overflow-hidden bg-surface rounded-xl border border-border p-6 hover:border-primary hover:shadow-xl transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="relative z-10 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
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
                    <p className="text-sm text-foreground-secondary flex items-center gap-2">
                      <span className="px-2 py-1 bg-surface-hover rounded">{enrollment.term} {enrollment.year}</span>
                      <span>•</span>
                      <span className="px-2 py-1 bg-surface-hover rounded">Semester {enrollment.semester}</span>
                      <span>•</span>
                      <span className="px-2 py-1 bg-surface-hover rounded">{enrollment.course.department}</span>
                    </p>
                  </div>
                  {enrollment.grade && (
                    <div className="text-right">
                      <p className="text-sm text-foreground-secondary mb-1">Grade</p>
                      <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg">
                        <p className="text-3xl font-bold text-white">{enrollment.grade}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
                <div
                  key={course.id}
                  className="group relative overflow-hidden bg-surface rounded-xl border border-border p-6 hover:border-primary hover:shadow-xl transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  <div className="relative z-10 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                          {course.code}
                        </h3>
                        <span className="px-3 py-1 bg-gradient-to-r from-primary/20 to-primary/10 text-primary text-sm font-semibold rounded-full border border-primary/20">
                          {course.credits} Credits
                        </span>
                        <span className="px-3 py-1 bg-gray-500/10 text-gray-600 text-sm font-semibold rounded-full border border-gray-500/20">
                          Level {course.level}
                        </span>
                      </div>
                      <p className="text-lg font-medium text-foreground mb-3">{course.name}</p>
                      {course.description && (
                        <p className="text-sm text-foreground-secondary mb-3 line-clamp-2">
                          {course.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-sm">
                        <span className="px-3 py-1 bg-surface-hover rounded-lg font-medium text-foreground">
                          {course.department}
                        </span>
                        <span className="text-foreground-secondary">•</span>
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
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
