"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  X,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { getAllDefaultCourses, DefaultCourse } from "@/lib/defaultCurriculum";
import { useToast } from "@/components/ToastProvider";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { addCredits, formatCourseCode, formatCredits } from "@/lib/utils";
import { OcrConfirmModal, ConfirmRow } from "@/components/OcrConfirmModal";
import { parseTranscriptText, normalizeCourseCode, DetectedCourse } from "@/lib/parseTranscript";
import { courseIdentityKey } from "@/lib/courseIdentity";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";

interface SelectedCourse extends DefaultCourse {
  selected: boolean;
  grade?: string;
}

interface EnrollmentSummary {
  semester: number;
  year?: number;
  term?: string;
  status?: string;
  course: {
    code: string;
  };
}

interface CatalogCourse {
  id: string;
  code: string;
  name: string;
  credits: number;
  department: string;
}

export default function ImportCoursesPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [branch, setBranch] = useState("CSE");
  const [geSubBranch, setGeSubBranch] = useState("GERAI");
  const [userBatch, setUserBatch] = useState<number | null>(null);
  const [batch24Icb1Course, setBatch24Icb1Course] = useState<string | null>(null);
  const [currentSemester, setCurrentSemester] = useState(6);
  const [doingMTP, setDoingMTP] = useState(true);
  const [doingMTP2, setDoingMTP2] = useState(true);
  const [courses, setCourses] = useState<SelectedCourse[]>([]);
  const [importedCourseKeys, setImportedCourseKeys] = useState<Set<string>>(new Set());
  const [catalogIndex, setCatalogIndex] = useState<Record<string, CatalogCourse>>({});
  const [catalogCourses, setCatalogCourses] = useState<CatalogCourse[]>([]);
  const [customQuery, setCustomQuery] = useState("");
  const [customSemester, setCustomSemester] = useState(6);
  const [customResults, setCustomResults] = useState<CatalogCourse[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [expandedSemesters, setExpandedSemesters] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [guideOpen, setGuideOpen] = useState(true);
  const [ocrResults, setOcrResults] = useState<DetectedCourse[]>([]);
  const [ocrRawText, setOcrRawText] = useState("");
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [pastedTranscriptText, setPastedTranscriptText] = useState("");
  const [dbCourseTypeMap, setDbCourseTypeMap] = useState<Map<string, string>>(new Map());

  // Course type map for OCR modal — derived from the branch curriculum
  const effectiveBranch = branch === "GE" ? geSubBranch : branch;
  const { courseTypeMap, dcPrefixes } = useMemo(() => {
    const typeMap = new Map<string, string>();
    const prefixes = new Set<string>();

    // Prefer DB-backed course-category mappings for the branch (more up-to-date than the static curriculum list).
    dbCourseTypeMap.forEach((category, normCode) => {
      typeMap.set(normCode, category);
      if (category === "DC") {
        const pf = /^([A-Z]+)/.exec(normCode)?.[1];
        if (pf) prefixes.add(pf);
      }
    });

    // Hard overrides (DB mappings can be stale):
    // - IC181 is IKS for all batches
    // - IC182 is IKS for Batch 2024/2025
    // - IK593 (Kulhad Economy) is a Free Elective for everyone
    typeMap.set("IC181", "IKS");
    if (userBatch === 2024 || userBatch === 2025) {
      typeMap.set("IC182", "IKS");
    } else {
      // Prevent stale DB mappings from classifying IC182 as IKS for other batches.
      typeMap.set("IC182", "IC");
    }
    typeMap.set("IK593", "FE");

    // Fall back to the static default curriculum for anything missing.
    getAllDefaultCourses(effectiveBranch, 8, userBatch).forEach((c) => {
      const norm = normalizeCourseCode(c.code);
      if (!typeMap.has(norm)) typeMap.set(norm, c.category);
      if (c.category === "DC") {
        const pf = /^([A-Z]+)/.exec(norm)?.[1];
        if (pf) prefixes.add(pf);
      }
    });
    return { courseTypeMap: typeMap, dcPrefixes: prefixes };
  }, [effectiveBranch, dbCourseTypeMap, userBatch]);

  useEffect(() => {
    loadUserSettings();
    loadExistingEnrollments();
    loadCatalogIndex();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadCourseTypeMap = async () => {
      try {
        const res = await fetch(
          `/api/course-category-map?branch=${encodeURIComponent(effectiveBranch)}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        const entries = Object.entries(data?.categoriesByCode ?? {}) as Array<[string, string]>;
        setDbCourseTypeMap(new Map(entries));
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.warn("Failed to load course category map:", err);
      }
    };

    loadCourseTypeMap();
    return () => controller.abort();
  }, [effectiveBranch]);

  useEffect(() => {
    loadDefaultCourses();
  }, [branch, geSubBranch, currentSemester, importedCourseKeys, catalogIndex, doingMTP, doingMTP2, userBatch, batch24Icb1Course]);

  useEffect(() => {
    setCustomSemester(currentSemester);
  }, [currentSemester]);

  const loadUserSettings = async () => {
    try {
      const res = await fetch("/api/user/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.branch) setBranch(data.branch);
        const inferredBatch = inferBatchYear(data.batch, data.enrollmentId);
        setUserBatch(typeof data.batch === "number" ? data.batch : inferredBatch);
        setBatch24Icb1Course(
          typeof data.batch24Icb1Course === "string"
            ? normalizeCourseCode(data.batch24Icb1Course)
            : null
        );

        if (inferredBatch) {
          setCurrentSemester(inferAcademicState(inferredBatch).currentSemester);
        }

        const mtp1 = data.doingMTP ?? true;
        const mtp2 = (data.doingMTP2 ?? mtp1) && mtp1;
        setDoingMTP(mtp1);
        setDoingMTP2(mtp2);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const loadExistingEnrollments = async () => {
    try {
      const res = await fetch("/api/enrollments");
      if (res.ok) {
        const data: EnrollmentSummary[] = await res.json();
        const keys = new Set(
          data
            .filter((e) => e.status !== "DROPPED" && e.status !== "FAILED")
            .map((e) => courseIdentityKey(e.course.code))
            .filter(Boolean)
        );
        setImportedCourseKeys(keys);
      }
    } catch (error) {
      console.error("Failed to load enrollments:", error);
    }
  };

  const loadCatalogIndex = async () => {
    try {
      const res = await fetch("/api/courses");
      if (!res.ok) return;

      const data: CatalogCourse[] = await res.json();
      const index: Record<string, CatalogCourse> = {};

      data.forEach((c) => {
        index[normalizeCourseCode(c.code)] = c;
      });

      setCatalogIndex(index);
      setCatalogCourses(data);
    } catch (error) {
      console.error("Failed to load catalog:", error);
    }
  };

  const loadDefaultCourses = () => {
    const effectiveBranch = branch === "GE" ? geSubBranch : branch;
    const defaultCourses = getAllDefaultCourses(effectiveBranch, currentSemester, userBatch);
    const normalizeCatalog = (code: string) => normalizeCourseCode(code);
    const resolvedCourses = defaultCourses.map((course) => {
      const match = catalogIndex[normalizeCatalog(course.code)];
      if (!match) return course;
      return {
        ...course,
        name: match.name || course.name,
        credits: typeof match.credits === "number" ? match.credits : course.credits,
      };
    });

    const isBatch24 = userBatch === 2024;
    const isBatch25 = userBatch === 2025;
    const isB24EligibleBranch = isBatch24 && ["CSE", "DSE", "EE", "MEVLSI", "MSE"].includes(effectiveBranch);
    const icb1Assigned = isB24EligibleBranch ? batch24Icb1Course : null;
    const ICB1_CODES = new Set(["IC131", "IC136", "IC230"]);

    const filteredResolvedCourses =
      icb1Assigned
        ? resolvedCourses.filter(
            (c) =>
              !(c.category === "ICB" && c.semester === 1 && ICB1_CODES.has(c.code) && c.code !== icb1Assigned)
          )
        : resolvedCourses;
    // Normalize course codes to match enrollment keys
    const normalize = (code: string) => normalizeCourseCode(code);
    // ICB basket + mixed-sem courses start unchecked — user must pick manually
    const MANUAL_PICK_CODES = isBatch24
      ? ["IC140", "IC181", "IC182"]
      : isBatch25
        ? ["IC181", "IC182"]
        : ["IC140", "IC102P", "IC181"];
    // ISTP/MTP courses
    const ISTP_CODES = ["DP 301P", "DP301P"];
    const MTP1_CODES = ["DP 498P", "DP498P"];
    const MTP2_CODES = ["DP 499P", "DP499P"];
    
    const coursesWithSelection = filteredResolvedCourses
      .filter((course) => {
        const normalizedCode = normalize(course.code);
        const isISTP = ISTP_CODES.some((code) => normalize(code) === normalizedCode);
        const isMTP1 = MTP1_CODES.some((code) => normalize(code) === normalizedCode);
        const isMTP2 = MTP2_CODES.some((code) => normalize(code) === normalizedCode);
        // Filter out MTP-1/2 if user disabled MTP entirely
        if (!doingMTP && (isMTP1 || isMTP2)) {
          return false;
        }
        // Filter out MTP-2 if user disabled it (but still doing MTP-1)
        if (doingMTP && !doingMTP2 && isMTP2) {
          return false;
        }
        // Filter out already imported courses
        const identity = courseIdentityKey(course.code);
        return !identity || !importedCourseKeys.has(identity);
      })
      .map((course) => {
        const normalizedCode = normalize(course.code);
        const isISTP = ISTP_CODES.some((code) => normalize(code) === normalizedCode);
        const isMTP1 = MTP1_CODES.some((code) => normalize(code) === normalizedCode);
        const isMTP2 = MTP2_CODES.some((code) => normalize(code) === normalizedCode);
        const isAssignedIcb1 =
          typeof icb1Assigned === "string" &&
          course.category === "ICB" &&
          course.semester === 1 &&
          normalize(course.code) === normalize(icb1Assigned);
        const autoSelected =
          course.category !== "ICB" &&
          !MANUAL_PICK_CODES.includes(course.code) &&
          !course.optional &&
          !isISTP;
        return {
          ...course,
          selected:
            isAssignedIcb1 ||
            autoSelected ||
            isMTP1 ||
            isMTP2,
        };
      });
    setCourses(coursesWithSelection);
  };

  const searchCatalogCourses = async () => {
    const query = customQuery.trim();
    if (!query) return;

    const normalizeCourseCodeForSearch = (text: string) =>
      text.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const queryLower = query.toLowerCase();
    const queryCode = normalizeCourseCodeForSearch(query);

    setCustomLoading(true);
    try {
      // Prefer local search (handles IC112 vs IC-112, etc.) because we already load the catalog once.
      if (catalogCourses.length > 0) {
        const results = catalogCourses.filter((c) => {
          const codeNorm = normalizeCourseCodeForSearch(c.code);
          const codeLower = (c.code || "").toLowerCase();
          const nameLower = (c.name || "").toLowerCase();
          return (
            (queryCode && codeNorm.includes(queryCode)) ||
            codeLower.includes(queryLower) ||
            nameLower.includes(queryLower)
          );
        });
        setCustomResults(results.slice(0, 8));
        return;
      }

      // Fallback: server-side search
      const res = await fetch(`/api/courses?search=${encodeURIComponent(query)}`);
      if (!res.ok) {
        setCustomResults([]);
        return;
      }

      const data: CatalogCourse[] = await res.json();
      setCustomResults(data.slice(0, 8));
    } catch (error) {
      console.error("Failed to search courses:", error);
      setCustomResults([]);
    } finally {
      setCustomLoading(false);
    }
  };

  const addCustomCourse = (course: CatalogCourse) => {
    const identity = courseIdentityKey(course.code);
    if (identity && importedCourseKeys.has(identity)) return;

    setCourses((prev) => {
      const alreadyInSameSemester = prev.some(
        (c) => courseIdentityKey(c.code) === identity && c.semester === customSemester
      );

      // If it's already present for that semester, just select it (and deselect other semesters of the same course).
      if (alreadyInSameSemester) {
        return prev.map((c) => {
          if (courseIdentityKey(c.code) !== identity) return c;
          return { ...c, selected: c.semester === customSemester };
        });
      }

      const category = course.code.toUpperCase().startsWith("HS") ? "HSS" : "FE";

      const newCourse: SelectedCourse = {
        code: course.code,
        name: course.name,
        credits: course.credits,
        category,
        semester: customSemester,
        selected: true,
      };

      // Enforce "one semester per course": adding selects it and deselects other semesters of the same course.
      const next = prev.map((c) => {
        if (courseIdentityKey(c.code) !== identity) return c;
        return { ...c, selected: false };
      });

      return [...next, newCourse];
    });
  };

  const handlePasteExtract = () => {
    const text = pastedTranscriptText.trim();
    if (!text) {
      showToast("warning", "Paste your Samarth transcript text first.");
      return;
    }

    const allDetected = parseTranscriptText(text);
    const seen = new Set<string>();
    const deduped = allDetected.filter((d) => {
      const key = `${normalizeCourseCode(d.rawCode)}|${d.detectedSemester ?? "?"}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setOcrRawText(text);
    setOcrResults(deduped);
    setShowOcrModal(true);
  };

  const addOcrCourses = (confirmedRows: ConfirmRow[]) => {
    let added = 0;
    let updated = 0;
    const toAdd: SelectedCourse[] = [];
    const toSelect = new Map<string, { grade?: string; category: DefaultCourse["category"] }>();
    const touchedIdentities = new Set<string>();

    const selectionKey = (identity: string, semester: number) =>
      `${identity}|${semester}`;

    for (const row of confirmedRows) {
      if (!row.catalogCourseId || row.semester === "") continue;
      const semester = Number(row.semester);

      const catalog = catalogCourses.find((c) => c.id === row.catalogCourseId);
      if (!catalog) continue;

      const identity = courseIdentityKey(catalog.code);
      if (!identity) continue;

      // Skip if already in DB (enrolled in any semester)
      if (importedCourseKeys.has(identity)) continue;

      touchedIdentities.add(identity);

      const existsInSameSemester = courses.some(
        (c) => courseIdentityKey(c.code) === identity && c.semester === semester
      );

      if (existsInSameSemester) {
        toSelect.set(selectionKey(identity, semester), {
          grade: row.grade || undefined,
          category: row.courseType as DefaultCourse["category"],
        });
        updated++;
        continue;
      }

      toAdd.push({
        code: catalog.code,
        name: catalog.name,
        credits: catalog.credits,
        category: row.courseType as DefaultCourse["category"],
        semester,
        selected: true,
        grade: row.grade || undefined,
      });
      added++;
    }

    if (added > 0 || updated > 0) {
      setCourses((prev) => {
        const base = prev.map((c) => {
          const key = courseIdentityKey(c.code);
          if (key && touchedIdentities.has(key)) return { ...c, selected: false };
          return c;
        });

        const withSelected = base.map((c) => {
          const key = courseIdentityKey(c.code);
          if (!key) return c;
          const patch = toSelect.get(selectionKey(key, c.semester));
          if (!patch) return c;
          return {
            ...c,
            selected: true,
            grade: patch.grade ?? c.grade,
            category: patch.category ?? c.category,
          };
        });

        return [...withSelected, ...toAdd];
      });
      showToast("success", `OCR: ${added} added, ${updated} updated`);
    } else {
      showToast("warning", "No new courses to add — they may already be in the list.");
    }
    setShowOcrModal(false);
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
      const clickedIdentity = courseIdentityKey(clicked.code);

      return prev.map((c) => {
        // Toggle the clicked course itself
        if (c.code === code && c.semester === semester) {
          return { ...c, selected: nowSelected };
        }

        if (nowSelected) {
          // Enforce "one semester per course": selecting a course deselects the same course elsewhere.
          if (clickedIdentity && courseIdentityKey(c.code) === clickedIdentity) {
            return { ...c, selected: false };
          }

          const isBatch24 = userBatch === 2024;
          const isBatch25 = userBatch === 2025;
          const crossSemesterExclusive = isBatch24
            ? ["IC140"]
            : isBatch25
              ? []
              : ["IC140", "IC102P", "IC181"];

          // Mixed/paired courses: selecting in one semester deselects the same course in the other (when applicable)
          if (crossSemesterExclusive.includes(code) && c.code === code && c.semester !== semester) {
            return { ...c, selected: false };
          }

          // ICB basket: selecting one deselects all other ICB courses in the SAME semester
          if (clicked.category === "ICB" && c.category === "ICB" && c.semester === semester) {
            return { ...c, selected: false };
          }

          if (isBatch24) {
            // Batch 2024: IC102P is compulsory in Sem-2.
            // Sem-1 choice: IC140 vs IC181. Sem-2 choice: IC140 vs IC182.
            // (IC140 in Sem-1) ↔ (IC182 in Sem-2), and (IC181 in Sem-1) ↔ (IC140 in Sem-2).
            if (code === "IC140" && semester === 1) {
              if (c.code === "IC181" && c.semester === 1) return { ...c, selected: false };
              if (c.code === "IC140" && c.semester === 2) return { ...c, selected: false };
              if (c.code === "IC182" && c.semester === 2) return { ...c, selected: true };
            }
            if (code === "IC140" && semester === 2) {
              if (c.code === "IC182" && c.semester === 2) return { ...c, selected: false };
              if (c.code === "IC140" && c.semester === 1) return { ...c, selected: false };
              if (c.code === "IC181" && c.semester === 1) return { ...c, selected: true };
            }
            if (code === "IC181") {
              if (c.code === "IC140" && c.semester === 1) return { ...c, selected: false };
              if (c.code === "IC182" && c.semester === 2) return { ...c, selected: false };
              if (c.code === "IC140" && c.semester === 2) return { ...c, selected: true };
            }
            if (code === "IC182") {
              if (c.code === "IC140" && c.semester === 2) return { ...c, selected: false };
              if (c.code === "IC181" && c.semester === 1) return { ...c, selected: false };
              if (c.code === "IC140" && c.semester === 1) return { ...c, selected: true };
            }
          } else if (isBatch25) {
            // Batch 2025: Sem-1 offers a direct IC181 vs IC182 IKS choice.
            if (code === "IC181" && c.code === "IC182" && c.semester === semester) {
              return { ...c, selected: false };
            }
            if (code === "IC182" && c.code === "IC181" && c.semester === semester) {
              return { ...c, selected: false };
            }
          } else {
            // IC140 ↔ IC102P pairing: always in opposite semesters (Batch 2023)
            if (code === "IC140" || code === "IC102P") {
              const paired = code === "IC140" ? "IC102P" : "IC140";
              // Auto-select paired course in the OTHER semester
              if (c.code === paired && c.semester !== semester) return { ...c, selected: true };
              // Auto-deselect paired course in the SAME semester
              if (c.code === paired && c.semester === semester) return { ...c, selected: false };
            }
          }
        }

        return c;
      });
    });
  };

  const toggleAllInSemester = (sem: number) => {
    setCourses((prev) => {
      const semCourses = prev.filter((c) => c.semester === sem);
      const allSelected = semCourses.length > 0 && semCourses.every((c) => c.selected);

      if (allSelected) {
        return prev.map((c) => (c.semester === sem ? { ...c, selected: false } : c));
      }

      const selectedElsewhere = new Set(
        prev
          .filter((c) => c.selected && c.semester !== sem)
          .map((c) => courseIdentityKey(c.code))
          .filter(Boolean)
      );

      const selectedInSem = new Set<string>();

      return prev.map((c) => {
        if (c.semester !== sem) return c;
        const key = courseIdentityKey(c.code);

        // Don't select duplicates across semesters (or within this semester)
        if (key) {
          if (selectedElsewhere.has(key)) return { ...c, selected: false };
          if (selectedInSem.has(key)) return { ...c, selected: false };
          selectedInSem.add(key);
        }

        return { ...c, selected: true };
      });
    });
  };

  const updateGrade = (code: string, grade: string) => {
    setCourses(
      courses.map((c) => (c.code === code ? { ...c, grade } : c))
    );
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: "Delete all enrolled courses?",
      message: "This will delete ALL your enrolled courses. This action cannot be undone.",
      confirmText: "Delete all",
      cancelText: "Cancel",
      variant: "danger",
    });
    if (!ok) return;
    setResetting(true);
    try {
      const res = await fetch("/api/enrollments", { method: "DELETE" });
      if (res.ok) {
        setImportedCourseKeys(new Set());
        showToast("success", "All courses deleted. You can now re-import.");
      } else {
        showToast("error", "Failed to delete courses.");
      }
    } catch {
      showToast("error", "An error occurred.");
    } finally {
      setResetting(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const selectedCourses = courses.filter((c) => c.selected);

      const duplicatesByIdentity = new Map<string, SelectedCourse[]>();
      for (const c of selectedCourses) {
        const key = courseIdentityKey(c.code);
        if (!key) continue;
        const list = duplicatesByIdentity.get(key) ?? [];
        list.push(c);
        duplicatesByIdentity.set(key, list);
      }

      const duplicateEntries = Array.from(duplicatesByIdentity.entries()).filter(
        ([, list]) => list.length > 1
      );

      if (duplicateEntries.length > 0) {
        const details = duplicateEntries
          .map(([key, list]) => `${formatCourseCode(key)} (Sem ${list.map((x) => x.semester).join(", ")})`)
          .join("; ");
        const msg = `Same course selected in multiple semesters: ${details}`;
        setErrorMessage(msg);
        showToast("error", msg);
        return;
      }
      
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

      const data = await res.json().catch(() => null);

      if (res.ok) {
        if (data?.summary?.failed > 0) {
          const failedCourses = data.errors?.map((e: any) => e.courseCode).join(', ') || 'Unknown';
          showToast(
            "warning",
            `Imported ${data.summary.successful} courses, but ${data.summary.failed} failed: ${failedCourses}`
          );
          console.warn("❌ Failed courses:", data.errors);
          // Show detailed error message
          const errorDetails = data.errors?.map((e: any) => 
            `${e.courseCode}: ${e.error}`
          ).join('\n');
          setErrorMessage(`Some courses failed to import:\n${errorDetails}`);
        } else {
          showToast("success", `Imported ${data.summary.successful} courses successfully!`);
        }
        setSubmitted(true);
        loadExistingEnrollments();
      } else {
        const msg = data?.error || "Failed to import courses. Please try again.";
        setErrorMessage(msg);
        if (data?.errors?.length) {
          console.warn("Import failures:", data.errors);
        }
        showToast("error", msg);
      }
    } catch (error) {
      console.error("Failed to import courses:", error);
      setErrorMessage("An error occurred. Please try again.");
      showToast("error", "An error occurred. Please try again.");
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
          <div className="w-24 h-24 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-12 w-12 text-success" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Courses Imported Successfully!</h2>
          <p className="text-foreground-secondary mb-6">
            Your courses have been added to your profile. You can now view them in My Courses.
          </p>
          <a
            href="/dashboard/courses"
            className="px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-lg hover:shadow-lg transition-all inline-block"
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
    .reduce((sum, c) => addCredits(sum, c.credits), 0);

  // Pending keys = courses already in the current in-memory list (not yet imported)
  const pendingKeys = new Set(
    courses
      .filter((c) => c.selected)
      .map((c) => courseIdentityKey(c.code))
      .filter(Boolean)
  );

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="bg-error/10 border border-error/20 rounded-lg overflow-hidden">
          <div className="px-4 py-3 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-error mb-1">Import Errors</h3>
              <pre className="text-sm text-error/90 whitespace-pre-wrap font-mono">
                {errorMessage}
              </pre>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-error/80 hover:text-error p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Import Your Courses
          </h1>
          <p className="text-foreground-secondary mt-2">
            Select courses you&apos;ve completed from semesters 1-{currentSemester}
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 text-sm text-error border border-error/20 rounded-lg hover:bg-error/10 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Reset All
        </button>
      </div>

      {/* Configuration */}
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 dark:from-primary/15 dark:to-secondary/15 p-6 rounded-xl border border-primary/20 dark:border-primary/30">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
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
              <option value="DSAI">DSAI</option>
              <option value="EE">EE</option>
              <option value="ME">ME</option>
              <option value="CE">CE</option>
              <option value="BE">BE</option>
              <option value="EP">EP</option>
              <option value="MNC">MNC</option>
              <option value="MSE">MSE</option>
              <option value="GE">GE</option>
              <option value="MEVLSI">MEVLSI</option>
              <option value="BSCS">BSCS (B.S. Chemical Sciences)</option>
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
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Reload Courses
            </button>
          </div>
        </div>
      </div>

      {/* ── Samarth Transcript Import ──────────────────────────────────────── */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {/* Collapsible header */}
        <button
          onClick={() => setGuideOpen((v) => !v)}
          className="w-full flex items-center justify-between p-5 hover:bg-surface-hover transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-secondary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm sm:text-base">
                Import from Samarth Transcript
              </p>
              <p className="text-xs text-foreground-secondary mt-0.5">
                Paste your Samarth course table to auto-detect courses
              </p>
            </div>
          </div>
          {guideOpen ? (
            <ChevronUp className="w-4 h-4 text-foreground-muted shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-foreground-muted shrink-0" />
          )}
        </button>

        {guideOpen && (
          <div className="px-5 pb-5 space-y-5 border-t border-border pt-5">
            {/* Step guide */}
            <ol className="space-y-3">
              {[
                {
                  n: 1,
                  text: "Login to Samarth",
                  sub: "Visit iitmandi.samarth.edu.in and sign in with your credentials",
                  link: "https://iitmandi.samarth.edu.in",
                },
                {
                  n: 2,
                  text: 'Open your "My Courses" / grade card page',
                  sub: "Scroll to the My Courses table (or Course Selection History)",
                },
                {
                  n: 3,
                  text: "Ctrl+A -> Ctrl+C, then paste below",
                  sub: "Extra text is fine - just make sure course codes are included",
                },
              ].map((step) => (
                <li key={step.n} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {step.n}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {step.text}
                      {step.link && (
                        <a
                          href={step.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 ml-2 text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </p>
                    <p className="text-xs text-foreground-secondary mt-0.5">{step.sub}</p>
                  </div>
                </li>
              ))}
            </ol>

            {/* Paste transcript text */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  Paste transcript text (recommended)
                </p>
                <button
                  onClick={() => setPastedTranscriptText("")}
                  disabled={!pastedTranscriptText}
                  className="text-xs px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-foreground/[0.02] disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
              <textarea
                value={pastedTranscriptText}
                onChange={(e) => setPastedTranscriptText(e.target.value)}
                placeholder={`Paste everything from Samarth here (extra text is OK).\nWe will extract course codes like CS-302, IC-102P, HS-342...`}
                className="w-full min-h-[160px] px-3 py-2 rounded-xl border border-border bg-background font-mono text-xs"
              />
              <button
                onClick={handlePasteExtract}
                disabled={!pastedTranscriptText.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-white font-medium text-sm hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                Extract Courses from Pasted Text
              </button>
              <p className="text-xs text-foreground-secondary">
                Tip: extra text is fine - just make sure course codes are included.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* OCR Confirm Modal */}
      {showOcrModal && (
        <OcrConfirmModal
          detected={ocrResults}
          catalogCourses={catalogCourses}
          courseTypeMap={courseTypeMap}
          dcPrefixes={dcPrefixes}
          importedKeys={importedCourseKeys}
          pendingKeys={pendingKeys}
          rawOcrText={ocrRawText}
          onConfirm={addOcrCourses}
          onClose={() => setShowOcrModal(false)}
        />
      )}

      {/* Quick Add (Missing Course) */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          Missing a course? Quick Add from Catalog
        </h3>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder="Search by code or name (e.g., HS342 German)"
            className="w-full px-3 py-2 rounded-lg border bg-background"
          />
          <div className="flex gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-foreground-secondary">Semester</label>
              <input
                type="number"
                min={1}
                max={8}
                value={customSemester}
                onChange={(e) => setCustomSemester(Number(e.target.value))}
                className="w-28 px-3 py-2 rounded-lg border bg-background"
              />
            </div>
            <button
              onClick={searchCatalogCourses}
              disabled={customLoading || !customQuery.trim()}
              className="flex-1 self-end px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
            >
              {customLoading ? "Searching..." : "Search"}
            </button>
          </div>
        </div>
        {customResults.length > 0 && (
          <div className="mt-4 grid gap-2">
            {customResults.map((course) => (
              <div
                key={course.id}
                className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-lg border border-border bg-background overflow-hidden"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-mono font-semibold text-primary text-sm sm:text-base shrink-0">
                      {formatCourseCode(course.code)}
                    </p>
                    <span className="text-foreground-secondary shrink-0">—</span>
                    <p className="font-semibold text-foreground text-sm sm:text-base truncate">
                      {course.name}
                    </p>
                  </div>
                  <p className="text-xs sm:text-sm text-foreground-secondary mt-1">
                    {formatCredits(course.credits)} credits • {course.department}
                  </p>
                </div>
                <button
                  onClick={() => addCustomCourse(course)}
                  className="shrink-0 px-3 py-1.5 bg-success text-white rounded-md text-sm font-medium hover:bg-success/90"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="text-sm text-foreground-secondary mb-1">Selected Courses</div>
          <div className="text-3xl font-bold text-primary">{selectedCount}</div>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="text-sm text-foreground-secondary mb-1">Total Credits</div>
          <div className="text-3xl font-bold text-accent">{formatCredits(totalCredits)}</div>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="text-sm text-foreground-secondary mb-1">Semesters</div>
          <div className="text-3xl font-bold text-secondary">1-{currentSemester}</div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-warning/10 border border-warning/20 p-4 rounded-xl flex gap-3">
        <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">
            These are the standard courses for {branch} branch
          </p>
          <p className="text-foreground-secondary mt-1">
            Uncheck any courses you haven&apos;t taken. You can add grades optionally. Additional courses can be added later from &quot;My Courses&quot; page.
          </p>
          <p className="text-foreground-secondary mt-2">
            {userBatch === 2024
              ? "Batch 2024: IC102P is compulsory in Semester 2. Choose IC140/IC181 in Semester 1 and IC140/IC182 in Semester 2 — selecting one will auto-pick the paired option. IC Basket courses allow only one selection per semester."
              : userBatch === 2025
                ? "Batch 2025: IC181 and IC182 are alternative IKS choices in Semester 1, so selecting one deselects the other. IC140 and IC102P are both part of Semester 2. IC Basket courses allow only one selection per semester."
                : "Selecting IC140 in a semester auto-checks IC102P in the other (they always pair across semesters). IC181 is semester-exclusive. IC Basket courses allow only one selection per semester."}
          </p>
        </div>
      </div>

      {/* Ready to Import */}
      {selectedCount > 0 && (
        <div className="my-6 bg-gradient-to-r from-primary to-secondary rounded-xl p-4 sm:p-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-white">
              <p className="text-sm opacity-90">Ready to import</p>
              <p className="font-bold text-lg">
                {selectedCount} courses • {formatCredits(totalCredits)} credits
              </p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading || selectedCount === 0}
              className="w-full sm:w-auto px-8 py-3 bg-surface-elevated text-foreground rounded-lg font-semibold border border-white/10 hover:border-white/20 hover:bg-surface-hover hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      )}

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
              .reduce((sum, c) => addCredits(sum, c.credits), 0);
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
                        <CheckCircle className="h-5 w-5 text-success" />
                      ) : semCourses.some((c) => c.selected) ? (
                        <Circle className="h-5 w-5 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 text-foreground-secondary" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg">Semester {sem}</h3>
                      <p className="text-sm text-foreground-secondary">
                        {selectedInSem} of {semCourses.length} courses • {formatCredits(creditsInSem)} credits
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
                      <p className="text-xs font-semibold text-warning uppercase tracking-wide px-1 pt-1">
                        IC Basket — choose exactly one ↓
                      </p>
                    )}
                    {semCourses.map((course) => (
                      <div
                        key={`${course.code}-${course.semester}`}
                        className={`p-4 rounded-lg border transition-all ${
                              course.selected
                            ? course.category === "ICB"
                              ? "bg-warning/5 border-warning/40"
                              : "bg-primary/5 border-primary/20"
                            : "bg-background-secondary/60 border-border"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                          <button
                            onClick={() => toggleCourse(course.code, course.semester)}
                            className="mt-1"
                          >
                            {course.selected ? (
                              <CheckCircle className="h-5 w-5 text-primary" />
                            ) : (
                              <Circle className="h-5 w-5 text-foreground-secondary" />
                            )}
                          </button>
                           <div className="flex-1 min-w-0">
                             <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 gap-1 mb-2">
                               <span className="font-mono text-sm font-semibold text-primary whitespace-nowrap">
                                 {formatCourseCode(course.code)}
                               </span>
                               <span className="text-sm text-foreground break-words">
                                 {course.name}
                               </span>
                             </div>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                course.category === "ICB"
                                  ? "bg-warning/10 text-warning"
                                  : "bg-primary/10 text-primary"
                              }`}>
                                {course.category === "ICB" ? "IC Basket" : course.category}
                              </span>
                              <span className="text-xs text-foreground-secondary">
                                {formatCredits(course.credits)} credits
                              </span>
                              {course.tag && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 font-medium">
                                  {course.tag}
                                </span>
                              )}
                              {course.optional && (
                                <span className="text-[10px] text-foreground-secondary italic">
                                  optional — tick if you took this
                                </span>
                              )}
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

    </div>
  );
}
