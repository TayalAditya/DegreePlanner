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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Courses</h1>
        <p className="text-foreground-secondary mt-2">
          Browse and manage your enrolled courses
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface rounded-lg border border-border p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">Credits Earned</p>
              <p className="text-2xl font-bold text-foreground">{totalCredits}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">In Progress</p>
              <p className="text-2xl font-bold text-foreground">{inProgressCredits}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">Total Courses</p>
              <p className="text-2xl font-bold text-foreground">{enrollments.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setView("enrolled")}
          className={`px-4 py-2 font-medium transition-colors ${
            view === "enrolled"
              ? "border-b-2 border-primary text-primary"
              : "text-foreground-secondary hover:text-foreground"
          }`}
        >
          My Enrollments ({enrollments.length})
        </button>
        <button
          onClick={() => setView("catalog")}
          className={`px-4 py-2 font-medium transition-colors ${
            view === "catalog"
              ? "border-b-2 border-primary text-primary"
              : "text-foreground-secondary hover:text-foreground"
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
                className="bg-surface rounded-lg border border-border p-6 hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {enrollment.course.code}
                      </h3>
                      <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                        {enrollment.course.credits} Credits
                      </span>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          enrollment.status === "COMPLETED"
                            ? "bg-green-500/10 text-green-500"
                            : enrollment.status === "IN_PROGRESS"
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-gray-500/10 text-gray-500"
                        }`}
                      >
                        {enrollment.status}
                      </span>
                    </div>
                    <p className="text-foreground mb-1">{enrollment.course.name}</p>
                    <p className="text-sm text-foreground-secondary">
                      {enrollment.term} {enrollment.year} • Semester {enrollment.semester} •{" "}
                      {enrollment.course.department}
                    </p>
                  </div>
                  {enrollment.grade && (
                    <div className="text-right">
                      <p className="text-sm text-foreground-secondary">Grade</p>
                      <p className="text-2xl font-bold text-primary">{enrollment.grade}</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-foreground-secondary" />
              <input
                type="text"
                placeholder="Search by code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
              />
            </div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-4 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
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
                  className="bg-surface rounded-lg border border-border p-5 hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          {course.code}
                        </h3>
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                          {course.credits} Credits
                        </span>
                        <span className="px-2 py-1 bg-gray-500/10 text-gray-500 text-xs rounded-full">
                          Level {course.level}
                        </span>
                      </div>
                      <p className="text-foreground mb-2">{course.name}</p>
                      {course.description && (
                        <p className="text-sm text-foreground-secondary mb-2">
                          {course.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-sm text-foreground-secondary">
                        <span>{course.department}</span>
                        <span>•</span>
                        <div className="flex gap-2">
                          {course.offeredInFall && <span className="text-orange-500">Fall</span>}
                          {course.offeredInSpring && <span className="text-green-500">Spring</span>}
                          {course.offeredInSummer && <span className="text-blue-500">Summer</span>}
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
