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
      <div className="bg-white rounded-lg shadow-lg p-12 text-center">
        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          No Programs Enrolled
        </h2>
        <p className="text-gray-600 mb-6">
          Get started by enrolling in your major program
        </p>
        <a
          href="/dashboard/programs"
          className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Current Semester</p>
              <p className="text-3xl font-bold text-gray-900">
                {currentSemester}
              </p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Courses This Semester</p>
              <p className="text-3xl font-bold text-gray-900">
                {currentSemesterEnrollments?.length || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed Courses</p>
              <p className="text-3xl font-bold text-gray-900">
                {completedCourses?.length || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
          </div>
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
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Available Discipline Electives
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {progressData.availableDECourses.slice(0, 6).map((course: any) => (
              <div
                key={course.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-indigo-500 transition-colors cursor-pointer"
              >
                <p className="font-mono text-sm text-indigo-600 mb-1">
                  {course.code}
                </p>
                <p className="font-medium text-gray-900 text-sm mb-2">
                  {course.name}
                </p>
                <p className="text-xs text-gray-500">
                  {course.credits} credits
                </p>
              </div>
            ))}
          </div>
          {progressData.availableDECourses.length > 6 && (
            <div className="mt-4 text-center">
              <a
                href="/dashboard/courses"
                className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
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
