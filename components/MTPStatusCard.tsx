"use client";

import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface MTPStatusCardProps {
  mtpEligibility: any;
  istpEligibility: any;
  isLoading: boolean;
}

export function MTPStatusCard({
  mtpEligibility,
  istpEligibility,
  isLoading,
}: MTPStatusCardProps) {
  if (isLoading) {
    return (
      <div className="bg-surface dark:bg-surface rounded-lg border border-border p-6 animate-pulse">
        <div className="h-4 bg-background-secondary dark:bg-background rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-background-secondary dark:bg-background rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const renderEligibilityCard = (
    title: string,
    eligibility: any,
    type: "MTP" | "ISTP"
  ) => {
    const isEligible = eligibility.eligible;
    const Icon = isEligible ? CheckCircle2 : eligibility.reason ? XCircle : AlertCircle;
    const bgColor = isEligible ? "bg-green-50 dark:bg-green-900 dark:bg-opacity-20" : "bg-red-50 dark:bg-red-900 dark:bg-opacity-20";
    const borderColor = isEligible ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800";
    const iconColor = isEligible ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
    const textColor = isEligible ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100";

    return (
      <div className={`${bgColor} ${borderColor} border rounded-lg p-4`}>
        <div className="flex items-start gap-3">
          <Icon className={`w-6 h-6 ${iconColor} flex-shrink-0 mt-1`} />
          <div className="flex-1">
            <h4 className={`font-semibold ${textColor} mb-2`}>{title}</h4>
            
            {isEligible ? (
              <p className="text-sm text-foreground-secondary">
                You are eligible to register for {type}!
              </p>
            ) : eligibility.reason ? (
              <div className="space-y-2">
                <p className="text-sm text-foreground-secondary">{eligibility.reason}</p>
                <div className="text-xs text-foreground-secondary space-y-1">
                  <p>Credits completed: {eligibility.creditsCompleted}</p>
                  {eligibility.creditsRequired && (
                    <p>Credits required: {eligibility.creditsRequired}</p>
                  )}
                  <p>Current semester: {eligibility.semesterNumber}</p>
                  {eligibility.minSemesterRequired && (
                    <p>Minimum semester: {eligibility.minSemesterRequired}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground-secondary">
                {type} is not available for your program
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Terminal Project Eligibility
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderEligibilityCard("Major Terminal Project (MTP)", mtpEligibility, "MTP")}
        {renderEligibilityCard(
          "Independent Study Terminal Project (ISTP)",
          istpEligibility,
          "ISTP"
        )}
      </div>
    </div>
  );
}
