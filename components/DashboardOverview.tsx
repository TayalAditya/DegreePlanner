"use client";

import { useQuery } from "@tanstack/react-query";
import { ProgressChart } from "./ProgressChart";
import { CreditBreakdownCard } from "./CreditBreakdownCard";
import { BookOpen, TrendingUp, AlertCircle } from "lucide-react";

interface DashboardOverviewProps {
  userId: string;
}

const ICB1_CODES = new Set(["IC131", "IC136", "IC230"]);
const ICB2_CODES = new Set(["IC121", "IC240", "IC241", "IC253"]);

export function DashboardOverview({ userId }: DashboardOverviewProps) {
  const { data: programs, isLoading: programsLoading } = useQuery({
    queryKey: ["user-programs", userId],
    queryFn: async () => {
      const res = await fetch("/api/programs");
      if (!res.ok) throw new Error("Failed to fetch programs");
      return res.json();
    },
  });

  const primaryProgram = programs?.find((p: any) => p.isPrimary);

  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ["progress", primaryProgram?.programId],
    queryFn: async () => {
      if (!primaryProgram) return null;
      const res = await fetch(
        `/api/progress?programId=${primaryProgram.programId}`
      );
      if (!res.ok) throw new Error("Failed to fetch progress");
      return res.json();
    },
    enabled: !!primaryProgram,
  });

  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["enrollments", userId],
    queryFn: async () => {
      const res = await fetch("/api/enrollments");
      if (!res.ok) throw new Error("Failed to fetch enrollments");
      return res.json();
    },
  });

  const { data: userSettings } = useQuery({
    queryKey: ["user-settings"],
    queryFn: async () => {
      const res = await fetch("/api/user/settings");
      if (!res.ok) throw new Error("Failed to fetch user settings");
      return res.json();
    },
  });

  if (programsLoading || !programs) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface rounded-xl border border-border shadow-sm p-6 animate-pulse"
            >
              <div className="h-4 bg-background-secondary dark:bg-background rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-background-secondary dark:bg-background rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="bg-surface rounded-xl shadow-sm border border-border p-12 text-center">
        <div className="w-20 h-20 bg-warning/10 dark:bg-warning/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-warning" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">
          No Programs Enrolled
        </h2>
        <p className="text-foreground-secondary mb-8 max-w-md mx-auto">
          Get started by enrolling in your major program to begin tracking your academic progress
        </p>
        <a
          href="/dashboard/programs"
          className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all shadow-sm hover:shadow-md"
        >
          <BookOpen className="w-5 h-5 mr-2" />
          Browse Programs
        </a>
      </div>
    );
  }

  const currentSemesterFromEligibility =
    progressData?.mtpEligibility?.semesterNumber ||
    progressData?.istpEligibility?.semesterNumber ||
    0;

  const currentSemester =
    enrollments && enrollments.length > 0
      ? Math.max(...enrollments.map((e: any) => e.semester))
      : currentSemesterFromEligibility > 0
        ? currentSemesterFromEligibility
        : 1;

  const currentSemesterEnrollments = enrollments?.filter(
    (e: any) => e.semester === currentSemester && e.status === "IN_PROGRESS"
  );

  const completedCourses = enrollments?.filter(
    (e: any) => e.status === "COMPLETED"
  );

  const completedEnrollments = enrollments?.filter(
    (e: any) => e.status === "COMPLETED" && (!e.grade || e.grade !== "F")
  ) || [];

  const getCourseCategory = (enrollment: any): string => {
    const code = enrollment.course?.code?.toUpperCase() || "";
    const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
    const isICB1 = ICB1_CODES.has(normalizedCode);
    const isICB2 = ICB2_CODES.has(normalizedCode);

    // Branch-specific basket rules
    if (userSettings?.branch) {
      // Sem 1: ICB1 is compulsory. If ICB2 taken → FE
      if ((enrollment.semester || 0) === 1 && isICB2) return "FE";
      
      // Sem 2: Branch-specific
      if ((enrollment.semester || 0) === 2) {
        if (userSettings.branch === "CSE") {
          // CSE Sem 2: IC253 (DSA) is compulsory. Other ICB2 → FE
          if (isICB2 && normalizedCode !== "IC253") return "FE";
        } else {
          // Other branches Sem 2: ICB2 is compulsory. If ICB1 taken → FE
          if (isICB1) return "FE";
        }
      }
    }

    if (isICB1 || isICB2) return "IC_BASKET";

    if (enrollment.course?.branchMappings && enrollment.course.branchMappings.length > 0 && userSettings?.branch) {
      // Map branch code: CSE → CS (since database uses CS code)
      const mappingBranch = userSettings.branch === \"CSE\" ? \"CS\" : userSettings.branch;
      const mapping = enrollment.course.branchMappings.find(
        (m: any) => m.branch === mappingBranch || m.branch === \"COMMON\""
      ) || (userSettings.branch === "GE"
        ? enrollment.course.branchMappings.find((m: any) => m.branch.startsWith("GE"))
        : undefined);

      if (mapping) {
        return mapping.courseCategory;
      }
    }

    // Branch-specific course patterns
    if (userSettings?.branch === "CSE" && normalizedCode.startsWith("DS")) return "DE";
    if (userSettings?.branch === "DSE" && normalizedCode.startsWith("CS")) return "DE";

    if (normalizedCode.startsWith("IC")) return "IC";
    if (normalizedCode.startsWith("HS")) return "HSS";
    if (normalizedCode.startsWith("IKS") || normalizedCode.startsWith("IK")) return "IKS";
    if (normalizedCode.includes("MTP")) return "MTP";
    if (normalizedCode.includes("ISTP")) return "ISTP";
    if (enrollment.courseType === "DE") return "DE";
    if (enrollment.courseType === "FREE_ELECTIVE" || enrollment.courseType === "PE") return "FE";
    return "DC";
  };

  const semesterStats = completedEnrollments.reduce((acc: Record<number, any>, e: any) => {
    const sem = e.semester || 0;
    if (!acc[sem]) {
      acc[sem] = {
        semester: sem,
        total: 0,
        IC: 0,
        IC_BASKET: 0,
        DC: 0,
        DE: 0,
        FE: 0,
        HSS: 0,
        IKS: 0,
        MTP: 0,
        ISTP: 0,
      };
    }
    const category = getCourseCategory(e);
    acc[sem][category] = (acc[sem][category] || 0) + (e.course?.credits || 0);
    acc[sem].total += e.course?.credits || 0;
    return acc;
  }, {});

  const semesterStatsList = Object.values(semesterStats).sort(
    (a: any, b: any) => a.semester - b.semester
  );

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="relative overflow-hidden bg-surface rounded-xl shadow-sm border border-border p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-primary/10 rounded-full blur-2xl"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-foreground-secondary font-medium mb-1">Current Semester</p>
              <p className="text-3xl sm:text-4xl font-bold text-primary">
                {currentSemester}
              </p>
            </div>
            <div className="w-11 h-11 sm:w-14 sm:h-14 bg-primary/10 dark:bg-primary/20 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-surface rounded-xl shadow-sm border border-border p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-success/10 rounded-full blur-2xl"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-foreground-secondary font-medium mb-1">This Semester</p>
              <p className="text-3xl sm:text-4xl font-bold text-success">
                {currentSemesterEnrollments?.length || 0}
              </p>
            </div>
            <div className="w-11 h-11 sm:w-14 sm:h-14 bg-success/10 dark:bg-success/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 sm:w-7 sm:h-7 text-success" />
            </div>
          </div>
          <p className="text-xs text-foreground-secondary mt-2">Active courses</p>
        </div>

        <div className="relative overflow-hidden bg-surface rounded-xl shadow-sm border border-border p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-info/10 rounded-full blur-2xl"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-foreground-secondary font-medium mb-1">Completed</p>
              <p className="text-3xl sm:text-4xl font-bold text-info">
                {completedCourses?.length || 0}
              </p>
            </div>
            <div className="w-11 h-11 sm:w-14 sm:h-14 bg-info/10 dark:bg-info/20 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 sm:w-7 sm:h-7 text-info" />
            </div>
          </div>
          <p className="text-xs text-foreground-secondary mt-2">Total courses</p>
        </div>
      </div>

      {/* Progress Overview */}
      {primaryProgram && progressData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <ProgressChart
            progress={progressData.progress}
            isLoading={progressLoading}
            enrollments={enrollments}
            userBranch={userSettings?.branch}
          />
          <CreditBreakdownCard
            progress={progressData.progress}
            isLoading={progressLoading}
          />
        </div>
      )}

      {enrollmentsLoading ? (
        <div className="bg-surface rounded-xl shadow-sm border border-border p-4 sm:p-6 animate-pulse">
          <div className="h-6 bg-background-secondary dark:bg-background rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border rounded-lg p-4 bg-surface-hover">
                <div className="h-4 bg-background-secondary dark:bg-background rounded w-1/2 mb-2"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-background-secondary dark:bg-background rounded w-1/3"></div>
                  <div className="h-3 bg-background-secondary dark:bg-background rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : semesterStatsList.length > 0 ? (
        <div className="bg-surface rounded-xl shadow-sm border border-border p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4 flex items-center">
            <span className="w-1 h-6 bg-primary rounded-full mr-3"></span>
            Semester-wise Credits (Completed)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {semesterStatsList.map((sem: any) => (
              <div
                key={sem.semester}
                className="border border-border rounded-lg p-4 bg-surface-hover"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-foreground">Semester {sem.semester}</p>
                  <span className="text-sm font-semibold text-primary">{sem.total} credits</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-foreground-secondary">
                  <span>IC: {sem.IC}</span>
                  <span>IC Basket: {sem.IC_BASKET}</span>
                  <span>DC: {sem.DC}</span>
                  <span>DE: {sem.DE}</span>
                  <span>FE: {sem.FE}</span>
                  <span>HSS: {sem.HSS}</span>
                  <span>IKS: {sem.IKS}</span>
                  {(sem.MTP > 0 || sem.ISTP > 0) && (
                    <>
                      {sem.MTP > 0 && <span>MTP: {sem.MTP}</span>}
                      {sem.ISTP > 0 && <span>ISTP: {sem.ISTP}</span>}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Available DE Courses */}
      {progressData?.availableDECourses && progressData.availableDECourses.length > 0 && (
        <div className="bg-surface rounded-xl shadow-sm border border-border p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4 flex items-center">
            <span className="w-1 h-6 bg-primary rounded-full mr-3"></span>
            Available Discipline Electives
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {progressData.availableDECourses.slice(0, 6).map((course: any) => (
              <div
                key={course.id}
                className="border border-border rounded-lg p-4 hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all cursor-pointer group"
              >
                <p className="font-mono text-sm text-primary mb-1 font-semibold">
                  {course.code}
                </p>
                <p className="font-medium text-foreground text-sm mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {course.name}
                </p>
                <p className="text-xs text-foreground-secondary">
                  {course.credits} credits
                </p>
              </div>
            ))}
          </div>
          {progressData.availableDECourses.length > 6 && (
            <div className="mt-6 text-center">
              <a
                href="/dashboard/courses"
                className="text-primary hover:text-primary-hover font-medium text-sm inline-flex items-center gap-2 hover:gap-3 transition-all"
              >
                View all {progressData.availableDECourses.length} available courses →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
