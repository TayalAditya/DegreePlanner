"use client";

import { useState } from "react";
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

import OverviewSection from "./sections/OverviewSection";
import CreditsSection from "./sections/CreditsSection";
import CoursesSection from "./sections/CoursesSection";
import InternshipsSection from "./sections/InternshipsSection";
import ExchangeSection from "./sections/ExchangeSection";
import HonoursSection from "./sections/HonoursSection";
import MinorsSection from "./sections/MinorsSection";

const tabs = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "credits", label: "Credits", icon: TrendingUp },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "internships", label: "Internships", icon: Briefcase },
  { id: "exchange", label: "Exchange", icon: Globe },
  { id: "honours", label: "Honours", icon: Award },
  { id: "minors", label: "Minors", icon: GraduationCap },
];

export default function AcademicsClient() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <>
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
      {activeTab === "overview" && <OverviewSection />}
      {activeTab === "credits" && <CreditsSection />}
      {activeTab === "courses" && <CoursesSection />}
      {activeTab === "internships" && <InternshipsSection />}
      {activeTab === "exchange" && <ExchangeSection />}
      {activeTab === "honours" && <HonoursSection />}
      {activeTab === "minors" && <MinorsSection />}
    </>
  );
}
