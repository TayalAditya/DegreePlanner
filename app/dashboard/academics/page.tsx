"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  BookOpen, 
  GraduationCap, 
  Award, 
  Globe, 
  Briefcase,
  FileText,
  TrendingUp,
  CheckCircle,
  Info
} from "lucide-react";

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
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Academic Information
        </h1>
        <p className="text-muted-foreground mt-2">
          Complete guide to B.Tech & B.S. 2023 academic requirements
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                  : "bg-card hover:bg-accent"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === "overview" && <OverviewSection />}
        {activeTab === "credits" && <CreditsSection />}
        {activeTab === "courses" && <CoursesSection />}
        {activeTab === "internships" && <InternshipsSection />}
        {activeTab === "exchange" && <ExchangeSection />}
        {activeTab === "honours" && <HonoursSection />}
        {activeTab === "minors" && <MinorsSection />}
      </motion.div>
    </div>
  );
}

function OverviewSection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20">
          <h3 className="font-semibold text-lg mb-2">B.Tech Degree</h3>
          <p className="text-3xl font-bold text-blue-600">160</p>
          <p className="text-sm text-muted-foreground">Total Credits Required</p>
        </div>
        <div className="p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20">
          <h3 className="font-semibold text-lg mb-2">B.Tech (EE)</h3>
          <p className="text-3xl font-bold text-purple-600">161</p>
          <p className="text-sm text-muted-foreground">Total Credits Required</p>
        </div>
        <div className="p-6 rounded-xl bg-gradient-to-br from-pink-500/10 to-pink-600/10 border border-pink-500/20">
          <h3 className="font-semibold text-lg mb-2">B.S. Chemical Sciences</h3>
          <p className="text-3xl font-bold text-pink-600">163</p>
          <p className="text-sm text-muted-foreground">Total Credits Required</p>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Distribution of Credits (B.Tech)</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 rounded-lg bg-accent/50">
            <span>Institute Core Courses</span>
            <span className="font-semibold">60 credits</span>
          </div>
          <div className="pl-4 space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between"><span>• IC Compulsory</span><span>39 credits</span></div>
            <div className="flex justify-between"><span>• IC Basket</span><span>6 credits</span></div>
            <div className="flex justify-between"><span>• HSS</span><span>12 credits</span></div>
            <div className="flex justify-between"><span>• Indian Knowledge System</span><span>3 credits</span></div>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-accent/50">
            <span>Discipline Courses</span>
            <span className="font-semibold">66 credits</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-accent/50">
            <span>Free Electives</span>
            <span className="font-semibold">22 credits</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-accent/50">
            <span>MTP + ISTP</span>
            <span className="font-semibold">12 credits</span>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Credit Limits Per Semester</h3>
        <div className="space-y-2">
          <p className="flex justify-between"><span>Minimum:</span><strong>12 credits</strong></p>
          <p className="flex justify-between"><span>Maximum:</span><strong>22 credits</strong></p>
          <p className="flex justify-between"><span>With AD approval:</span><strong>Up to 25 credits</strong></p>
          <p className="text-sm text-muted-foreground mt-3">
            * Audit courses can increase the limit to 25 credits
          </p>
          <p className="text-sm text-muted-foreground">
            * For vacation/semester-long internship, minimum can be relaxed to 9 credits
          </p>
        </div>
      </div>
    </div>
  );
}

function CreditsSection() {
  const branches = [
    { name: "Bio-Engineering", dc: 42, de: 24, total: 66 },
    { name: "Civil Engineering", dc: 49, de: 17, total: 66 },
    { name: "Computer Science", dc: 38, de: 28, total: 66 },
    { name: "Data Science", dc: 33, de: 33, total: 66 },
    { name: "Electrical Engineering", dc: 52, de: 20, total: 72 },
    { name: "Engineering Physics", dc: 37, de: 29, total: 66 },
    { name: "General Engineering", dc: 36, de: 30, total: 66 },
    { name: "Material Science", dc: 45, de: 21, total: 66 },
    { name: "Mathematics & Computing", dc: 51, de: 15, total: 66 },
    { name: "Mechanical Engineering", dc: 50, de: 16, total: 66 },
    { name: "Microelectronics & VLSI", dc: 54, de: 12, total: 66 },
    { name: "Chemical Sciences (B.S.)", dc: 59, de: 23, total: 82 },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Discipline Core & Electives by Branch</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Branch</th>
                <th className="text-right p-3">Discipline Core</th>
                <th className="text-right p-3">Discipline Electives</th>
                <th className="text-right p-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch, idx) => (
                <tr key={idx} className="border-b hover:bg-accent/50 transition-colors">
                  <td className="p-3">{branch.name}</td>
                  <td className="text-right p-3 text-blue-600 font-semibold">{branch.dc}</td>
                  <td className="text-right p-3 text-purple-600 font-semibold">{branch.de}</td>
                  <td className="text-right p-3 font-bold">{branch.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-xl mb-4">ISTP & MTP</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-blue-600 mb-2">ISTP (4 credits)</h4>
              <p className="text-sm text-muted-foreground">
                Interactive Socio-Technical Practicum - 6th Semester practicum involving development of useful products and technologies with understanding of socio-economic context.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-purple-600 mb-2">MTP (8 credits total)</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Major Technical Project - Final year project under faculty supervision
              </p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• MTP-1: 3 credits (DP-498P)</li>
                <li>• MTP-2: 5 credits (DP-499P)</li>
                <li>• Minimum GP 7.0 in MTP-1 to continue to MTP-2</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-xl mb-4">Pass/Fail & Audit Courses</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-blue-600 mb-2">Pass/Fail Courses</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Grades: Pass (P) or Fail (F)</li>
                <li>• Count towards B.Tech requirement</li>
                <li>• Maximum 9 P/F credits total</li>
                <li>• Not more than 6 in a semester</li>
                <li>• Don't affect CGPA</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-purple-600 mb-2">Audit Courses</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Grades: Audit Pass (AP) or Audit Fail (AF)</li>
                <li>• Don't count towards requirements</li>
                <li>• No credit limit</li>
                <li>• Don't affect CGPA</li>
                <li>• Good for workshops/conferences</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CoursesSection() {
  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Institute Core - Compulsory Courses (39 credits)</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { code: "IC112", name: "Calculus", credits: 2 },
            { code: "IC113", name: "Complex Variables and Vector Calculus", credits: 2 },
            { code: "IC114", name: "Linear Algebra", credits: 2 },
            { code: "IC115", name: "ODE & Integral Transforms", credits: 2 },
            { code: "IC140", name: "Engineering Graphics for Design", credits: 4 },
            { code: "IC102P", name: "Foundations of Design Practicum", credits: 4 },
            { code: "IC152", name: "Computing and Data Science", credits: 4 },
            { code: "IC202P", name: "Design Practicum", credits: 3 },
            { code: "IC252", name: "Probability and Statistics", credits: 4 },
            { code: "IC161", name: "Applied Electronics", credits: 3 },
            { code: "IC161P", name: "Applied Electronics Lab", credits: 2 },
            { code: "IC272", name: "Machine Learning", credits: 3 },
            { code: "IC222P", name: "Physics Practicum", credits: 2 },
            { code: "IC010", name: "Internship", credits: 2 },
          ].map((course, idx) => (
            <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors">
              <div>
                <span className="font-mono text-sm text-blue-600">{course.code}</span>
                <p className="text-sm">{course.name}</p>
              </div>
              <span className="font-semibold text-purple-600">{course.credits}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">IC Basket Courses (6 credits)</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-blue-600 mb-2">IC-I Basket (3 credits - Choose 1)</h4>
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-accent/50"><span className="font-mono text-sm">IC131</span> - Applied Chemistry for Engineers</div>
              <div className="p-3 rounded-lg bg-accent/50"><span className="font-mono text-sm">IC136</span> - Understanding Biotechnology and its Applications</div>
              <div className="p-3 rounded-lg bg-accent/50"><span className="font-mono text-sm">IC230</span> - Environmental Science</div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-purple-600 mb-2">IC-II Basket (3 credits - Choose 1)</h4>
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-accent/50"><span className="font-mono text-sm">IC121</span> - Mechanics of Particles and Waves</div>
              <div className="p-3 rounded-lg bg-accent/50"><span className="font-mono text-sm">IC240</span> - Mechanics of Rigid Bodies</div>
              <div className="p-3 rounded-lg bg-accent/50"><span className="font-mono text-sm">IC241</span> - Material Science for Engineers</div>
              <div className="p-3 rounded-lg bg-accent/50"><span className="font-mono text-sm">IC253</span> - Data Structures and Algorithms</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">HSS & IKS Requirements</h3>
        <div className="space-y-3">
          <p className="text-muted-foreground">
            12 credits from HSS courses covering various domains:
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">Sociology</div>
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">Economics</div>
            <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">Literature</div>
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">Entrepreneurship</div>
          </div>
          <div className="mt-4 p-4 rounded-lg bg-accent border-l-4 border-blue-600">
            <p className="font-semibold">Indian Knowledge System (IKS)</p>
            <p className="text-sm text-muted-foreground">1 course worth 3 credits is compulsory</p>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            * Maximum 20 HSS credits count towards 160 credits. Additional HSS credits count outside the requirement.
          </p>
        </div>
      </div>
    </div>
  );
}

function InternshipsSection() {
  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Mandatory Internship (IC-010)</h3>
        <div className="space-y-3">
          <p className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>Compulsory for all students</span>
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>Minimum 6 weeks duration</span>
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>Worth 2 credits (Pass/Fail)</span>
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>To be done after 5th semester</span>
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>Must be completed before final semester</span>
          </p>
        </div>
        <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <h4 className="font-semibold mb-2">Types of Internships</h4>
          <ul className="space-y-1 text-sm">
            <li>• <strong>Industrial:</strong> Industrial experience</li>
            <li>• <strong>Research:</strong> Research-oriented (industry/academia)</li>
            <li>• <strong>Academic:</strong> Under professors of other institutes</li>
          </ul>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-xl mb-4 text-blue-600">Semester Long Remote Internship</h3>
          <div className="space-y-3 text-sm">
            <p className="font-semibold">Course Code: DP-396P</p>
            <p><strong>Credits:</strong> 6 P/F (Free Electives)</p>
            <p><strong>Duration:</strong> Minimum 14 weeks</p>
            <p><strong>Semesters:</strong> 6th, 7th, or 8th</p>
            <p><strong>Courses Allowed:</strong> Max 9 credits alongside</p>
            <div className="mt-4 p-3 rounded-lg bg-accent">
              <p className="font-semibold">Requirements:</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• FA approval required</li>
                <li>• NOC from Academic Section</li>
                <li>• Before add/drop deadline</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-xl mb-4 text-purple-600">Semester Long Onsite Internship</h3>
          <div className="space-y-3 text-sm">
            <p className="font-semibold">Course Code: DP-399P</p>
            <p><strong>Credits:</strong> 9 P/F (Free Electives)</p>
            <p><strong>Duration:</strong> Minimum 14 weeks</p>
            <p><strong>Semesters:</strong> 6th or 7th (8th needs Dean approval)</p>
            <p><strong>Courses Allowed:</strong> None during internship</p>
            <div className="mt-4 p-3 rounded-lg bg-accent">
              <p className="font-semibold">Requirements:</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• FA approval required</li>
                <li>• NOC from Academic Section</li>
                <li>• Before add/drop deadline</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border border-orange-500/20 bg-orange-500/5">
        <h3 className="font-semibold text-xl mb-3">⚠️ Important Notes</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• 20-week internships = 2 credits (IC-010) + 6/9 credits (DP-396P/399P)</li>
          <li>• Get FA consent before applying, especially for general/non-core companies</li>
          <li>• Some FAs require min 105 credits by end of 5th semester for 6th semester onsite internship</li>
          <li>• Projects under IIT Mandi faculty don't count as internships</li>
          <li>• Grading based on company feedback (Pass/Fail scheme)</li>
          <li>• Internship drop allowed before mid-semester with proper evaluation</li>
        </ul>
      </div>
    </div>
  );
}

function ExchangeSection() {
  const universities = [
    { name: "TU Munich", country: "Germany" },
    { name: "TU Dresden", country: "Germany" },
    { name: "TU Darmstadt", country: "Germany" },
    { name: "TU Braunschweig", country: "Germany" },
    { name: "RWTH Aachen", country: "Germany" },
    { name: "Karlsruhe Institute of Technology", country: "Germany" },
    { name: "Leibniz University, Hannover", country: "Germany" },
    { name: "Université de Pau et des Pays de l'Adour", country: "France" },
    { name: "University of Agder", country: "Norway" },
    { name: "Kyushu University", country: "Japan" },
    { name: "National University Corporation", country: "Japan" },
    { name: "Chung Yuan Christian University", country: "Taiwan" },
    { name: "Missouri University of Science and Technology", country: "USA" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Semester Exchange Program</h3>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <h4 className="font-semibold mb-2">Eligibility</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• 5th - 7th semester students</li>
                <li>• Maximum 2 contiguous semesters</li>
                <li>• Selection based on CGPA</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h4 className="font-semibold mb-2">Financial</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• No fees to host institute</li>
                <li>• Student bears travel/stay/food costs</li>
                <li>• Scholarships may be available</li>
              </ul>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-accent border-l-4 border-blue-600">
            <h4 className="font-semibold mb-2">Why Students Prefer Exchange</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>✓ Explore courses not offered at IIT Mandi</li>
              <li>✓ Learn about new cultures</li>
              <li>✓ Traveling & tourism opportunities</li>
              <li>✓ International exposure</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Partner Universities</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {universities.map((uni, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-purple-500/5 border hover:shadow-lg transition-all">
              <p className="font-semibold text-sm">{uni.name}</p>
              <p className="text-xs text-muted-foreground mt-1">📍 {uni.country}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-lg mb-4">Grade Conversion (EU/TU9)</h3>
          <div className="space-y-2">
            {[
              { ects: "A", iit: "A" },
              { ects: "B", iit: "A-" },
              { ects: "C", iit: "B" },
              { ects: "D", iit: "B-" },
              { ects: "E", iit: "C" },
              { ects: "FX/F", iit: "F" },
            ].map((grade, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-accent/50">
                <span className="font-mono text-blue-600">{grade.ects}</span>
                <span>→</span>
                <span className="font-mono text-purple-600">{grade.iit}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-3">
              * 1.5 ECTS credits = 1 IIT Mandi credit
            </p>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-lg mb-4">Grade Conversion (Kyushu)</h3>
          <div className="space-y-2">
            {[
              { kyushu: "S (4)", iit: "A" },
              { kyushu: "A (3)", iit: "B" },
              { kyushu: "B (2)", iit: "C" },
              { kyushu: "C (1)", iit: "D" },
              { kyushu: "F (0)", iit: "F" },
            ].map((grade, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-accent/50">
                <span className="font-mono text-blue-600">{grade.kyushu}</span>
                <span>→</span>
                <span className="font-mono text-purple-600">{grade.iit}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-3">
              * 1 Kyushu credit = 1 IIT Mandi credit
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border border-blue-500/20 bg-blue-500/5">
        <h3 className="font-semibold text-lg mb-3">📋 Attendance Management</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Students can register for ongoing semester courses</li>
          <li>• Attendance counts from the day they report to institute</li>
          <li>• Video recordings/online classes/NPTEL courses may be provided</li>
          <li>• Mid-sem exams during makeup slots</li>
          <li>• Regular end-sem exam schedule</li>
          <li>• Instructors may impose 100% attendance (excluding medical)</li>
        </ul>
      </div>
    </div>
  );
}

function HonoursSection() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 p-6 rounded-xl border border-yellow-500/20">
        <div className="flex items-center gap-3 mb-4">
          <Award className="h-8 w-8 text-yellow-600" />
          <h3 className="font-semibold text-2xl">Honours Degree</h3>
        </div>
        <p className="text-muted-foreground">
          Earn B.Tech. (Honours) or B.S. (Honours) by meeting excellence criteria
        </p>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Basic Requirements</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-semibold">Application Timing</p>
              <p className="text-sm text-muted-foreground">4th or 5th semester (no F grade till then)</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-semibold">MTP Requirement</p>
              <p className="text-sm text-muted-foreground">8 credits of MTP (DP498P + DP499P) in parent discipline</p>
              <p className="text-xs text-muted-foreground mt-1">* Waived for IDD students (required to do PGP)</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-semibold">No F Grades</p>
              <p className="text-sm text-muted-foreground">Throughout the entire program</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card p-6 rounded-xl border border-blue-500/20">
          <h3 className="font-semibold text-xl mb-4 text-blue-600">Mode A</h3>
          <div className="space-y-3">
            <div className="text-center p-4 rounded-lg bg-blue-500/10">
              <p className="text-4xl font-bold text-blue-600">8.5+</p>
              <p className="text-sm text-muted-foreground mt-1">CGPA Required</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Achieve a CGPA of 8.5 or more out of total credits completed
            </p>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border border-purple-500/20">
          <h3 className="font-semibold text-xl mb-4 text-purple-600">Mode B</h3>
          <div className="space-y-3">
            <div className="text-center p-4 rounded-lg bg-purple-500/10">
              <p className="text-4xl font-bold text-purple-600">8.0+</p>
              <p className="text-sm text-muted-foreground mt-1">CGPA Required</p>
            </div>
            <p className="text-sm font-semibold">Plus one of:</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Q1 SCI Journal publication (accepted/published)</li>
              <li>• Patent granted in relevant discipline</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Publication/Patent Guidelines</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            Article must be submitted and accepted during IIT Mandi registration
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            Must be declared before last date of 8th semester grade submission
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            Publication/patent must have IIT Mandi affiliation
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            Student must be first author (or main inventor for patents)
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            Same work cannot be counted by multiple students
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            Journal must be Q1 at time of submission/acceptance
          </p>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border border-green-500/20 bg-green-500/5">
        <h3 className="font-semibold text-xl mb-4">Honours Degree Awards</h3>
        <div className="space-y-2">
          <p className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-600" />
            <span><strong>B.Tech/B.S. students:</strong> B.Tech. (Honours) / B.S. (Honours) in {"<"}discipline{">"}</span>
          </p>
          <p className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-600" />
            <span><strong>IDD students:</strong> B.Tech. (Honours) and M.Tech. / B.S. (Honours) and M.S.</span>
          </p>
          <p className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-600" />
            <span><strong>Double Major:</strong> B.Tech. (Honours) with Second Major in {"<"}discipline{">"}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function MinorsSection() {
  const minors = [
    { name: "Computer Science Engineering", courses: "9+ credits", cgpa: "7.0" },
    { name: "Intelligent Systems", courses: "9+ credits", cgpa: "7.0" },
    { name: "Management", courses: "12+ credits", cgpa: "7.0" },
    { name: "Power Engineering", courses: "9+ credits", cgpa: "7.0" },
    { name: "Thermo-Fluid Systems", courses: "9+ credits", cgpa: "7.0" },
    { name: "Electronics Engineering", courses: "9+ credits", cgpa: "7.0" },
    { name: "Communication Engineering", courses: "9+ credits", cgpa: "7.0" },
    { name: "Mechanical Design", courses: "9+ credits", cgpa: "7.0" },
    { name: "Measurement and Instrumentation", courses: "9+ credits", cgpa: "7.0" },
    { name: "Device/Structural Materials", courses: "9+ credits", cgpa: "7.0" },
    { name: "Control Engineering", courses: "9+ credits", cgpa: "7.0" },
    { name: "Applied Physics", courses: "12+ credits", cgpa: "7.0" },
    { name: "Robotics", courses: "12+ credits", cgpa: "7.0" },
    { name: "German Language", courses: "9+ credits", cgpa: "7.0" },
    { name: "Quantum Technologies", courses: "12+ credits", cgpa: "7.0" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 rounded-xl border border-purple-500/20">
        <div className="flex items-center gap-3 mb-4">
          <GraduationCap className="h-8 w-8 text-purple-600" />
          <h3 className="font-semibold text-2xl">Minor Degrees</h3>
        </div>
        <p className="text-muted-foreground">
          Gain expertise in an area outside your major discipline. 15 different minor programs available.
        </p>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">General Requirements</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
            <p className="text-2xl font-bold text-blue-600">9-12</p>
            <p className="text-sm text-muted-foreground mt-1">Credits Required</p>
          </div>
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
            <p className="text-2xl font-bold text-purple-600">7.0+</p>
            <p className="text-sm text-muted-foreground mt-1">Minimum CGPA</p>
          </div>
          <div className="p-4 rounded-lg bg-pink-500/10 border border-pink-500/20 text-center">
            <p className="text-2xl font-bold text-pink-600">≠</p>
            <p className="text-sm text-muted-foreground mt-1">Different from Major</p>
          </div>
        </div>
        <div className="mt-4 p-4 rounded-lg bg-accent border-l-4 border-purple-600">
          <p className="text-sm text-muted-foreground">
            ✓ All courses count towards Free Electives basket<br />
            ✓ Courses must be non Pass/Fail and non Audit<br />
            ✓ One course can contribute to only one Minor<br />
            ✓ Specialist basket of at least 3 courses for each Minor
          </p>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border">
        <h3 className="font-semibold text-xl mb-4">Available Minor Programs</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {minors.map((minor, idx) => (
            <div 
              key={idx} 
              className="p-4 rounded-lg bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/10 hover:border-purple-500/30 hover:shadow-lg transition-all"
            >
              <p className="font-semibold">{minor.name}</p>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{minor.courses}</span>
                <span>CGPA: {minor.cgpa}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-lg mb-4 text-blue-600">Minor in Management</h3>
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-sm mb-2">Prerequisites:</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• IC 252: Data Science II</li>
                <li>• One Communicative Competence course</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">Core (6 credits):</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• HS 202: Principles of Economics</li>
                <li>• HS 304: Organizational Management</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">Electives (2 courses):</p>
              <p className="text-xs text-muted-foreground">
                Choose from Financial Accounting, Organizational Behaviour, Consumer Behaviour, Financial Management, Entrepreneurship, and more
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border">
          <h3 className="font-semibold text-lg mb-4 text-purple-600">Minor in Robotics</h3>
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-sm mb-2">Compulsory (2 courses):</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• AR 501/ME 452: Robot Kinematics, Dynamics, and Control</li>
                <li>• AR 503: Mechatronics</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">Electives (2 out of 14):</p>
              <p className="text-xs text-muted-foreground">
                Advanced Design, Robot Programming, Principles of Robot Autonomy, Cognitive Robotics, Probabilistic Robotics, Deep Learning for Robotics, Autonomous Mobile Robots, and more
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border border-orange-500/20 bg-orange-500/5">
        <h3 className="font-semibold text-lg mb-3">⭐ Special: Quantum Technologies</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Can be taken as either Minor (12+ credits) or Specialization (18+ credits)
        </p>
        <div className="space-y-2 text-sm">
          <p><strong>Mandatory Foundation (1 of 2):</strong> QT 301 or QT 302/PH 513/EP 301</p>
          <p><strong>Mandatory Lab (1 of 2):</strong> QT 303P or QT 304P/QT 501P</p>
          <p><strong>Mandatory Advanced (1 of 4):</strong> Quantum Computation, Communication, Sensing, or Materials</p>
          <p><strong>Optional:</strong> Engineering Foundation, Solid State Physics, Quantum Optics, Post Quantum Security</p>
        </div>
      </div>
    </div>
  );
}
