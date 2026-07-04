"use client";

import { useMemo, useState } from "react";
import { ChevronDown, GitCompareArrows } from "lucide-react";
import { formatCredits } from "@/lib/utils";
import type { SharedCourseRow } from "@/components/SharedProfileView";

type CourseDiffProps = {
  profileName: string;
  profileCourses: SharedCourseRow[];
  viewerCourses: SharedCourseRow[];
};

const categoryOrder = ["IC", "IC_BASKET", "DC", "DE", "FE", "HSS", "MTP", "ISTP"];

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  IC: { bg: "bg-info/10", text: "text-info", border: "border-info/20" },
  IC_BASKET: { bg: "bg-accent/10", text: "text-accent", border: "border-accent/20" },
  DC: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
  DE: { bg: "bg-secondary/10", text: "text-secondary", border: "border-secondary/20" },
  FE: { bg: "bg-success/10", text: "text-success", border: "border-success/20" },
  HSS: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20" },
  MTP: { bg: "bg-error/10", text: "text-error", border: "border-error/20" },
  ISTP: { bg: "bg-accent/10", text: "text-accent", border: "border-accent/20" },
};

function uniqueCourses(courses: SharedCourseRow[]) {
  const byCode = new Map<string, SharedCourseRow>();
  courses.forEach((course) => {
    if (!byCode.has(course.code)) byCode.set(course.code, course);
  });
  return Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code));
}

function groupByCategory(courses: SharedCourseRow[]) {
  const grouped = courses.reduce<Record<string, SharedCourseRow[]>>((acc, course) => {
    if (!acc[course.category]) acc[course.category] = [];
    acc[course.category].push(course);
    return acc;
  }, {});

  return Object.entries(grouped).sort(([a], [b]) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

function CategoryBadge({ category }: { category: string }) {
  const colors = categoryColors[category] ?? {
    bg: "bg-foreground-muted/10",
    text: "text-foreground-muted",
    border: "border-border",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${colors.bg} ${colors.border}`}>
      <span className={`text-xs font-semibold ${colors.text}`}>{category}</span>
    </span>
  );
}

function DiffColumn({
  title,
  courses,
  accent,
}: {
  title: string;
  courses: SharedCourseRow[];
  accent: "green" | "orange";
}) {
  const groups = groupByCategory(courses);
  const accentClasses =
    accent === "green"
      ? "border-success/30 bg-success/5"
      : "border-warning/30 bg-warning/5";

  return (
    <div className={`rounded-lg border p-4 ${accentClasses}`}>
      <h3 className="font-semibold text-foreground">{title}</h3>
      {courses.length === 0 ? (
        <p className="mt-3 text-sm text-foreground-secondary">No differences in this direction.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {groups.map(([category, categoryCourses]) => (
            <div key={category}>
              <div className="mb-2">
                <CategoryBadge category={category} />
              </div>
              <div className="space-y-2">
                {categoryCourses.map((course) => (
                  <div
                    key={course.code}
                    className="rounded-md border border-border bg-surface px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-foreground">
                          {course.code}
                        </p>
                        <p className="text-sm text-foreground-secondary truncate">
                          {course.name}
                        </p>
                      </div>
                      <span className="text-xs text-foreground-secondary whitespace-nowrap">
                        {formatCredits(course.credits)} cr
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CourseDiff({
  profileName,
  profileCourses,
  viewerCourses,
}: CourseDiffProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { profileOnly, viewerOnly } = useMemo(() => {
    const profileUnique = uniqueCourses(profileCourses);
    const viewerUnique = uniqueCourses(viewerCourses);
    const profileCodes = new Set(profileUnique.map((course) => course.code));
    const viewerCodes = new Set(viewerUnique.map((course) => course.code));

    return {
      profileOnly: profileUnique.filter((course) => !viewerCodes.has(course.code)),
      viewerOnly: viewerUnique.filter((course) => !profileCodes.has(course.code)),
    };
  }, [profileCourses, viewerCourses]);

  return (
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg border border-primary/20 bg-primary/10 flex items-center justify-center">
            <GitCompareArrows className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">Course Differences</h2>
            <p className="text-sm text-foreground-secondary">
              Same-branch comparison
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          aria-expanded={isOpen}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
        >
          <GitCompareArrows className="w-4 h-4" />
          {isOpen ? "Hide Differences" : "Show Differences"}
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {isOpen && (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DiffColumn
            title={`${profileName} has, you do not`}
            courses={profileOnly}
            accent="orange"
          />
          <DiffColumn
            title="You have, they do not"
            courses={viewerOnly}
            accent="green"
          />
        </div>
      )}
    </section>
  );
}
