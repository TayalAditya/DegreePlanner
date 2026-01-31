"use client";

import { useState, useEffect } from "react";
import { Save, Search, Filter } from "lucide-react";

interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  department: string;
}

interface CourseMapping {
  id: string;
  courseId: string;
  branch: string;
  courseCategory: string;
  isRequired: boolean;
  semester: number | null;
  course: Course;
}

const BRANCHES = [
  { code: "CSE", name: "Computer Science & Engineering" },
  { code: "DSE", name: "Data Science & Engineering" },
  { code: "EE", name: "Electrical Engineering" },
  { code: "ME", name: "Mechanical Engineering" },
  { code: "CIVIL", name: "Civil Engineering" },
  { code: "BIO-E", name: "Bio Engineering" },
  { code: "EP", name: "Engineering Physics" },
  { code: "MSE", name: "Materials Science & Engineering" },
  { code: "MNC", name: "Mathematics & Computing" },
  { code: "VLSI", name: "Microelectronics & VLSI" },
  { code: "GE-ROBO", name: "General Engineering (Robotics)" },
  { code: "GE-COMM", name: "General Engineering (Communication)" },
  { code: "GE-MECH", name: "General Engineering (Mechatronics)" },
  { code: "BS-CS", name: "B.S. Chemical Sciences" },
];

const COURSE_CATEGORIES = [
  { value: "IC", label: "IC - Institute Core" },
  { value: "IC_BASKET", label: "IC Basket" },
  { value: "DC", label: "DC - Discipline Core" },
  { value: "DE", label: "DE - Discipline Elective" },
  { value: "FE", label: "FE - Free Elective" },
  { value: "HSS", label: "HSS - Humanities & Social Sciences" },
  { value: "IKS", label: "IKS - Indian Knowledge System" },
  { value: "MTP", label: "MTP - Major Technical Project" },
  { value: "ISTP", label: "ISTP" },
  { value: "NA", label: "N/A - Not Applicable" },
];

export default function CourseMappingsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [mappings, setMappings] = useState<Map<string, CourseMapping>>(new Map());
  const [selectedBranch, setSelectedBranch] = useState("CSE");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Map<string, Partial<CourseMapping>>>(new Map());

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchMappings(selectedBranch);
    }
  }, [selectedBranch]);

  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/courses");
      const data = await res.json();
      setCourses(data);
    } catch (error) {
      console.error("Failed to fetch courses:", error);
    }
  };

  const fetchMappings = async (branch: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/course-mappings?branch=${branch}`);
      const data: CourseMapping[] = await res.json();
      
      const mappingMap = new Map<string, CourseMapping>();
      data.forEach((mapping) => {
        mappingMap.set(`${mapping.courseId}-${mapping.branch}`, mapping);
      });
      
      setMappings(mappingMap);
    } catch (error) {
      console.error("Failed to fetch mappings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (courseId: string, category: string) => {
    const key = `${courseId}-${selectedBranch}`;
    const currentMapping = mappings.get(key);
    
    const newChange = {
      courseId,
      branch: selectedBranch,
      courseCategory: category,
      isRequired: currentMapping?.isRequired || false,
      semester: currentMapping?.semester || null,
    };

    setChanges(new Map(changes.set(key, newChange)));
  };

  const handleSemesterChange = (courseId: string, semester: string) => {
    const key = `${courseId}-${selectedBranch}`;
    const currentMapping = mappings.get(key);
    const existing = changes.get(key);
    
    const newChange = {
      ...existing,
      courseId,
      branch: selectedBranch,
      courseCategory: existing?.courseCategory || currentMapping?.courseCategory || "NA",
      semester: semester ? parseInt(semester) : null,
      isRequired: currentMapping?.isRequired || false,
    };

    setChanges(new Map(changes.set(key, newChange)));
  };

  const handleSaveChanges = async () => {
    if (changes.size === 0) {
      alert("No changes to save");
      return;
    }

    setSaving(true);
    try {
      const mappingsArray = Array.from(changes.values());
      
      const res = await fetch("/api/course-mappings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: mappingsArray }),
      });

      if (res.ok) {
        alert(`Saved ${changes.size} changes successfully!`);
        setChanges(new Map());
        fetchMappings(selectedBranch);
      } else {
        alert("Failed to save changes");
      }
    } catch (error) {
      console.error("Failed to save changes:", error);
      alert("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const filteredCourses = courses.filter((course) =>
    course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDisplayCategory = (courseId: string) => {
    const key = `${courseId}-${selectedBranch}`;
    return changes.get(key)?.courseCategory || mappings.get(key)?.courseCategory || "NA";
  };

  const getDisplaySemester = (courseId: string) => {
    const key = `${courseId}-${selectedBranch}`;
    return changes.get(key)?.semester ?? mappings.get(key)?.semester ?? "";
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Course-Branch Mappings
          </h1>
          <p className="text-foreground-secondary">
            Assign course categories (IC, DC, DE, FE, etc.) for each branch
          </p>
        </div>

        {/* Controls */}
        <div className="bg-surface rounded-lg p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Branch Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Select Branch
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground"
              >
                {BRANCHES.map((branch) => (
                  <option key={branch.code} value={branch.code}>
                    {branch.code} - {branch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <Search className="w-4 h-4 inline mr-1" />
                Search Courses
              </label>
              <input
                type="text"
                placeholder="Search by code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground"
              />
            </div>

            {/* Save Button */}
            <div className="flex items-end">
              <button
                onClick={handleSaveChanges}
                disabled={saving || changes.size === 0}
                className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : `Save Changes (${changes.size})`}
              </button>
            </div>
          </div>
        </div>

        {/* Course Table */}
        <div className="bg-surface rounded-lg overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background-secondary">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                    Course Code
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                    Course Name
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                    Credits
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                    Category for {selectedBranch}
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                    Semester
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-foreground-secondary">
                      Loading courses...
                    </td>
                  </tr>
                ) : filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-foreground-secondary">
                      No courses found
                    </td>
                  </tr>
                ) : (
                  filteredCourses.map((course) => {
                    const category = getDisplayCategory(course.id);
                    const semester = getDisplaySemester(course.id);
                    const isChanged = changes.has(`${course.id}-${selectedBranch}`);

                    return (
                      <tr
                        key={course.id}
                        className={`hover:bg-background-secondary ${
                          isChanged ? "bg-yellow-50 dark:bg-yellow-900/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {course.code}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {course.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-foreground">
                          {course.credits}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={category}
                            onChange={(e) => handleCategoryChange(course.id, e.target.value)}
                            className="w-full px-3 py-1.5 border border-border rounded-md bg-background text-foreground text-sm"
                          >
                            {COURSE_CATEGORIES.map((cat) => (
                              <option key={cat.value} value={cat.value}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="1"
                            max="8"
                            value={semester}
                            onChange={(e) => handleSemesterChange(course.id, e.target.value)}
                            placeholder="Sem"
                            className="w-20 px-3 py-1.5 border border-border rounded-md bg-background text-foreground text-sm text-center"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 text-sm text-foreground-secondary">
          Showing {filteredCourses.length} of {courses.length} courses
          {changes.size > 0 && (
            <span className="ml-4 text-yellow-600 dark:text-yellow-400 font-medium">
              • {changes.size} unsaved changes
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
