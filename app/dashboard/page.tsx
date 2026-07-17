import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import { DashboardOverview } from "@/components/DashboardOverviewDynamic";
import Link from "next/link";
import { TimeGreeting } from "@/components/TimeGreeting";
import { ShareProfileButton } from "@/components/ShareProfileButton";
import { loadDashboardEnrollments } from "@/lib/enrollmentsQuery";
import { inferAcademicState, inferBatchYear } from "@/lib/academicCalendar";
import {
  BookOpen,
  GraduationCap,
  Calendar,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  CalendarCheck,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";

export default async function DashboardPage() {
  const session = await getSession();
  const firstName = session?.user?.name?.split(" ")[0] || "there";
  const batchYear = inferBatchYear(session?.user?.batch, session?.user?.enrollmentId);
  const academicState = batchYear ? inferAcademicState(batchYear) : null;

  // Fetch stats directly from DB — no self-fetch
  let currentSemester = 1;
  let activeCoursesCount = 0;
  let completedCoursesCount = 0;
  let isProfileShared = false;
  let shareToken: string | null = null;
  // Prefetch cheap server-side data for DashboardOverview (eliminates all 3 client API calls)
  let dashboardUserSettings: any = null;
  // Full enrollment payload (same shape as GET /api/enrollments) so the client
  // component can hydrate React Query with initialData and skip the fetch.
  let initialEnrollments: any[] = [];

  if (session?.user?.id) {
    try {
      const [enrollments, userRecord, primaryProgram] = await Promise.all([
        loadDashboardEnrollments(session.user.id),
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            doingMTP: true,
            doingMTP2: true,
            doingISTP: true,
            totalPassFailCredits: true,
            isProfileShared: true,
            shareToken: true,
          },
        }),
        prisma.userProgram.findFirst({
          where: { userId: session.user.id, isPrimary: true },
          select: { program: { select: { totalCreditsRequired: true, icCredits: true } } },
        }),
      ]);

      initialEnrollments = enrollments;

      const inProgress = enrollments.filter((e) => e.status === "IN_PROGRESS");
      if (academicState?.currentSemester) {
        currentSemester = academicState.currentSemester;
      } else if (inProgress.length > 0) {
        currentSemester = Math.max(...inProgress.map((e) => e.semester || 0));
      } else {
        const sems = enrollments.map((e) => e.semester || 0).filter(Boolean);
        currentSemester = sems.length > 0 ? Math.max(...sems) : 1;
      }

      activeCoursesCount = inProgress.filter(
        (e) => e.semester === currentSemester
      ).length;

      completedCoursesCount = enrollments.filter(
        (e) => e.status === "COMPLETED" && e.grade !== "F"
      ).length;

      isProfileShared = userRecord?.isProfileShared ?? false;
      shareToken = userRecord?.shareToken ?? null;

      // Pass user settings + academic state — cheap, already in memory, saves 2 client API calls
      dashboardUserSettings = {
        branch: session.user.branch ?? null,
        batch: session.user.batch ?? null,
        enrollmentId: session.user.enrollmentId ?? null,
        doingMTP: userRecord?.doingMTP ?? true,
        doingMTP2: userRecord?.doingMTP2 ?? true,
        doingISTP: userRecord?.doingISTP ?? true,
        totalPassFailCredits: userRecord?.totalPassFailCredits ?? 0,
        programIcCredits: primaryProgram?.program?.icCredits ?? 60,
        role: session.user.role ?? "STUDENT",
      };
    } catch {
      // keep defaults
    }
  }
  
  const enrollmentId = (session?.user?.enrollmentId || "").toUpperCase();
  // B23243 (admin) sees the pre-registration banner as a permanent preview
  // so they can verify how it looks before it goes live in mid-June.
  const isAdminPreview = enrollmentId === "B23243";
  const isPreReg = isAdminPreview || academicState?.phase === "PRE_REGISTRATION";
  const upcomingSemester = isAdminPreview && academicState?.phase !== "PRE_REGISTRATION"
    ? (academicState?.currentSemester ?? 6) + 1
    : (academicState?.upcomingSemester ?? null);

  const quickActions = [
    {
      title: "Browse Courses",
      description: "Explore available courses and enroll",
      href: "/dashboard/courses",
      icon: BookOpen,
      iconBg: "bg-info/10",
      iconText: "text-info",
      hoverBorder: "hover:border-info/30",
    },
    {
      title: "View Programs",
      description: "Check your program requirements",
      href: "/dashboard/programs",
      icon: GraduationCap,
      iconBg: "bg-primary/10",
      iconText: "text-primary",
      hoverBorder: "hover:border-primary/30",
    },
    {
      title: "Track Progress",
      description: "Monitor your academic journey",
      href: "/dashboard/progress",
      icon: TrendingUp,
      iconBg: "bg-success/10",
      iconText: "text-success",
      hoverBorder: "hover:border-success/30",
    },
    {
      title: "Plan Timetable",
      description: "Organize your class schedule",
      href: "/dashboard/timetable",
      icon: Calendar,
      iconBg: "bg-warning/10",
      iconText: "text-warning",
      hoverBorder: "hover:border-warning/30",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-5 sm:pb-6">
        <div className="text-sm text-foreground-secondary">
          <TimeGreeting />
        </div>

        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Welcome back, {firstName}
        </h1>

        {session?.user?.branch && session?.user?.batch ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-foreground-secondary">
            <span className="border border-border bg-background px-2.5 py-1">{session.user.branch}</span>
            <span className="border border-border bg-background px-2.5 py-1">Batch {session.user.batch}</span>
            {session.user.enrollmentId && (
              <span className="border border-border bg-background px-2.5 py-1">{session.user.enrollmentId}</span>
            )}
            <ShareProfileButton isShared={isProfileShared} shareToken={shareToken} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-foreground-secondary">
            Review your courses, credits, and current-semester plan.
          </p>
        )}
      </header>

      {/* Pre-Registration Banner */}
      {isPreReg && upcomingSemester && (
        <div className="border border-success/30 bg-success/5">
          <div className="flex flex-col items-start gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center bg-success/10">
              <CalendarCheck className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-success">
                Pre-Registration Open — Semester {upcomingSemester}
              </p>
              <p className="mt-0.5 text-sm text-foreground-secondary">
                Your Semester {upcomingSemester - 1} courses have been marked complete. You can now
                add courses for the upcoming Fall semester.
              </p>
            </div>
            <a
              href="/dashboard/pre-registration"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-success text-white text-sm font-medium hover:bg-success/90 transition-colors"
            >
              Plan Courses
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

      {/* Current status */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">Current status</h2>
        <div className="grid grid-cols-1 divide-y divide-border border border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <StatCard
            icon={<BookOpen className="w-full h-full" />}
            label="Current Semester"
            value={currentSemester}
            valueColor="text-primary"
            iconBg="bg-primary/10"
            iconColor="text-primary"
            accentBgColor="bg-primary/10"
            delay={0}
          />

          <StatCard
            icon={<TrendingUp className="w-full h-full" />}
            label="Active Courses"
            value={activeCoursesCount}
            sublabel="This semester"
            valueColor="text-success"
            iconBg="bg-success/10"
            iconColor="text-success"
            accentBgColor="bg-success/10"
            delay={0.1}
          />

          <StatCard
            icon={<CheckCircle className="w-full h-full" />}
            label="Courses Completed"
            value={completedCoursesCount}
            sublabel="Total progress"
            valueColor="text-info"
            iconBg="bg-info/10"
            iconColor="text-info"
            accentBgColor="bg-info/10"
            delay={0.2}
          />
        </div>
      </div>

      {/* Shortcuts */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Shortcuts</h2>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex min-w-0 items-center gap-3 bg-surface px-4 py-3.5 transition-colors hover:bg-background-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${action.iconText}`} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium text-foreground">
                    {action.title}
                  </h3>
                  <p className="mt-0.5 hidden text-xs text-foreground-secondary sm:block">
                    {action.description}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-foreground-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Overview */}
      <DashboardOverview
        userId={session?.user?.id!}
        initialUserSettings={dashboardUserSettings}
        initialAcademicState={academicState ? { currentSemester: academicState.currentSemester ?? null } : null}
        initialEnrollments={initialEnrollments}
      />

    </div>
  );
}
