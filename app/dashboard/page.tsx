import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DashboardOverview } from "@/components/DashboardOverview";
import Link from "next/link";
import { TimeGreeting } from "@/components/TimeGreeting";
import { 
  BookOpen, 
  GraduationCap, 
  Calendar, 
  TrendingUp,
  Award,
  Target,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle
} from "lucide-react";
import { StatCard } from "@/components/StatCard";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const firstName = session?.user?.name?.split(" ")[0] || "there";

  // Fetch stats directly from DB — no self-fetch
  let currentSemester = 1;
  let activeCoursesCount = 0;
  let completedCoursesCount = 0;
  let totalCreditsRequired = 160;
  let doingMTP = true;

  if (session?.user?.id) {
    try {
      const [enrollments, userRecord, primaryProgram] = await Promise.all([
        prisma.courseEnrollment.findMany({
          where: { userId: session.user.id },
          select: { status: true, semester: true, grade: true },
        }),
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: { doingMTP: true },
        }),
        prisma.userProgram.findFirst({
          where: { userId: session.user.id, isPrimary: true },
          select: { program: { select: { totalCreditsRequired: true } } },
        }),
      ]);

      const inProgress = enrollments.filter((e) => e.status === "IN_PROGRESS");
      if (inProgress.length > 0) {
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

      if (primaryProgram?.program?.totalCreditsRequired) {
        totalCreditsRequired = primaryProgram.program.totalCreditsRequired;
      }
      if (userRecord?.doingMTP !== undefined) {
        doingMTP = userRecord.doingMTP;
      }
    } catch {
      // keep defaults
    }
  }
  
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
    <div className="space-y-4 sm:space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10"
          aria-hidden="true"
        />

        <div className="relative p-6 sm:p-8 md:p-10">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground-secondary">
            <Sparkles className="w-4 h-4 text-primary" />
            <TimeGreeting />
          </div>

          <h1 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            Welcome back, {firstName}
          </h1>

          {session?.user?.branch && session?.user?.batch ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-full border border-border bg-background-secondary/70 text-sm font-medium text-foreground-secondary">
                {session.user.branch}
              </span>
              <span className="px-3 py-1.5 rounded-full border border-border bg-background-secondary/70 text-sm font-medium text-foreground-secondary">
                Batch {session.user.batch}
              </span>
              {session.user.enrollmentId && (
                <span className="px-3 py-1.5 rounded-full border border-border bg-background-secondary/70 text-sm font-medium text-foreground-secondary">
                  {session.user.enrollmentId}
                </span>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm sm:text-base text-foreground-secondary max-w-2xl">
              Track your academic progress, plan your courses, and keep everything in one place.
            </p>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div>
        <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4">Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
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

      {/* Quick Actions Grid */}
      <div>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Quick Actions</h2>
          <span className="text-xs sm:text-sm text-foreground-secondary hidden sm:block">Jump to what you need</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className={`group relative overflow-hidden bg-surface rounded-xl border border-border p-4 sm:p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-px will-change-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 min-w-0 ${action.hoverBorder}`}
              >
                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-br from-background-secondary/60 via-transparent to-background-secondary/60" />

                <div className="relative z-10">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${action.iconBg} flex items-center justify-center mb-3 sm:mb-4 transition-transform duration-200 group-hover:scale-[1.03]`}>
                    <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${action.iconText}`} />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm sm:text-base mb-1 sm:mb-2 group-hover:text-primary transition-colors truncate">
                    {action.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-foreground-secondary hidden sm:block mb-4">
                    {action.description}
                  </p>
                  <div className="hidden sm:flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Get started
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Overview */}
      <DashboardOverview userId={session?.user?.id!} />

      {/* Tips & Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl border border-border p-6 shadow-sm border-l-4 border-l-info/40">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-info/10 rounded-xl border border-info/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-info" />
            </div>
            <h3 className="font-semibold text-foreground">Academic Goals</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
              <span className="text-foreground-secondary">Complete {totalCreditsRequired} credits for degree</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
              <span className="text-foreground-secondary">Maintain CGPA above 8.0 for honours</span>
            </li>
            {doingMTP && (
              <li className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                <span className="text-foreground-secondary">Complete MTP in final year</span>
              </li>
            )}
          </ul>
        </div>

        <div className="bg-surface rounded-xl border border-border p-6 shadow-sm border-l-4 border-l-primary/40">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-center">
              <Award className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Quick Tips</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <span className="text-foreground-secondary">Plan your electives based on interests</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 bg-secondary rounded-full mt-2 flex-shrink-0"></div>
              <span className="text-foreground-secondary">Check prerequisites before enrolling</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <span className="text-foreground-secondary">Track your credit distribution regularly</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
