"use client";

import { useState, lazy, Suspense } from "react";
import {
  BookOpen,
  GraduationCap,
  Award,
  Globe,
  Briefcase,
  ChevronDown,
  TrendingUp,
  Info
} from "lucide-react";

const OverviewSection = lazy(() => import("./sections/OverviewSection"));
const CreditsSection = lazy(() => import("./sections/CreditsSection"));
const CoursesSection = lazy(() => import("./sections/CoursesSection"));
const InternshipsSection = lazy(() => import("./sections/InternshipsSection"));
const ExchangeSection = lazy(() => import("./sections/ExchangeSection"));
const HonoursSection = lazy(() => import("./sections/HonoursSection"));
const MinorsSection = lazy(() => import("./sections/MinorsSection"));

export default function AcademicsPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "Overview", icon: Info },
    { id: "credits", label: "Credits", icon: TrendingUp },
    { id: "courses", label: "Courses", icon: BookOpen },
    { id: "internships", label: "Internships", icon: Briefcase },
    { id: "exchange", label: "Exchange", icon: Globe },
    { id: "honours", label: "Honours", icon: Award },
    { id: "minors", label: "Minors", icon: GraduationCap },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Academic Information
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Complete guide to B.Tech & B.S. 2023 academic requirements
        </p>
      </div>

      {/* Tabs */}
      <div className="sm:hidden">
        <label htmlFor="academics-tab" className="sr-only">
          Select section
        </label>
        <div className="relative">
          <select
            id="academics-tab"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="w-full appearance-none rounded-xl border border-border bg-card px-4 py-3 pr-10 text-sm font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
        </div>
      </div>

      <div className="hidden sm:flex gap-2 overflow-x-auto pb-2 scrollbar-hide" role="tablist" aria-label="Academic sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={isActive}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap border text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
                isActive
                  ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20 border-primary/20"
                  : "bg-card text-foreground-secondary hover:text-foreground hover:bg-surface-hover border-border/60"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-card border" />}>
        {activeTab === "overview" && <OverviewSection />}
        {activeTab === "credits" && <CreditsSection />}
        {activeTab === "courses" && <CoursesSection />}
        {activeTab === "internships" && <InternshipsSection />}
        {activeTab === "exchange" && <ExchangeSection />}
        {activeTab === "honours" && <HonoursSection />}
        {activeTab === "minors" && <MinorsSection />}
      </Suspense>
    </div>
  );
}
