"use client";

import { useState, useEffect } from "react";
import { Save, Search, Filter, Users } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

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
  batch: string;
  courseCategory: string;
  isRequired: boolean;
  semester: number | null;
  course: Course;
}

const BRANCHES = [
  { code: "CSE", name: "Computer Science & Engineering" },
  { code: "DSE", name: "Data Science & Engineering" },
  { code: "DSAI", name: "Data Science & Artificial Intelligence" },
  { code: "EE", name: "Electrical Engineering" },
  { code: "ME", name: "Mechanical Engineering" },
  { code: "CE", name: "Civil Engineering" },
  { code: "BE", name: "Bio Engineering" },
  { code: "EP", name: "Engineering Physics" },
  { code: "MSE", name: "Materials Science & Engineering" },
  { code: "MNC", name: "Mathematics & Computing" },
  { code: "MEVLSI", name: "Microelectronics & VLSI" },
  { code: "GE", name: "General Engineering (No Specialization)" },
  { code: "GE-MECH", name: "General Engineering – Mechatronics" },
  { code: "GE-COMM", name: "General Engineering – Communication Tech" },
  { code: "GE-ROBO", name: "General Engineering – AI & Robotics" },
  { code: "BSCS", name: "B.S. Chemical Sciences" },
];

// "" = all batches (default/generic); "2023"/"2024"/"2025" = batch-specific override
const BATCHES = [
  { value: "", label: "All Batches (Default)" },
  { value: "2023", label: "B23 (2023)" },
  { value: "2024", label: "B24 (2024)" },
  { value: "2025", label: "B25 (2025)" },
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

type MappingKey = string; // `${courseId}-${branch}-${batch}`
const mappingKey = (courseId: string, branch: string, batch: string) =>
  `${courseId}-${branch}-${batch}`;

export default function CourseMappingsPage() {
  const { showToast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  // mappings keyed by courseId-branch-batch
  const [mappings, setMappings] = useState<Map<MappingKey, CourseMapping>>(new Map());
  const [selectedBranch, setSelectedBranch] = useState(() => BRANCHES[0]?.code || "");
  const [selectedBatch, setSelectedBatch] = useState(""); // "" = all batches
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Map<MappingKey, Partial<CourseMapping>>>(new Map());

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchMappings(selectedBranch, selectedBatch);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, selectedBatch]);

  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/courses");
      const data = await res.json();
      setCourses(data);
    } catch (error) {
      console.error("Failed to fetch courses:", error);
      showToast("error", "Failed to fetch courses");
    }
  };

  const fetchMappings = async (branch: string, batch: string) => {
    try {
      setLoading(true);
      // Fetch selected batch AND the generic ("") fallback so we can show differences
      const batchParam = batch !== "" ? `&batch=${batch}` : "&batch=";
      const res = await fetch(`/api/course-mappings?branch=${branch}${batchParam}`);
      const data: CourseMapping[] = await res.json();

      const mappingMap = new Map<MappingKey, CourseMapping>();
      data.forEach((m) => {
        mappingMap.set(mappingKey(m.courseId, m.branch, m.batch), m);
      });

      setMappings(mappingMap);
    } catch (error) {
      console.error("Failed to fetch mappings:", error);
      showToast("error", "Failed to fetch course mappings");
    } finally {
      setLoading(false);
    }
  };

  // When looking up a category for a course in the current view:
  // - If editing a batch-specific view, the batch-specific mapping overrides the generic one.
  // - If batch-specific mapping doesn't exist yet, show the generic fallback (greyed out).
  const getEffectiveCategory = (courseId: string): { category: string; isOverride: boolean } => {
    const key = mappingKey(courseId, selectedBranch, selectedBatch);
    const genericKey = mappingKey(courseId, selectedBranch, "");

    const pendingChange = changes.get(key);
    if (pendingChange?.courseCategory) {
      return { category: pendingChange.courseCategory, isOverride: selectedBatch !== "" };
    }

    const batchMapping = selectedBatch !== "" ? mappings.get(key) : undefined;
    if (batchMapping) {
      return { category: batchMapping.courseCategory, isOverride: true };
    }

    const genericMapping = mappings.get(genericKey);
    return { category: genericMapping?.courseCategory ?? "FE", isOverride: false };
  };

  const getDisplaySemester = (courseId: string): string | number => {
    const key = mappingKey(courseId, selectedBranch, selectedBatch);
    const genericKey = mappingKey(courseId, selectedBranch, "");
    return (
      changes.get(key)?.semester ??
      mappings.get(key)?.semester ??
      (selectedBatch !== "" ? (mappings.get(genericKey)?.semester ?? "") : "")
    );
  };

  // Does this course have different mappings across batches?
  const hasBatchDifference = (courseId: string): boolean => {
    const batchValues = BATCHES.filter((b) => b.value !== "").map((b) => {
      const k = mappingKey(courseId, selectedBranch, b.value);
      return mappings.get(k)?.courseCategory;
    }).filter(Boolean);
    const generic = mappings.get(mappingKey(courseId, selectedBranch, ""))?.courseCategory;
    return batchValues.some((v) => v !== generic);
  };

  const handleCategoryChange = (courseId: string, category: string) => {
    const key = mappingKey(courseId, selectedBranch, selectedBatch);
    const existingMapping = mappings.get(key);
    const genericMapping = mappings.get(mappingKey(courseId, selectedBranch, ""));

    setChanges((prev) => new Map(prev).set(key, {
      ...prev.get(key),
      courseId,
      branch: selectedBranch,
      batch: selectedBatch,
      courseCategory: category,
      isRequired: existingMapping?.isRequired ?? genericMapping?.isRequired ?? false,
      semester: existingMapping?.semester ?? genericMapping?.semester ?? null,
    }));
  };

  const handleSemesterChange = (courseId: string, semester: string) => {
    const key = mappingKey(courseId, selectedBranch, selectedBatch);
    const existingMapping = mappings.get(key);
    const genericMapping = mappings.get(mappingKey(courseId, selectedBranch, ""));
    const existing = changes.get(key);

    setChanges((prev) => new Map(prev).set(key, {
      ...existing,
      courseId,
      branch: selectedBranch,
      batch: selectedBatch,
      courseCategory:
        existing?.courseCategory ??
        existingMapping?.courseCategory ??
        genericMapping?.courseCategory ??
        "FE",
      semester: semester ? parseInt(semester) : null,
      isRequired: existingMapping?.isRequired ?? genericMapping?.isRequired ?? false,
    }));
  };

  const handleSaveChanges = async () => {
    if (changes.size === 0) {
      showToast("info", "No changes to save");
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
        showToast("success", `Saved ${changes.size} changes`);
        setChanges(new Map());
        fetchMappings(selectedBranch, selectedBatch);
      } else {
        showToast("error", "Failed to save changes");
      }
    } catch (error) {
      console.error("Failed to save changes:", error);
      showToast("error", "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyBranchDefaults = () => {
    const newChanges = new Map(changes);
    let count = 0;

    for (const course of courses) {
      const key = mappingKey(course.id, selectedBranch, selectedBatch);
      const genericKey = mappingKey(course.id, selectedBranch, "");
      const existingCategory =
        mappings.get(key)?.courseCategory ?? mappings.get(genericKey)?.courseCategory;
      const code = course.code.toUpperCase().replace(/[-\s]/g, "");

      let targetCategory: string | null = null;

      if (selectedBranch === "CSE") {
        if ((code.startsWith("CS") || code.startsWith("DS")) && existingCategory !== "DC") {
          targetCategory = "DE";
        }
      } else if (selectedBranch === "BSCS") {
        if (code.startsWith("CH")) {
          targetCategory = "DC";
        }
      }

      if (targetCategory && existingCategory !== targetCategory) {
        newChanges.set(key, {
          ...newChanges.get(key),
          courseId: course.id,
          branch: selectedBranch,
          batch: selectedBatch,
          courseCategory: targetCategory,
          isRequired: mappings.get(genericKey)?.isRequired || false,
          semester: mappings.get(genericKey)?.semester || null,
        });
        count++;
      }
    }

    setChanges(newChanges);
    showToast("info", count > 0 ? `Queued ${count} defaults — review and save` : "No new defaults to apply");
  };

  const filteredCourses = courses.filter((course) =>
    course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedBatchLabel = BATCHES.find((b) => b.value === selectedBatch)?.label ?? "All Batches";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Course-Branch Mappings
        </h1>
        <p className="text-foreground-secondary">
          Assign course categories (IC, DC, DE, FE, etc.) per branch and batch. Batch-specific mappings override the default for that batch only.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-surface rounded-lg p-4 sm:p-6 space-y-4 border border-border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Branch Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Branch
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setChanges(new Map());
              }}
              className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground"
            >
              {BRANCHES.map((branch) => (
                <option key={branch.code} value={branch.code}>
                  {branch.code} - {branch.name}
                </option>
              ))}
            </select>
          </div>

          {/* Batch Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <Users className="w-4 h-4 inline mr-1" />
              Batch
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => {
                setSelectedBatch(e.target.value);
                setChanges(new Map());
              }}
              className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground"
            >
              {BATCHES.map((batch) => (
                <option key={batch.value} value={batch.value}>
                  {batch.label}
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

          {/* Actions */}
          <div className="flex items-end gap-2">
            {(selectedBranch === "CSE" || selectedBranch === "BSCS") && (
              <button
                onClick={handleApplyBranchDefaults}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground-secondary hover:bg-background-secondary disabled:opacity-50 flex items-center justify-center gap-2"
                title={selectedBranch === "CSE" ? "Set CS-* and DS-* (non-DC) → DE" : "Set CH-* → DC"}
              >
                ✨ Smart defaults
              </button>
            )}
            <button
              onClick={handleSaveChanges}
              disabled={saving || changes.size === 0}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : `Save (${changes.size})`}
            </button>
          </div>
        </div>

        {/* Batch info banner */}
        {selectedBatch !== "" && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div className="text-blue-800 dark:text-blue-300">
              <strong>Batch override mode — {selectedBatchLabel}.</strong> Changes here only apply to {selectedBatchLabel} students.
              Rows without a batch-specific mapping fall back to the "All Batches" default (shown in grey).
              Rows marked <span className="font-semibold text-blue-600 dark:text-blue-400">↗ override</span> already have a {selectedBatchLabel}-specific mapping.
            </div>
          </div>
        )}
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
                  {selectedBatch && ` · ${selectedBatchLabel}`}
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                  Semester
                </th>
                {selectedBatch === "" && (
                  <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                    Batch Diff?
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-foreground-secondary">
                    Loading courses...
                  </td>
                </tr>
              ) : filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-foreground-secondary">
                    No courses found
                  </td>
                </tr>
              ) : (
                filteredCourses.map((course) => {
                  const { category, isOverride } = getEffectiveCategory(course.id);
                  const semester = getDisplaySemester(course.id);
                  const key = mappingKey(course.id, selectedBranch, selectedBatch);
                  const isChanged = changes.has(key);
                  const hasDiff = selectedBatch === "" && hasBatchDifference(course.id);

                  // In batch-specific mode: grey out row if no override exists yet
                  const hasSpecificMapping =
                    selectedBatch === "" ||
                    isOverride ||
                    isChanged;

                  return (
                    <tr
                      key={course.id}
                      className={`hover:bg-background-secondary transition-colors ${
                        isChanged
                          ? "bg-yellow-50 dark:bg-yellow-900/10"
                          : hasDiff
                          ? "bg-purple-50 dark:bg-purple-900/10"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          {course.code}
                          {selectedBatch !== "" && isOverride && !isChanged && (
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                              ↗ override
                            </span>
                          )}
                        </div>
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
                          className={`w-full px-3 py-1.5 border border-border rounded-md bg-background text-sm ${
                            !hasSpecificMapping
                              ? "text-foreground-secondary italic"
                              : "text-foreground"
                          }`}
                        >
                          {COURSE_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                              {selectedBatch !== "" && !isOverride && !isChanged ? " (default)" : ""}
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
                      {selectedBatch === "" && (
                        <td className="px-4 py-3 text-center">
                          {hasDiff && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                              varies
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 text-sm text-foreground-secondary">
        <span>Showing {filteredCourses.length} of {courses.length} courses</span>
        {changes.size > 0 && (
          <span className="text-yellow-600 dark:text-yellow-400 font-medium">
            • {changes.size} unsaved changes
          </span>
        )}
        {selectedBatch === "" && (
          <span className="text-purple-600 dark:text-purple-400">
            • Purple rows have batch-specific overrides
          </span>
        )}
      </div>
    </div>
  );
}
