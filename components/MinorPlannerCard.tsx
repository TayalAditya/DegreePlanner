"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, GraduationCap } from "lucide-react";
import { MINORS, type MinorDefinition, type MinorRequirementGroup } from "@/lib/minors";
import { MINOR_PLANNER_STORAGE_KEYS } from "@/lib/minorPlannerClient";
import { formatCourseCode } from "@/lib/utils";

type EnrollmentLike = {
  status: string;
  grade?: string | null;
  course: {
    code: string;
    name?: string;
    credits?: number;
  };
};

interface MinorPlannerCardProps {
  enrollments: EnrollmentLike[];
  isLoading?: boolean;
}

type CourseState = {
  code: string;
  name?: string;
  credits: number;
  isCompleted: boolean;
  isInProgress: boolean;
};

type GroupProgress = {
  group: MinorRequirementGroup;
  completedCodes: string[];
  inProgressCodes: string[];
  notStartedCodes: string[];
  countedCompletedCodes: string[];
  countedInProgressCodes: string[];
  countedCompletedCredits: number;
  countedInProgressCredits: number;
  isConfigMissing: boolean;
};

type MinorProgressSummary = {
  minor: MinorDefinition;
  requiredCourses: number;
  coveredCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  remainingCourses: number;
  countedCompletedCredits: number;
  countedInProgressCredits: number;
  groups: GroupProgress[];
};

type CountedCourseCodesByMinor = Record<string, string[]>;

const STORAGE_KEYS = MINOR_PLANNER_STORAGE_KEYS;

function isPassingCompletion(enrollment: EnrollmentLike): boolean {
  if (enrollment.status !== "COMPLETED") return false;
  const grade = (enrollment.grade ?? "").trim().toUpperCase();
  return grade !== "F";
}

function buildCourseStateByCode(enrollments: EnrollmentLike[]): Map<string, CourseState> {
  const byCode = new Map<string, CourseState>();

  for (const enrollment of enrollments) {
    const code = formatCourseCode(enrollment?.course?.code ?? "");
    if (!code) continue;

    const existing = byCode.get(code) ?? {
      code,
      name: enrollment.course?.name,
      credits: enrollment.course?.credits ?? 0,
      isCompleted: false,
      isInProgress: false,
    };

    if (!existing.name && enrollment.course?.name) existing.name = enrollment.course.name;
    if (!existing.credits && enrollment.course?.credits) existing.credits = enrollment.course.credits;

    if (isPassingCompletion(enrollment)) {
      existing.isCompleted = true;
      existing.isInProgress = false;
    } else if (enrollment.status === "IN_PROGRESS" && !existing.isCompleted) {
      existing.isInProgress = true;
    }

    byCode.set(code, existing);
  }

  return byCode;
}

function normalizeGroupCodes(group: MinorRequirementGroup): string[] {
  const normalized = group.courseCodes
    .map((c) => formatCourseCode(c))
    .filter((c) => Boolean(c));

  return Array.from(new Set(normalized));
}

function formatCodeList(codes: string[], limit = 6): string {
  if (codes.length === 0) return "\u2014";
  const shown = codes.slice(0, limit);
  const suffix = codes.length > limit ? ` (+${codes.length - limit} more)` : "";
  return `${shown.join(", ")}${suffix}`;
}

function computeMinorProgress(
  minor: MinorDefinition,
  courseStateByCode: Map<string, CourseState>,
  countedCourseCodes: Set<string>
): MinorProgressSummary {
  const groups: GroupProgress[] = minor.groups.map((group) => {
    const codes = normalizeGroupCodes(group);
    const isConfigMissing = codes.length === 0;

    const completedCodes = codes.filter((c) => courseStateByCode.get(c)?.isCompleted);
    const inProgressCodes = codes.filter(
      (c) => !courseStateByCode.get(c)?.isCompleted && courseStateByCode.get(c)?.isInProgress
    );
    const notStartedCodes = codes.filter(
      (c) => !courseStateByCode.get(c)?.isCompleted && !courseStateByCode.get(c)?.isInProgress
    );

    const countedCompletedCodes = completedCodes
      .filter((c) => countedCourseCodes.has(c))
      .slice(0, group.requiredCount);
    const remainingSlots = Math.max(0, group.requiredCount - countedCompletedCodes.length);
    const countedInProgressCodes = inProgressCodes
      .filter((c) => countedCourseCodes.has(c))
      .slice(0, remainingSlots);

    const countedCompletedCredits = countedCompletedCodes.reduce((sum, c) => {
      return sum + (courseStateByCode.get(c)?.credits ?? 0);
    }, 0);
    const countedInProgressCredits = countedInProgressCodes.reduce((sum, c) => {
      return sum + (courseStateByCode.get(c)?.credits ?? 0);
    }, 0);

    return {
      group,
      completedCodes,
      inProgressCodes,
      notStartedCodes,
      countedCompletedCodes,
      countedInProgressCodes,
      countedCompletedCredits,
      countedInProgressCredits,
      isConfigMissing,
    };
  });

  const completionGroups = groups.filter((g) => g.group.countsTowardMinor);

  const requiredCourses = completionGroups.reduce((sum, g) => sum + g.group.requiredCount, 0);
  const completedCourses = completionGroups.reduce(
    (sum, g) => sum + Math.min(g.group.requiredCount, g.countedCompletedCodes.length),
    0
  );
  const inProgressCourses = completionGroups.reduce(
    (sum, g) =>
      sum +
      Math.min(
        g.group.requiredCount - g.countedCompletedCodes.length,
        g.countedInProgressCodes.length
      ),
    0
  );
  const coveredCourses = completedCourses + inProgressCourses;
  const remainingCourses = Math.max(0, requiredCourses - coveredCourses);

  const countedCompletedCredits = completionGroups.reduce(
    (sum, g) => sum + g.countedCompletedCredits,
    0
  );
  const countedInProgressCredits = completionGroups.reduce(
    (sum, g) => sum + g.countedInProgressCredits,
    0
  );

  return {
    minor,
    requiredCourses,
    coveredCourses,
    completedCourses,
    inProgressCourses,
    remainingCourses,
    countedCompletedCredits,
    countedInProgressCredits,
    groups,
  };
}

export function MinorPlannerCard({ enrollments, isLoading = false }: MinorPlannerCardProps) {
  const [enabled, setEnabled] = useState(() => {
    try {
      const storedEnabled = localStorage.getItem(STORAGE_KEYS.enabled);
      return storedEnabled === "true";
    } catch {
      return false;
    }
  });

  const [selectedMinorCodes, setSelectedMinorCodes] = useState<string[]>(() => {
    try {
      const storedCodesRaw = localStorage.getItem(STORAGE_KEYS.minorCodes);
      if (storedCodesRaw) {
        const parsed = JSON.parse(storedCodesRaw);
        if (Array.isArray(parsed)) {
          const codes = parsed
            .map((c) => String(c))
            .filter((c) => MINORS.some((m) => m.code === c));
          const unique = Array.from(new Set(codes));
          if (unique.length > 0) return unique;
        }
      }

      const legacy = localStorage.getItem(STORAGE_KEYS.legacyMinorCode);
      if (legacy && MINORS.some((m) => m.code === legacy)) {
        return [legacy];
      }
    } catch {
      // ignore
    }

    return MINORS[0]?.code ? [MINORS[0].code] : [];
  });

  const [countedCourseCodesConfigured, setCountedCourseCodesConfigured] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.countedCourseCodesByMinor) !== null;
    } catch {
      return false;
    }
  });

  const [countedCourseCodesByMinor, setCountedCourseCodesByMinor] = useState<CountedCourseCodesByMinor>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.countedCourseCodesByMinor);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};

      const out: CountedCourseCodesByMinor = {};
      for (const [minorCode, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (!MINORS.some((m) => m.code === minorCode)) continue;
        if (!Array.isArray(value)) continue;
        const unique = Array.from(
          new Set(
            value
              .map((c) => formatCourseCode(String(c ?? "")))
              .filter((c) => Boolean(c))
          )
        );
        out[minorCode] = unique;
      }

      return out;
    } catch {
      return {};
    }
  });

  const availableMinors = useMemo(() => {
    return [...MINORS].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.enabled, String(enabled));
      localStorage.setItem(STORAGE_KEYS.minorCodes, JSON.stringify(selectedMinorCodes));
      if (countedCourseCodesConfigured) {
        localStorage.setItem(
          STORAGE_KEYS.countedCourseCodesByMinor,
          JSON.stringify(countedCourseCodesByMinor)
        );
      } else {
        localStorage.removeItem(STORAGE_KEYS.countedCourseCodesByMinor);
      }
    } catch {
      // ignore
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("degreePlanner:storage"));
    }
  }, [enabled, selectedMinorCodes, countedCourseCodesByMinor, countedCourseCodesConfigured]);

  const courseStateByCode = useMemo(() => buildCourseStateByCode(enrollments), [enrollments]);

  const selectedMinors = useMemo(() => {
    const selectedSet = new Set(selectedMinorCodes);
    return availableMinors.filter((m) => selectedSet.has(m.code));
  }, [availableMinors, selectedMinorCodes]);

  const countableCodesByMinorCode = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const minor of MINORS) {
      const set = new Set<string>();
      for (const group of minor.groups) {
        if (!group.countsTowardMinor) continue;
        for (const rawCode of group.courseCodes) {
          const formatted = formatCourseCode(rawCode);
          if (formatted) set.add(formatted);
        }
      }
      map.set(minor.code, Array.from(set).sort());
    }
    return map;
  }, []);

  const selectedProgress = useMemo(() => {
    return selectedMinors.map((m) => {
      const counted = countedCourseCodesConfigured
        ? new Set(countedCourseCodesByMinor[m.code] ?? [])
        : new Set(countableCodesByMinorCode.get(m.code) ?? []);
      return computeMinorProgress(m, courseStateByCode, counted);
    });
  }, [
    selectedMinors,
    courseStateByCode,
    countedCourseCodesConfigured,
    countedCourseCodesByMinor,
    countableCodesByMinorCode,
  ]);

  const candidateCoursesByMinorCode = useMemo(() => {
    const map = new Map<string, CourseState[]>();

    const statusRank = (c: CourseState) => (c.isCompleted ? 0 : c.isInProgress ? 1 : 2);

    for (const minorCode of selectedMinorCodes) {
      const eligible = countableCodesByMinorCode.get(minorCode) ?? [];
      const list: CourseState[] = [];
      for (const code of eligible) {
        const state = courseStateByCode.get(code);
        if (!state) continue;
        if (!state.isCompleted && !state.isInProgress) continue;
        list.push(state);
      }
      list.sort((a, b) => statusRank(a) - statusRank(b) || a.code.localeCompare(b.code));
      map.set(minorCode, list);
    }

    return map;
  }, [selectedMinorCodes, countableCodesByMinorCode, courseStateByCode]);

  const buildInitialCountedCourseCodesByMinor = (): CountedCourseCodesByMinor => {
    const next: CountedCourseCodesByMinor = {};

    for (const minorCode of selectedMinorCodes) {
      const candidates = candidateCoursesByMinorCode.get(minorCode) ?? [];
      const picked = Array.from(
        new Set(
          candidates
            .map((c) => formatCourseCode(c.code))
            .filter((c) => Boolean(c))
        )
      );
      next[minorCode] = picked;
    }

    return next;
  };

  const updateCourseCounting = (
    updater: (current: CountedCourseCodesByMinor) => CountedCourseCodesByMinor
  ) => {
    if (!countedCourseCodesConfigured) {
      const initial = buildInitialCountedCourseCodesByMinor();
      const updated = updater(initial);
      setCountedCourseCodesByMinor(updated);
      setCountedCourseCodesConfigured(true);
      return;
    }

    setCountedCourseCodesByMinor((prev) => updater(prev));
  };

  const setCourseCountedForMinor = (minorCode: string, courseCode: string, checked: boolean) => {
    const formatted = formatCourseCode(courseCode);
    if (!formatted) return;

    updateCourseCounting((prev) => {
      const next: CountedCourseCodesByMinor = { ...prev };

      if (!Array.isArray(next[minorCode])) next[minorCode] = [];

      if (!checked) {
        next[minorCode] = (next[minorCode] ?? []).filter((c) => c !== formatted);
        return next;
      }

      const cur = new Set(next[minorCode] ?? []);
      cur.add(formatted);
      next[minorCode] = Array.from(cur);
      return next;
    });
  };

  const selectAllCoursesForMinor = (minorCode: string) => {
    const candidates = Array.from(
      new Set(
        (candidateCoursesByMinorCode.get(minorCode) ?? [])
          .map((c) => formatCourseCode(c.code))
          .filter((c) => Boolean(c))
      )
    );

    updateCourseCounting((prev) => {
      const next: CountedCourseCodesByMinor = { ...prev };

      next[minorCode] = candidates;
      return next;
    });
  };

  const clearCoursesForMinor = (minorCode: string) => {
    updateCourseCounting((prev) => ({ ...prev, [minorCode]: [] }));
  };

  const toggleMinor = (code: string) => {
    setSelectedMinorCodes((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      return [...prev, code];
    });
  };

  const selectAllMinors = () => setSelectedMinorCodes(MINORS.map((m) => m.code));
  const clearMinors = () => setSelectedMinorCodes([]);

  if (!MINORS.length) {
    return (
      <div className="bg-surface rounded-lg border border-border p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h3 className="text-base sm:text-lg font-semibold text-foreground">Minor Planner</h3>
        </div>
        <p className="text-sm text-foreground-secondary">No minors are configured.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg border border-border shadow-sm p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <h3 className="text-base sm:text-lg font-semibold text-foreground">Minor Planner</h3>
          </div>
          <p className="text-xs text-foreground-secondary mt-1">
            Toggle this on if you&apos;re planning a minor. Uses your enrollments to show what&apos;s done and what&apos;s left.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground-secondary whitespace-nowrap">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Planning?
        </label>
      </div>

      {enabled && (
        <div className="mt-4 space-y-4">
          <details className="group rounded-lg border border-border bg-surface-hover/50">
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  Select minors{" "}
                  <span className="text-foreground-secondary">({selectedMinors.length} selected)</span>
                </p>
                <p className="text-xs text-foreground-secondary">
                  You can select multiple minors to compare. Use the section below to choose which of your enrolled courses should count toward a minor.
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-foreground-secondary transition-transform duration-200 group-open:rotate-180" />
            </summary>

            <div className="px-4 pb-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllMinors}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-surface hover:bg-surface-hover text-foreground"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearMinors}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-surface hover:bg-surface-hover text-foreground"
                >
                  Clear
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-auto pr-1">
                {availableMinors.map((m) => (
                  <label
                    key={m.code}
                    className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground cursor-pointer hover:bg-surface-hover"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={selectedMinorCodes.includes(m.code)}
                      onChange={() => toggleMinor(m.code)}
                    />
                    <span className="truncate">{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
           </details>

           {selectedMinors.length > 0 && (
             <details className="group rounded-lg border border-border bg-surface-hover/50">
               <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-4">
                 <div className="min-w-0">
                   <p className="font-semibold text-foreground">Count courses towards your minor</p>
                   <p className="text-xs text-foreground-secondary">
                     Selected courses count toward the minor. If any selected course is counted as <span className="font-semibold">DE</span>{" "}
                     in your major, it will be treated as <span className="font-semibold">FE</span> instead (so you&apos;ll need to cover DE credits separately).
                   </p>
                 </div>
                 <ChevronDown className="w-4 h-4 text-foreground-secondary transition-transform duration-200 group-open:rotate-180" />
               </summary>

               <div className="px-4 pb-4 space-y-4">
                  {selectedMinors.map((minor) => {
                    const candidates = candidateCoursesByMinorCode.get(minor.code) ?? [];
                    const countedSet = countedCourseCodesConfigured
                      ? new Set(countedCourseCodesByMinor[minor.code] ?? [])
                      : new Set(candidates.map((c) => c.code));
 
                    return (
                     <div
                       key={minor.code}
                       className="rounded-lg border border-border bg-surface px-3 py-3"
                     >
                       <div className="flex flex-wrap items-start justify-between gap-3">
                         <div className="min-w-0">
                           <p className="text-sm font-semibold text-foreground">{minor.name}</p>
                           <p className="text-xs text-foreground-secondary mt-0.5">
                             Selected{" "}
                             <span className="font-semibold text-foreground">{countedSet.size}</span> /{" "}
                             <span className="font-semibold text-foreground">{candidates.length}</span>{" "}
                             eligible enrolled courses
                           </p>
                         </div>
                         <div className="flex flex-wrap items-center gap-2">
                           <button
                             type="button"
                             onClick={() => selectAllCoursesForMinor(minor.code)}
                             className="px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-surface hover:bg-surface-hover text-foreground"
                           >
                             Select all
                           </button>
                           <button
                             type="button"
                             onClick={() => clearCoursesForMinor(minor.code)}
                             className="px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-surface hover:bg-surface-hover text-foreground"
                           >
                             Clear
                           </button>
                         </div>
                       </div>

                       {candidates.length === 0 ? (
                         <p className="mt-3 text-xs text-foreground-secondary">
                           No eligible enrolled courses found for this minor yet.
                         </p>
                       ) : (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {candidates.map((c) => {
                              const checked = countedSet.has(c.code);
                              const statusLabel = c.isCompleted ? "Completed" : c.isInProgress ? "In progress" : "";

                              return (
                                <label
                                  key={`${minor.code}|${c.code}`}
                                  className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground cursor-pointer hover:bg-surface-hover"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 h-4 w-4 accent-primary"
                                    checked={checked}
                                    onChange={(e) => setCourseCountedForMinor(minor.code, c.code, e.target.checked)}
                                  />
                                  <div className="min-w-0">
                                   <p className="text-sm font-semibold text-foreground">
                                     {c.code}{" "}
                                     <span className="text-[11px] font-semibold text-foreground-secondary">
                                       {statusLabel}
                                       {c.credits ? ` · ${c.credits} cr` : ""}
                                     </span>
                                   </p>
                                    {c.name ? (
                                      <p className="text-xs text-foreground-secondary truncate">{c.name}</p>
                                    ) : null}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                       )}
                     </div>
                   );
                 })}
               </div>
             </details>
           )}

           {selectedMinors.length === 0 ? (
             <div className="rounded-lg border border-border bg-surface-hover/50 p-4 text-sm text-foreground-secondary">
               Select at least one minor to see progress.
             </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {(isLoading ? Array.from({ length: Math.min(2, selectedMinors.length) }) : selectedProgress).map(
                (item: any, idx) => {
                  const progress: MinorProgressSummary | null = isLoading ? null : (item as MinorProgressSummary);

                  return (
                    <div
                      key={progress?.minor.code ?? `skeleton-${idx}`}
                      className="rounded-lg border border-border bg-surface-hover/50 p-4"
                    >
                      {isLoading || !progress ? (
                        <div className="space-y-2 animate-pulse">
                          <div className="h-4 bg-background-secondary dark:bg-background rounded w-1/2"></div>
                          <div className="h-10 bg-background-secondary dark:bg-background rounded"></div>
                          <div className="h-24 bg-background-secondary dark:bg-background rounded"></div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">{progress.minor.name}</p>
                              <p className="text-xs text-foreground-secondary mt-0.5">
                                <span className="font-semibold text-foreground">{progress.coveredCourses}</span> /{" "}
                                <span className="font-semibold text-foreground">{progress.requiredCourses}</span>{" "}
                                courses covered
                                {progress.inProgressCourses > 0 && (
                                  <span className="text-yellow-600 dark:text-yellow-400">
                                    {" "}
                                    (+{progress.inProgressCourses} in progress)
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-foreground-secondary">Remaining</p>
                              <p className="text-sm font-semibold text-foreground">{progress.remainingCourses}</p>
                            </div>
                          </div>

                          <div className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground-secondary">
                            Counted credits:{" "}
                            <span className="font-semibold text-foreground">
                              {progress.countedCompletedCredits + progress.countedInProgressCredits}
                            </span>
                            {progress.minor.totalCreditsRequired ? (
                              <>
                                {" "}
                                {"\u2022"} Required:{" "}
                                <span className="font-semibold text-foreground">
                                  {progress.minor.totalCreditsRequired}
                                </span>
                              </>
                            ) : null}
                          </div>

                          <details className="group mt-3 rounded-lg border border-border bg-surface">
                            <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground">Breakdown</p>
                                <p className="text-xs text-foreground-secondary">
                                  Per requirement group (completed, in-progress, remaining).
                                </p>
                              </div>
                              <ChevronDown className="w-4 h-4 text-foreground-secondary transition-transform duration-200 group-open:rotate-180" />
                            </summary>

                            <div className="px-3 pb-3 space-y-2">
                              {progress.groups.map((g) => {
                                const completedCount = Math.min(
                                  g.group.requiredCount,
                                  g.countedCompletedCodes.length
                                );
                                const inProgressCount = Math.min(
                                  g.group.requiredCount - completedCount,
                                  g.countedInProgressCodes.length
                                );
                                const covered = completedCount + inProgressCount;
                                const remaining = Math.max(0, g.group.requiredCount - covered);

                                return (
                                  <div
                                    key={g.group.id}
                                    className="rounded-lg border border-border bg-surface-hover/50 px-3 py-2"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-foreground">
                                          {g.group.title}
                                          {!g.group.countsTowardMinor && (
                                            <span className="text-xs text-foreground-secondary"> (not counted)</span>
                                          )}
                                        </p>
                                        {g.group.note && (
                                          <p className="text-xs text-foreground-secondary mt-0.5">{g.group.note}</p>
                                        )}
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-semibold text-foreground">
                                          {covered} / {g.group.requiredCount}
                                        </p>
                                        {inProgressCount > 0 && (
                                          <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                            +{inProgressCount} in progress
                                          </p>
                                        )}
                                        {remaining > 0 && (
                                          <p className="text-xs text-foreground-secondary">need {remaining} more</p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                      <div>
                                        <p className="text-foreground-secondary">Completed</p>
                                        <p className="text-foreground">{formatCodeList(g.completedCodes)}</p>
                                      </div>
                                      <div>
                                        <p className="text-foreground-secondary">In progress</p>
                                        <p className="text-foreground">{formatCodeList(g.inProgressCodes)}</p>
                                      </div>
                                      <div>
                                        <p className="text-foreground-secondary">Not started</p>
                                        <p className="text-foreground">
                                          {g.isConfigMissing
                                            ? "Add course codes in lib/minors.ts"
                                            : formatCodeList(g.notStartedCodes)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        </>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
