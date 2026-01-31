"use client";

import { useQuery } from "@tanstack/react-query";
import { ProgressChart } from "./ProgressChart";
import { CreditBreakdownCard } from "./CreditBreakdownCard";
import { MTPStatusCard } from "./MTPStatusCard";
import { BookOpen, TrendingUp, AlertCircle } from "lucide-react";

interface DashboardOverviewProps {
  userId: string;
}

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

  if (programsLoading || !programs) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow p-6 animate-pulse"
            >
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="bg-surface dark:bg-surface rounded-xl shadow-soft border border-border p-12 text-center">
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

  const currentSemester =
    enrollments && enrollments.length > 0
      ? Math.max(...enrollments.map((e: any) => e.semester))
      : 1;

  const currentSemesterEnrollments = enrollments?.filter(
    (e: any) => e.semester === currentSemester && e.status === "IN_PROGRESS"
  );

  const completedCourses = enrollments?.filter(
    (e: any) => e.status === "COMPLETED"
  );

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-surface dark:bg-surface rounded-xl shadow-soft border border-border p-6 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground-secondary font-medium mb-1">Current Semester</p>
              <p className="text-4xl font-bold text-primary">
                {currentSemester}
              </p>
            </div>
            <div className="w-14 h-14 bg-primary/10 dark:bg-primary/20 rounded-xl flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-surface dark:bg-surface rounded-xl shadow-soft border border-border p-6 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground-secondary font-medium mb-1">This Semester</p>
              <p className="text-4xl font-bold text-success">
                {currentSemesterEnrollments?.length || 0}
              </p>
            </div>
            <div className="w-14 h-14 bg-success/10 dark:bg-success/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-success" />
            </div>
          </div>
          <p className="text-xs text-foreground-secondary mt-2">Active courses</p>
        </div>

        <div className="bg-surface dark:bg-surface rounded-xl shadow-soft border border-border p-6 hover:shadow-md transition-all sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground-secondary font-medium mb-1">Completed</p>
              <p className="text-4xl font-bold text-info">
                {completedCourses?.length || 0}
              </p>
            </div>
            <div className="w-14 h-14 bg-info/10 dark:bg-info/20 rounded-xl flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-info" />
            </div>
          </div>
          <p className="text-xs text-foreground-secondary mt-2">Total courses</p>
        </div>
      </div>

      {/* Progress Overview */}
      {primaryProgram && progressData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProgressChart
            progress={progressData.progress}
            isLoading={progressLoading}
          />
          <CreditBreakdownCard
            progress={progressData.progress}
            isLoading={progressLoading}
          />
        </div>
      )}

      {/* MTP/ISTP Status */}
      {primaryProgram && progressData && (
        <MTPStatusCard
          mtpEligibility={progressData.mtpEligibility}
          istpEligibility={progressData.istpEligibility}
          isLoading={progressLoading}
        />
      )}

      {/* Available DE Courses */}
      {progressData?.availableDECourses && progressData.availableDECourses.length > 0 && (
        <div className="bg-surface dark:bg-surface rounded-xl shadow-soft border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
            <span className="w-1 h-6 bg-primary rounded-full mr-3"></span>
            Available Discipline Electives
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
