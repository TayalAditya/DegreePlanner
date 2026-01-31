"use client";

import { useEffect, useState } from "react";
import { Award, TrendingUp, CheckCircle, Clock, Target } from "lucide-react";

interface Enrollment {
  id: string;
  semester: number;
  year: number;
  courseType: string;
  status: string;
  grade?: string;
  course: {
    code: string;
    name: string;
    credits: number;
    department: string;
  };
}

interface ProgressData {
  totalCreditsEarned: number;
  totalCreditsInProgress: number;
  totalCreditsRequired: number;
  creditsByType: {
    CORE: number;
    DE: number;
    PE: number;
    FREE_ELECTIVE: number;
    MTP: number;
    ISTP: number;
  };
  creditsInProgressByType: {
    CORE: number;
    DE: number;
    PE: number;
    FREE_ELECTIVE: number;
    MTP: number;
    ISTP: number;
  };
  semesterWiseCredits: { semester: number; credits: number }[];
}

export default function ProgressPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const res = await fetch("/api/enrollments");
      if (res.ok) {
        const data = await res.json();
        setEnrollments(data);
      }
    } catch (error) {
      console.error("Failed to fetch progress:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (): ProgressData => {
    const completedEnrollments = enrollments.filter(
      (e) => e.status === "COMPLETED" && e.grade && e.grade !== "F"
    );
    const inProgressEnrollments = enrollments.filter(
      (e) => e.status === "IN_PROGRESS"
    );

    const creditsByType = {
      CORE: 0,
      DE: 0,
      PE: 0,
      FREE_ELECTIVE: 0,
      MTP: 0,
      ISTP: 0,
    };

    const creditsInProgressByType = {
      CORE: 0,
      DE: 0,
      PE: 0,
      FREE_ELECTIVE: 0,
      MTP: 0,
      ISTP: 0,
    };

    completedEnrollments.forEach((e) => {
      if (e.courseType in creditsByType) {
        creditsByType[e.courseType as keyof typeof creditsByType] += e.course.credits;
      }
    });

    inProgressEnrollments.forEach((e) => {
      if (e.courseType in creditsInProgressByType) {
        creditsInProgressByType[e.courseType as keyof typeof creditsInProgressByType] +=
          e.course.credits;
      }
    });

    const totalCreditsEarned = completedEnrollments.reduce(
      (sum, e) => sum + e.course.credits,
      0
    );

    const totalCreditsInProgress = inProgressEnrollments.reduce(
      (sum, e) => sum + e.course.credits,
      0
    );

    // Group by semester
    const semesterMap = new Map<number, number>();
    completedEnrollments.forEach((e) => {
      const current = semesterMap.get(e.semester) || 0;
      semesterMap.set(e.semester, current + e.course.credits);
    });

    const semesterWiseCredits = Array.from(semesterMap.entries())
      .map(([semester, credits]) => ({ semester, credits }))
      .sort((a, b) => a.semester - b.semester);

    return {
      totalCreditsEarned,
      totalCreditsInProgress,
      totalCreditsRequired: 160, // IIT Mandi standard
      creditsByType,
      creditsInProgressByType,
      semesterWiseCredits,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const progress = calculateProgress();
  const completionPercentage = Math.round(
    (progress.totalCreditsEarned / progress.totalCreditsRequired) * 100
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Academic Progress</h1>
        <p className="text-foreground-secondary mt-2">
          Track your degree completion and credit requirements
        </p>
      </div>

      {/* Overall Progress */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Overall Progress</h2>
            <p className="text-foreground-secondary">
              {progress.totalCreditsEarned} / {progress.totalCreditsRequired} credits completed
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-primary">{completionPercentage}%</p>
          </div>
        </div>
        <div className="w-full bg-surface rounded-full h-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface rounded-lg border border-border p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">Completed</p>
              <p className="text-2xl font-bold text-foreground">
                {progress.totalCreditsEarned}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">In Progress</p>
              <p className="text-2xl font-bold text-foreground">
                {progress.totalCreditsInProgress}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-border p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">Remaining</p>
              <p className="text-2xl font-bold text-foreground">
                {progress.totalCreditsRequired -
                  progress.totalCreditsEarned -
                  progress.totalCreditsInProgress}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Credits by Type */}
      <div className="bg-surface rounded-lg border border-border p-6">
        <h3 className="text-xl font-semibold text-foreground mb-4">Credits by Category</h3>
        <div className="space-y-4">
          {Object.entries(progress.creditsByType).map(([type, credits]) => {
            const inProgress = progress.creditsInProgressByType[type as keyof typeof progress.creditsInProgressByType];
            const total = credits + inProgress;
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground">
                    {type.replace(/_/g, " ")}
                  </span>
                  <span className="text-foreground-secondary">
                    {credits} {inProgress > 0 && `(+${inProgress})`}
                  </span>
                </div>
                <div className="w-full bg-border rounded-full h-2">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((total / 40) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Semester-wise Progress */}
      {progress.semesterWiseCredits.length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h3 className="text-xl font-semibold text-foreground mb-4">
            Semester-wise Credits
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {progress.semesterWiseCredits.map(({ semester, credits }) => (
              <div
                key={semester}
                className="bg-primary/10 rounded-lg p-4 text-center border border-primary/20"
              >
                <p className="text-sm text-foreground-secondary mb-1">Sem {semester}</p>
                <p className="text-2xl font-bold text-primary">{credits}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
