"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Award, BookOpen, Target } from "lucide-react";

interface Program {
  id: string;
  name: string;
  code: string;
  type: string;
  department: string;
  totalCreditsRequired: number;
  icCredits: number;
  dcCredits: number;
  deCredits: number;
  feCredits: number;
  mtpIstpCredits: number;
  description?: string;
}

interface UserProgram {
  id: string;
  programType: string;
  isPrimary: boolean;
  startSemester: number;
  status: string;
  program: Program;
}

export default function ProgramsPage() {
  const [userPrograms, setUserPrograms] = useState<UserProgram[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      const res = await fetch("/api/programs");
      if (res.ok) {
        const data = await res.json();
        setUserPrograms(data);
      }
    } catch (error) {
      console.error("Failed to fetch programs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const primaryProgram = userPrograms.find((p) => p.isPrimary);
  const secondaryPrograms = userPrograms.filter((p) => !p.isPrimary);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Academic Programs</h1>
        <p className="text-foreground-secondary mt-2">
          View your enrolled programs and credit requirements
        </p>
      </div>

      {userPrograms.length === 0 ? (
        <div className="bg-surface rounded-lg border border-border p-8 text-center">
          <GraduationCap className="w-16 h-16 text-foreground-secondary mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            No Programs Enrolled
          </h2>
          <p className="text-foreground-secondary">
            Contact your academic advisor to enroll in a program
          </p>
        </div>
      ) : (
        <>
          {/* Primary Program */}
          {primaryProgram && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Primary Program</h2>
              </div>
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border-2 border-primary p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-foreground">
                        {primaryProgram.program.name}
                      </h3>
                      <span className="px-3 py-1 bg-primary text-white text-sm rounded-full">
                        {primaryProgram.program.type}
                      </span>
                    </div>
                    <p className="text-foreground-secondary">
                      {primaryProgram.program.code} • {primaryProgram.program.department}
                    </p>
                    {primaryProgram.program.description && (
                      <p className="text-foreground-secondary mt-2">
                        {primaryProgram.program.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Credit Requirements */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-surface/50 rounded-lg p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="w-4 h-4 text-primary" />
                      <p className="text-sm font-medium text-foreground-secondary">Total Credits</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {primaryProgram.program.totalCreditsRequired}
                    </p>
                  </div>

                  <div className="bg-surface/50 rounded-lg p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="w-4 h-4 text-blue-500" />
                      <p className="text-sm font-medium text-foreground-secondary">IC + DC</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {primaryProgram.program.icCredits + primaryProgram.program.dcCredits}
                    </p>
                  </div>

                  <div className="bg-surface/50 rounded-lg p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="w-4 h-4 text-green-500" />
                      <p className="text-sm font-medium text-foreground-secondary">Electives (DE)</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {primaryProgram.program.deCredits}
                    </p>
                  </div>

                  <div className="bg-surface/50 rounded-lg p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="w-4 h-4 text-purple-500" />
                      <p className="text-sm font-medium text-foreground-secondary">Free Electives</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {primaryProgram.program.feCredits}
                    </p>
                  </div>
                </div>

                {/* MTP/ISTP Info */}
                {primaryProgram.program.mtpIstpCredits > 0 && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <h4 className="font-semibold text-foreground mb-3">Project Requirements</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {primaryProgram.program.code !== "BSCS" && (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                            <Award className="w-5 h-5 text-orange-500" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">MTP Required</p>
                            <p className="text-sm text-foreground-secondary">
                              8 credits (MTP-1: 3cr + MTP-2: 5cr)
                            </p>
                          </div>
                        </div>
                      )}
                      {primaryProgram.program.code !== "BSCS" && (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                            <Award className="w-5 h-5 text-blue-500" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">ISTP</p>
                            <p className="text-sm text-foreground-secondary">
                              4 credits (Semester 6)
                            </p>
                          </div>
                        </div>
                      )}
                      {primaryProgram.program.code === "BSCS" && (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                            <Award className="w-5 h-5 text-purple-500" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Research Projects</p>
                            <p className="text-sm text-foreground-secondary">
                              {primaryProgram.program.mtpIstpCredits} credits
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Secondary Programs (Minor/Double Major) */}
          {secondaryPrograms.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Additional Programs</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {secondaryPrograms.map((userProgram) => (
                  <div
                    key={userProgram.id}
                    className="bg-surface rounded-lg border border-border p-6 hover:border-primary transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-foreground">
                        {userProgram.program.name}
                      </h3>
                      <span className="px-3 py-1 bg-blue-500/10 text-blue-500 text-sm rounded-full">
                        {userProgram.program.type}
                      </span>
                    </div>
                    <p className="text-foreground-secondary mb-4">
                      {userProgram.program.code} • {userProgram.program.department}
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm text-foreground-secondary">Total Credits</p>
                        <p className="text-lg font-bold text-foreground">
                          {userProgram.program.totalCreditsRequired}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-foreground-secondary">Status</p>
                        <p className="text-lg font-bold text-green-500">
                          {userProgram.status}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
