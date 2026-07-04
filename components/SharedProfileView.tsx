import { Award, BookOpen, ChevronDown, GraduationCap, TrendingUp } from "lucide-react";
import { formatCredits } from "@/lib/utils";

export type SharedCourseRow = {
  semester: number;
  code: string;
  name: string;
  credits: number;
  category: string;
};

export type SharedCategoryProgress = {
  key: string;
  label: string;
  completed: number;
  required: number;
};

export type SharedSemesterCredit = {
  semester: number;
  credits: number;
};

type SharedProfileViewProps = {
  profile: {
    name: string;
    branch: string | null;
    batch: number | null;
  };
  totalCreditsEarned: number;
  totalCreditsRequired: number;
  categoryProgress: SharedCategoryProgress[];
  semesterCredits: SharedSemesterCredit[];
  courses: SharedCourseRow[];
  diff?: React.ReactNode;
};

const categoryColors: Record<string, { bg: string; text: string; bar: string }> = {
  IC: { bg: "bg-info/10", text: "text-info", bar: "bg-info" },
  IC_BASKET: { bg: "bg-accent/10", text: "text-accent", bar: "bg-accent" },
  DC: { bg: "bg-primary/10", text: "text-primary", bar: "bg-primary" },
  DE: { bg: "bg-secondary/10", text: "text-secondary", bar: "bg-secondary" },
  FE: { bg: "bg-success/10", text: "text-success", bar: "bg-success" },
  HSS: { bg: "bg-warning/10", text: "text-warning", bar: "bg-warning" },
  MTP: { bg: "bg-error/10", text: "text-error", bar: "bg-error" },
  ISTP: { bg: "bg-accent/10", text: "text-accent", bar: "bg-accent" },
};

function categoryStyle(category: string) {
  return categoryColors[category] ?? {
    bg: "bg-foreground-muted/10",
    text: "text-foreground-muted",
    bar: "bg-foreground-muted",
  };
}

function CategoryPill({ category }: { category: string }) {
  const colors = categoryStyle(category);

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border border-border ${colors.bg}`}>
      <span className={`text-xs font-semibold ${colors.text}`}>{category}</span>
    </span>
  );
}

export function SharedProfileView({
  profile,
  totalCreditsEarned,
  totalCreditsRequired,
  categoryProgress,
  semesterCredits,
  courses,
  diff,
}: SharedProfileViewProps) {
  const completion =
    totalCreditsRequired > 0
      ? Math.min(100, (totalCreditsEarned / totalCreditsRequired) * 100)
      : 0;
  const coursesBySemester = courses.reduce<Record<number, SharedCourseRow[]>>((acc, course) => {
    if (!acc[course.semester]) acc[course.semester] = [];
    acc[course.semester].push(course);
    return acc;
  }, {});
  const semesters = Object.keys(coursesBySemester)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground-secondary">
              <GraduationCap className="w-4 h-4 text-primary" />
              Shared Academic Profile
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground break-words">
              {profile.name}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.branch && (
                <span className="px-3 py-1.5 rounded-full border border-border bg-background-secondary/70 text-sm font-medium text-foreground-secondary">
                  {profile.branch}
                </span>
              )}
              {profile.batch && (
                <span className="px-3 py-1.5 rounded-full border border-border bg-background-secondary/70 text-sm font-medium text-foreground-secondary">
                  Batch {profile.batch}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 min-w-[12rem]">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Completion</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{Math.round(completion)}%</p>
            <p className="text-sm text-foreground-secondary">
              {formatCredits(totalCreditsEarned)} / {formatCredits(totalCreditsRequired)} credits
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="h-3 w-full overflow-hidden rounded-full bg-background-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${completion}%` }}
              role="progressbar"
              aria-valuenow={Math.round(completion)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </section>

      {diff}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Credit Breakdown</h2>
          </div>
          <div className="space-y-4">
            {categoryProgress.map((category) => {
              const colors = categoryStyle(category.key);
              const denominator =
                category.required > 0
                  ? category.required
                  : Math.max(category.completed, 1);
              const percent = Math.min(100, (category.completed / denominator) * 100);

              return (
                <div key={category.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${colors.bar}`} />
                      <span className="text-sm font-medium text-foreground truncate">
                        {category.label}
                      </span>
                    </div>
                    <span className="text-sm text-foreground-secondary flex-shrink-0">
                      {formatCredits(category.completed)}
                      {category.required > 0 ? ` / ${formatCredits(category.required)}` : ""}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-background-secondary">
                    <div
                      className={`h-full rounded-full ${colors.bar}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Award className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Semester Credits</h2>
          </div>
          {semesterCredits.length === 0 ? (
            <p className="text-sm text-foreground-secondary">No completed credits yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {semesterCredits.map((semester) => (
                <div
                  key={semester.semester}
                  className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-center"
                >
                  <p className="text-xs text-foreground-secondary">Semester {semester.semester}</p>
                  <p className="mt-1 text-xl font-bold text-primary">
                    {formatCredits(semester.credits)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Courses by Semester</h2>
        </div>

        {semesters.length === 0 ? (
          <p className="text-sm text-foreground-secondary">No courses found yet.</p>
        ) : (
          <div className="space-y-3">
            {semesters.map((semester) => {
              const semesterCourses = coursesBySemester[semester] ?? [];
              const semesterTotal = semesterCourses.reduce((sum, course) => sum + course.credits, 0);

              return (
                <details
                  key={semester}
                  className="group rounded-lg border border-border bg-surface-hover/50"
                  open={semester === semesters[semesters.length - 1]}
                >
                  <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">Semester {semester}</p>
                      <p className="text-xs text-foreground-secondary">
                        {semesterCourses.length} courses - {formatCredits(semesterTotal)} credits
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-foreground-secondary transition-transform duration-200 group-open:rotate-180" />
                  </summary>

                  <div className="px-4 pb-4 overflow-x-auto">
                    <table className="min-w-[640px] w-full text-sm">
                      <thead className="text-foreground-secondary">
                        <tr className="border-b border-border">
                          <th className="py-2 pr-4 text-left whitespace-nowrap">Code</th>
                          <th className="py-2 pr-4 text-left min-w-[16rem]">Course</th>
                          <th className="py-2 pr-4 text-right whitespace-nowrap">Credits</th>
                          <th className="py-2 text-left whitespace-nowrap">Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {semesterCourses.map((course) => (
                          <tr
                            key={`${semester}-${course.code}`}
                            className="border-b border-border/60 last:border-0"
                          >
                            <td className="py-2 pr-4 font-semibold text-foreground whitespace-nowrap">
                              {course.code}
                            </td>
                            <td className="py-2 pr-4 text-foreground-secondary">
                              {course.name}
                            </td>
                            <td className="py-2 pr-4 text-right text-foreground whitespace-nowrap">
                              {formatCredits(course.credits)}
                            </td>
                            <td className="py-2 whitespace-nowrap">
                              <CategoryPill category={course.category} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
