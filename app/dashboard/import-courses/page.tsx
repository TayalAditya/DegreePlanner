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
  FileText,
  ImageIcon,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { getAllDefaultCourses, getDefaultCurriculum, DefaultCourse } from "@/lib/defaultCurriculum";
import { useToast } from "@/components/ToastProvider";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { formatCourseCode } from "@/lib/utils";
import { OcrConfirmModal, ConfirmRow } from "@/components/OcrConfirmModal";
import { parseTranscriptText, normalizeCourseCode, DetectedCourse } from "@/lib/parseTranscript";

interface SelectedCourse extends DefaultCourse {
  selected: boolean;
  grade?: string;
}

interface EnrollmentSummary {
  semester: number;
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
  const [currentSemester, setCurrentSemester] = useState(6);
  const [doingMTP, setDoingMTP] = useState(true);
  const [doingISTP, setDoingISTP] = useState(true);
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

  // Samarth OCR import state
  const [guideOpen, setGuideOpen] = useState(true);
  const [ocrFiles, setOcrFiles] = useState<File[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrElapsed, setOcrElapsed] = useState(0);
  const [ocrResults, setOcrResults] = useState<DetectedCourse[]>([]);
  const [ocrRawText, setOcrRawText] = useState("");
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pastedTranscriptText, setPastedTranscriptText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

    // Fall back to the static default curriculum for anything missing.
    getAllDefaultCourses(effectiveBranch).forEach((c) => {
      const norm = normalizeCourseCode(c.code);
      if (!typeMap.has(norm)) typeMap.set(norm, c.category);
      if (c.category === "DC") {
        const pf = /^([A-Z]+)/.exec(norm)?.[1];
        if (pf) prefixes.add(pf);
      }
    });
    return { courseTypeMap: typeMap, dcPrefixes: prefixes };
  }, [effectiveBranch, dbCourseTypeMap]);

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
  }, [branch, geSubBranch, currentSemester, importedCourseKeys, catalogIndex, doingMTP, doingISTP]);

  useEffect(() => {
    setCustomSemester(currentSemester);
  }, [currentSemester]);

  const loadUserSettings = async () => {
    try {
      const res = await fetch("/api/user/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.branch) setBranch(data.branch);
        setDoingMTP(data.doingMTP ?? true);
        setDoingISTP(data.doingISTP ?? true);
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
        const keys = new Set(data.map((e) => `${normalizeCourseCode(e.course.code)}|${e.semester}`));
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
    const defaultCourses = getAllDefaultCourses(effectiveBranch, currentSemester);
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
    // Normalize course codes to match enrollment keys
    const normalize = (code: string) => normalizeCourseCode(code);
    // ICB basket + mixed-sem courses start unchecked — user must pick manually
    const MANUAL_PICK_CODES = ["IC140", "IC102P", "IC181"];
    // ISTP/MTP courses
    const ISTP_CODES = ["DP 301P", "DP301P"];
    const MTP_CODES = ["DP 498P", "DP 499P", "DP498P", "DP499P"];
    
    const coursesWithSelection = resolvedCourses
      .filter((course) => {
        const normalizedCode = normalize(course.code);
        // Filter out ISTP if user disabled it
        if (!doingISTP && ISTP_CODES.some(code => normalize(code) === normalizedCode)) {
          return false;
        }
        // Filter out MTP if user disabled it
        if (!doingMTP && MTP_CODES.some(code => normalize(code) === normalizedCode)) {
          return false;
        }
        // Filter out already imported courses
        return !importedCourseKeys.has(`${normalizedCode}|${course.semester}`);
      })
      .map((course) => {
        const normalizedCode = normalize(course.code);
        const isISTP = ISTP_CODES.some(code => normalize(code) === normalizedCode);
        const isMTP = MTP_CODES.some(code => normalize(code) === normalizedCode);
        return {
          ...course,
          selected: (course.category !== "ICB" && !MANUAL_PICK_CODES.includes(course.code) && !course.optional) || isISTP || isMTP,
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
          return (
            (queryCode && codeNorm.includes(queryCode)) ||
            c.code.toLowerCase().includes(queryLower) ||
            c.name.toLowerCase().includes(queryLower)
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
    // Normalize to check for duplicates
    const normalize = (code: string) => normalizeCourseCode(code);
    const key = `${normalize(course.code)}|${customSemester}`;
    if (importedCourseKeys.has(key)) return;
    if (courses.some((c) => normalize(c.code) === normalize(course.code) && c.semester === customSemester)) return;

    const category = course.code.toUpperCase().startsWith("HS") ? "HSS" : "FE";

    const newCourse: SelectedCourse = {
      code: course.code,
      name: course.name,
      credits: course.credits,
      category,
      semester: customSemester,
      selected: true,
    };

    setCourses((prev) => [...prev, newCourse]);
  };

  // ── OCR helpers ────────────────────────────────────────────────────────────

  const addOcrFiles = (files: FileList | File[]) => {
    const allowed = Array.from(files).filter((f) =>
      ["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(f.type)
    );
    setOcrFiles((prev) => {
      // Dedupe by name+size
      const existing = new Set(prev.map((f) => `${f.name}|${f.size}`));
      return [...prev, ...allowed.filter((f) => !existing.has(`${f.name}|${f.size}`))];
    });
  };

  /** Render each page of a PDF to a canvas blob for OCR */
  const extractImagesFromPdf = async (file: File): Promise<Blob[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import("pdfjs-dist");
    // Resolve worker from the installed package so no CDN needed
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).href;

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const blobs: Blob[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      // Render higher-res pages for better OCR on small fonts (transcripts/timetables).
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page.render as any)({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png")
      );
      blobs.push(blob);
    }
    return blobs;
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

  const handleOcrUpload = async () => {
    if (ocrFiles.length === 0) return;

    setOcrElapsed(0);
    setOcrLoading(true);
    setOcrStatus("Analysing files…");
    ocrTimerRef.current = setInterval(
      () => setOcrElapsed((s) => s + 1),
      1000
    );

    const allDetected: DetectedCourse[] = [];
    // Collect blobs that still need image OCR (images + image-based PDFs)
    const needsOcr: (File | Blob)[] = [];

    try {
      // ── Pass 1: Try fast server-side text extraction for each PDF ──────────
      for (let fi = 0; fi < ocrFiles.length; fi++) {
        const file = ocrFiles[fi];

        if (file.type !== "application/pdf") {
          needsOcr.push(file);
          continue;
        }

        setOcrStatus(`Extracting text — PDF ${fi + 1}/${ocrFiles.length}…`);
        try {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/ocr/parse", { method: "POST", body: fd });
          if (res.ok) {
            const data = await res.json();
            if (data.courses?.length > 0) {
              // Text-based PDF (e.g. timetable) — direct text works, skip OCR
              allDetected.push(...data.courses);
              continue;
            }
          }
        } catch { /* server-side failed — fall through to image OCR */ }

        // Image-based PDF (e.g. Samarth scanned transcript) — render pages → OCR
        setOcrStatus(`Rendering pages — PDF ${fi + 1}/${ocrFiles.length}…`);
        const pages = await extractImagesFromPdf(file);
        needsOcr.push(...pages);
      }

      // ── Pass 2: Run Tesseract only if image files or image-based PDFs exist ─
      let rawTextAccumulated = "";
      if (needsOcr.length > 0) {
        setOcrStatus("Loading OCR model…");
        const { createWorker, PSM } = await import("tesseract.js");
        const worker = await createWorker("eng", 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") {
              setOcrStatus(`OCR: ${Math.round(m.progress * 100)}%…`);
            }
          },
        });
        // Tables/columnar screenshots (Samarth results, timetables) work much better with sparse text mode.
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });

        for (let pi = 0; pi < needsOcr.length; pi++) {
          setOcrStatus(`Reading image ${pi + 1} / ${needsOcr.length}…`);
          const result = await worker.recognize(needsOcr[pi]);
          const text = result.data.text;
          rawTextAccumulated += (rawTextAccumulated ? "\n---\n" : "") + text;
          console.log(`[OCR] image ${pi + 1}: ${text.length} chars`);
          const found = parseTranscriptText(text);
          console.log(`[OCR] image ${pi + 1}: ${found.length} courses found`, found);
          allDetected.push(...found);
        }

        await worker.terminate();
      }
      setOcrRawText(rawTextAccumulated);

      setOcrStatus("Matching courses…");

      // Dedupe across all files by rawCode+semester
      const seen = new Set<string>();
      const deduped = allDetected.filter((d) => {
        const key = `${normalizeCourseCode(d.rawCode)}|${d.detectedSemester ?? "?"}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setOcrResults(deduped);
      setShowOcrModal(true);
    } catch (err) {
      console.error("OCR error:", err);
      showToast("error", "Failed to process files. Try again or use a clearer image.");
    } finally {
      if (ocrTimerRef.current) clearInterval(ocrTimerRef.current);
      setOcrLoading(false);
      setOcrStatus("");
      setOcrElapsed(0);
    }
  };

  const addOcrCourses = (confirmedRows: ConfirmRow[]) => {
    const normalize = (code: string) => code.toUpperCase().replace(/[\s-]/g, "");
    let added = 0;
    const toAdd: SelectedCourse[] = [];

    for (const row of confirmedRows) {
      if (!row.catalogCourseId || row.semester === "") continue;
      const semester = Number(row.semester);

      const catalog = catalogCourses.find((c) => c.id === row.catalogCourseId);
      if (!catalog) continue;

      const key = `${normalize(catalog.code)}|${semester}`;
      // Skip if already in DB or already in the pending list
      if (importedCourseKeys.has(key)) continue;
      if (courses.some((c) => normalize(c.code) === normalize(catalog.code) && c.semester === semester)) continue;

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

    if (added > 0) {
      setCourses((prev) => [...prev, ...toAdd]);
      showToast("success", `${added} course${added !== 1 ? "s" : ""} added to import list`);
    } else {
      showToast("warning", "No new courses to add — they may already be in the list.");
    }
    setShowOcrModal(false);
  };

  // ── End OCR helpers ─────────────────────────────────────────────────────────

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
    .reduce((sum, c) => sum + c.credits, 0);

  // Pending keys = courses already in the current in-memory list (not yet imported)
  const pendingKeys = new Set(
    courses.map((c) => `${normalizeCourseCode(c.code)}|${c.semester}`)
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
                Paste your Samarth course table or upload screenshots/PDF to auto-detect courses
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
                  sub: "Copy-paste the table text (recommended), or upload screenshots/PDF",
                },
                {
                  n: 3,
                  text: "Recommended: Ctrl+A -> Ctrl+C, then paste below",
                  sub: "Extra text is fine - as long as course codes are included",
                },
                {
                  n: 4,
                  text: "Fallback: upload screenshots/PDF and click Extract",
                  sub: "Accepts PNG, JPG, WebP, and PDF - multiple files supported",
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
                disabled={!pastedTranscriptText.trim() || ocrLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-white font-medium text-sm hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                Extract Courses from Pasted Text
              </button>
              <p className="text-xs text-foreground-secondary">
                Tip: extra text is fine - just make sure course codes are included.
              </p>
            </div>

            <div className="text-xs text-foreground-muted text-center">or</div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                addOcrFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-foreground/[0.02]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files && addOcrFiles(e.target.files)}
              />
              <Upload className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">
                Drop files here or click to browse
              </p>
              <p className="text-xs text-foreground-secondary mt-1">
                PNG, JPG, WebP, PDF — multiple files supported
              </p>
            </div>

            {/* Selected files list */}
            {ocrFiles.length > 0 && (
              <div className="space-y-2">
                {ocrFiles.map((f, i) => (
                  <div
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-background"
                  >
                    {f.type === "application/pdf" ? (
                      <FileText className="w-4 h-4 text-error shrink-0" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-info shrink-0" />
                    )}
                    <span className="text-sm text-foreground flex-1 truncate">{f.name}</span>
                    <button
                      onClick={() => setOcrFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="p-1 hover:bg-foreground/5 rounded text-foreground-muted hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Extract button + progress */}
            <div className="space-y-2">
              <button
                onClick={handleOcrUpload}
                disabled={ocrFiles.length === 0 || ocrLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-white font-medium text-sm hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {ocrLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span className="truncate">{ocrStatus || "Extracting…"}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 shrink-0" />
                    Extract Courses from {ocrFiles.length > 0 ? `${ocrFiles.length} file${ocrFiles.length !== 1 ? "s" : ""}` : "Files"}
                  </>
                )}
              </button>

              {ocrLoading && (
                <div className="flex items-center justify-between text-xs text-foreground-secondary px-1">
                  <span className="truncate max-w-[70%]">{ocrStatus}</span>
                  <span className="font-mono shrink-0 ml-2 tabular-nums">
                    {Math.floor(ocrElapsed / 60) > 0
                      ? `${Math.floor(ocrElapsed / 60)}m ${ocrElapsed % 60}s`
                      : `${ocrElapsed}s`}
                  </span>
                </div>
              )}
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
                    {course.credits} credits • {course.department}
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
          <div className="text-3xl font-bold text-accent">{totalCredits}</div>
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
                                {course.credits} credits
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

      {/* Submit Button */}
      <div className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-r from-primary to-secondary rounded-xl p-4 sm:p-6 shadow-2xl">
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
    </div>
  );
}
