/**
 * Curriculum PDF generator — B23/B24/B25 × 12 branches
 * Produces one PDF per branch-batch with semester-wise breakdown.
 *
 * Key fix: mixed-sem courses (IC140, IC102P, IC181) shown ONLY in Sem-1
 * so no semester exceeds ~25 credits.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { getDefaultCurriculum, type DefaultCourse } from "@/lib/defaultCurriculum";
import prisma from "@/lib/prisma";

// ── Seed credit structure ────────────────────────────────────────────────────
const CREDITS: Record<string, { ic: number; icb: number; dc: number; de: number; fe: number; mtp: number; total: number; dept: string; fullName: string }> = {
  CSE:    { ic:39,icb:6,dc:38,de:28,fe:22,mtp:12,total:160, dept:"SCEE", fullName:"Computer Science \\& Engineering" },
  DSE:    { ic:39,icb:6,dc:33,de:33,fe:22,mtp:12,total:160, dept:"SCEE", fullName:"Data Science \\& Engineering" },
  DSAI:   { ic:39,icb:6,dc:31,de:35,fe:22,mtp:12,total:160, dept:"SCEE", fullName:"Data Science \\& Artificial Intelligence" },
  EE:     { ic:39,icb:6,dc:52,de:20,fe:17,mtp:12,total:161, dept:"SCEE", fullName:"Electrical Engineering" },
  MEVLSI: { ic:39,icb:6,dc:54,de:12,fe:22,mtp:12,total:160, dept:"SCEE", fullName:"Microelectronics \\& VLSI" },
  MNC:    { ic:39,icb:6,dc:51,de:15,fe:22,mtp:12,total:160, dept:"SMSS", fullName:"Mathematics \\& Computing" },
  ME:     { ic:39,icb:6,dc:50,de:16,fe:22,mtp:12,total:160, dept:"SMME", fullName:"Mechanical Engineering" },
  MSE:    { ic:39,icb:6,dc:45,de:21,fe:22,mtp:12,total:160, dept:"SMME", fullName:"Materials Science \\& Engineering" },
  GE:     { ic:39,icb:6,dc:36,de:30,fe:22,mtp:12,total:160, dept:"SMME", fullName:"General Engineering" },
  CE:     { ic:39,icb:6,dc:49,de:17,fe:22,mtp:12,total:160, dept:"SCENE", fullName:"Civil Engineering" },
  BE:     { ic:39,icb:6,dc:42,de:24,fe:22,mtp:12,total:160, dept:"SBE",  fullName:"Bioengineering" },
  EP:     { ic:39,icb:6,dc:37,de:29,fe:22,mtp:12,total:160, dept:"SPS",  fullName:"Engineering Physics" },
  BSCS:   { ic:31,icb:6,dc:62,de:23,fe:15,mtp:14,total:163, dept:"SCS",  fullName:"B.S. Chemical Sciences" },
};

// B24/B25 overrides
const CREDITS_B24: Partial<typeof CREDITS> = {
  CE:   { ...CREDITS.CE,   ic:32,dc:49,de:21,fe:25 },
  BE:   { ...CREDITS.BE,   ic:32,dc:42,de:28,fe:25 },
  EP:   { ...CREDITS.EP,   ic:32,dc:37,de:33,fe:25 },
  MNC:  { ...CREDITS.MNC,  ic:35,dc:55,de:15 },
  BSCS: { ...CREDITS.BSCS, ic:27,dc:65,de:24 },
};
const CREDITS_B25: Partial<typeof CREDITS> = {
  CE:   { ...CREDITS.CE,   ic:36,dc:49,de:17,fe:25 },
  BE:   { ...CREDITS.BE,   ic:36,dc:42,de:24,fe:25 },
  EP:   { ...CREDITS.EP,   ic:36,dc:37,de:29,fe:25 },
};

function getCredits(branch: string, batch: number) {
  const base = CREDITS[branch] ?? CREDITS.GE;
  if (batch === 2024) return { ...base, ...(CREDITS_B24[branch] ?? {}) };
  if (batch === 2025) return { ...base, ...(CREDITS_B25[branch] ?? {}) };
  return base;
}

// Mixed courses: assign each to exactly one semester for canonical display
// IC140 → Sem1 only; IC102P → Sem2 only; IC181/IC182 → Sem1 only
const SEM1_ONLY = new Set(["IC140","IC181","IC182"]);  // remove from Sem2+
const SEM2_ONLY = new Set(["IC102P"]);                  // remove from Sem1

// Branch-specific ICB compulsions — show ONLY these in curriculum, not the full pool
const ICB_COMPULSION: Record<string, { ic1?: string; ic2?: string }> = {
  CSE:    { ic2: "IC253" },
  DSE:    { ic2: "IC253" },
  DSAI:   { ic2: "IC253" },
  EE:     {},               // free choice — show pool header only
  MEVLSI: {},
  ME:     { ic2: "IC240" },
  CE:     { ic1: "IC230", ic2: "IC240" },
  BE:     { ic1: "IC136", ic2: "IC240" },
  EP:     { ic1: "IC230", ic2: "IC121" },
  MNC:    { ic1: "IC136", ic2: "IC253" },
  MSE:    { ic1: "IC131", ic2: "IC241" },
  "GE-ROBO": { ic1: "IC230", ic2: "IC240" },
  "GE-MECH": { ic1: "IC230", ic2: "IC240" },
  "GE-COMM": { ic1: "IC230", ic2: "IC240" },
  "GE-OPEN": { ic1: "IC230", ic2: "IC240" },
  "GE-FIN":  { ic1: "IC230", ic2: "IC240" },
  BSCS:   { ic1: "IC131", ic2: "IC121" },
};

// Keep only the compulsory ICB courses for a given branch.
// For free-choice branches, show exactly ONE representative per basket group
// so semester credit totals are correct (not inflated by showing all options).
function filterICB(courses: DefaultCourse[], branch: string): DefaultCourse[] {
  const comp = ICB_COMPULSION[branch] ?? {};
  const hasForcedIc1 = !!comp.ic1;
  const hasForcedIc2 = !!comp.ic2;
  const icb1Codes = new Set(["IC131","IC136","IC230"]);
  const icb2Codes = new Set(["IC121","IC240","IC241","IC253"]);
  let icb1Replaced = false, icb2Replaced = false;

  const result: DefaultCourse[] = [];
  for (const c of courses) {
    if (c.category !== "ICB") { result.push(c); continue; }
    const norm = c.code.replace(/[^A-Z0-9]/g,"").toUpperCase();
    if (icb1Codes.has(norm)) {
      if (hasForcedIc1) {
        if (norm === comp.ic1!.replace(/[^A-Z0-9]/g,"")) result.push(c);
      } else if (!icb1Replaced) {
        result.push(ICB1_PLACEHOLDER); // generic placeholder for free-choice
        icb1Replaced = true;
      }
    } else if (icb2Codes.has(norm)) {
      if (hasForcedIc2) {
        if (norm === comp.ic2!.replace(/[^A-Z0-9]/g,"")) result.push(c);
      } else if (!icb2Replaced) {
        result.push(ICB2_PLACEHOLDER);
        icb2Replaced = true;
      }
    } else {
      result.push(c);
    }
  }
  return result;
}

function getSemCourses(branch: string, sem: number, batch: number): DefaultCourse[] {
  const raw = getDefaultCurriculum(branch, sem, batch);
  // Remove optional courses — they are suggestions, not part of fixed curriculum
  const nonOptional = raw.filter(c => !c.optional);
  // Apply ICB compulsion filter
  const filtered = filterICB(nonOptional, branch);
  const norm = (c: DefaultCourse) => c.code.replace(/[^A-Z0-9]/g,"").toUpperCase();
  if (sem === 1) {
    return filtered.filter(c => !SEM2_ONLY.has(norm(c)));
  }
  return filtered.filter(c => !SEM1_ONLY.has(norm(c)));
}

// LaTeX transliteration for common accented/non-ASCII characters (hex keys avoid parse issues)
const LATEX_CHARS: {[k: string]: string} = {
  "Ā":"\\={A}","ā":"\\={a}","Ī":"\\={I}","ī":"\\={i}",
  "Ū":"\\={U}","ū":"\\={u}",
  "á":"\\'{a}","à":"\\`{a}","â":"\\^{a}","ä":"\\\"{ a}","ã":"\\~{a}",
  "é":"\\'{e}","è":"\\`{e}","ê":"\\^{e}","ë":"\\\"{e}",
  "í":"\\'{i}","ì":"\\`{i}","î":"\\^{i}","ï":"\\\"{i}",
  "ó":"\\'{o}","ò":"\\`{o}","ô":"\\^{o}","ö":"\\\"{o}","õ":"\\~{o}",
  "ú":"\\'{u}","ù":"\\`{u}","û":"\\^{u}","ü":"\\\"{u}",
  "ñ":"\\~{n}","ç":"\\c{c}","ß":"{\\ss}",
};

function escape(s: string): string {
  // NFC normalize to combine decomposed chars (a + combining macron → ā precomposed)
  const norm = (s ?? "").normalize("NFC");
  return norm
    .replace(/&/g,"\\&").replace(/%/g,"\\%").replace(/#/g,"\\#")
    .replace(/_/g,"\\_").replace(/\$/g,"\\$").replace(/\^/g,"\\^{}")
    .replace(/[^\x00-\x7F]/g, ch => LATEX_CHARS[ch] ?? "{?}");
}

// Exchange/sem-abroad course code prefixes — exclude from DE list
const EXCHANGE_PREFIXES = ["IN", "CIT", "11", "16", "18", "20", "41"];
function isExchangeCourse(code: string): boolean {
  const norm = code.replace(/[^A-Z0-9]/g,"").toUpperCase();
  return EXCHANGE_PREFIXES.some(p => norm.startsWith(p) && /^\d/.test(norm.slice(p.length)));
}

// ICB free-choice placeholder courses (shown when branch has no forced basket choice)
const ICB1_PLACEHOLDER: DefaultCourse = {
  code: "ICB-1", name: "IC Basket -- 1 (choose one from pool)", credits: 3, category: "ICB", semester: 1,
};
const ICB2_PLACEHOLDER: DefaultCourse = {
  code: "ICB-2", name: "IC Basket -- 2 (choose one from pool)", credits: 3, category: "ICB", semester: 2,
};

async function getLtpcMap(codes: string[]): Promise<Map<string,{l:string;t:string;p:string}>> {
  // defaultCurriculum uses "IC112"; DB may store "IC-112" — query both forms
  const addHyphen = (c: string) => c.replace(/^([A-Z]+)(\d)/, "$1-$2");
  const allVariants = [...new Set(codes.flatMap(c => [c, addHyphen(c), c.replace(/-/g,"")]))];
  const rows = await prisma.course.findMany({
    where: { code: { in: allVariants } },
    select: { code: true, ltpc: true },
  });
  const map = new Map<string,{l:string;t:string;p:string}>();
  for (const r of rows) {
    if (!r.ltpc) continue;
    const parts = r.ltpc.trim().split(/[-\s]+/);
    const v = { l: parts[0]??"---", t: parts[1]??"---", p: parts[2]??"---" };
    // Register under all variants so lookup by any form works
    map.set(r.code, v);
    map.set(r.code.replace(/-/g,""), v);
    map.set(addHyphen(r.code), v);
  }
  return map;
}

async function getDeList(branch: string): Promise<{code:string;name:string;credits:number}[]> {
  const maps = await prisma.courseBranchMapping.findMany({
    where: { branch, courseCategory: "DE" },
    include: { course: { select: { code:true, name:true, credits:true } } },
    orderBy: { course: { code: "asc" } },
  });
  const seen = new Set<string>();
  const skipSubstrings = ["498P","499P","010","396P","399P","621P","532P","642"];
  return maps
    .map(m => m.course)
    .filter(c => c && c.code && !seen.has(c.code) && seen.add(c.code))
    .filter(c => !skipSubstrings.some(s => c.code.includes(s)))
    .filter(c => !isExchangeCourse(c.code));
}

function genTex(branch: string, batch: number, cr: ReturnType<typeof getCredits>,
                semData: {sem:number; courses:DefaultCourse[]}[],
                deList: {code:string;name:string;credits:number}[],
                ltpcMap: Map<string,{l:string;t:string;p:string}>): string {
  const batchLabel = `B${String(batch).slice(2)}`;
  const hss = cr.total >= 163 ? 12 : 15;
  const LOGO = "C:/Users/AdityaTayal/Desktop/Projects/DegreePlanner/docs/curricula/iitmandi_logo.jpg";

  // GE specialisation labels
  const geSpec: Record<string,string> = {
    "GE-ROBO":"AI \\& Robotics","GE-MECH":"Mechatronics \\& AI",
    "GE-COMM":"Communications Technology","GE-OPEN":"Open Specialisation","GE-FIN":"FinTech",
  };
  const geFullSpec: Record<string,string> = {
    "GE-ROBO":"AI & Robotics","GE-MECH":"Mechatronics & AI",
    "GE-COMM":"Communications Technology","GE-OPEN":"Open Specialisation","GE-FIN":"FinTech",
  };
  // fullName already LaTeX-escaped; for GE show specialisation
  const titleName = branch.startsWith("GE-")
    ? `${cr.fullName} with ${geSpec[branch] ?? branch}`
    : cr.fullName;
  const schoolFull: Record<string,string> = {
    SCEE:"School of Computing and Electrical Engineering (SCEE)",
    SMSS:"School of Mathematical and Statistical Sciences (SMSS)",
    SMME:"School of Mechanical and Materials Engineering (SMME)",
    SCENE:"School of Civil and Environmental Engineering (SCENE)",
    SBE:"School of Bioengineering (SBE)",
    SPS:"School of Physical Sciences (SPS)",
    SCS:"School of Chemical Sciences (SCS)",
  };
  const school = schoolFull[cr.dept] ?? cr.dept;

  // Ordinal suffixes
  const ord = (n: number) => ["","st","nd","rd"][n] ?? "th";

  // DC courses list
  const dcAll: DefaultCourse[] = [];
  for (const {courses} of semData) {
    for (const c of courses) {
      if (c.category==="DC" && !dcAll.find(x=>x.code===c.code)) dcAll.push(c);
    }
  }

  // ── Per-semester tables (S.No / Code / Course Name / L / T / P / C) ──────
  const validCats = new Set(["IC","IKS","ICB","DC","MTP","ISTP"]);
  const fmtLtpc = (code: string) => {
    const v = ltpcMap.get(code);
    return v ? { l: v.l, t: v.t, p: v.p } : { l:"---", t:"---", p:"---" };
  };

  const semTables = semData.map(({sem, courses}) => {
    const valid = courses.filter(c => validCats.has(c.category));
    const total = valid.reduce((s,c)=>s+c.credits,0);
    const rows = valid.map((c, i) => {
      const {l,t,p} = fmtLtpc(c.code);
      return `${i+1} & ${escape(c.code)} & ${escape(c.name)} & ${l} & ${t} & ${p} & ${c.credits} \\\\\\hline`;
    }).join("\n");
    const suffix = (sem===11||sem===12) ? "th" : ord(sem);
    const semLabel = `${sem}\\textsuperscript{${suffix === "th" || sem > 3 ? "th" : suffix}}`;
    return `\\subsection*{B.Tech.~in ${titleName} --- ${semLabel} Semester}
\\begin{center}
\\begin{longtable}{|c|>{\\centering\\arraybackslash}p{1.6cm}|>{\\raggedright\\arraybackslash}p{7cm}|c|c|c|c|}
\\hline
\\textbf{S.No} & \\textbf{Code} & \\multicolumn{1}{c|}{\\textbf{Course Name}} & \\textbf{L} & \\textbf{T} & \\textbf{P} & \\textbf{C} \\\\\\hline
\\endfirsthead
\\multicolumn{7}{c}{\\small\\textit{(continued)}}\\\\\\hline
\\textbf{S.No} & \\textbf{Code} & \\multicolumn{1}{c|}{\\textbf{Course Name}} & \\textbf{L} & \\textbf{T} & \\textbf{P} & \\textbf{C} \\\\\\hline
\\endhead
\\hline\\endlastfoot
${rows}
\\end{longtable}
\\end{center}
\\textit{Total Credits: ${total}}
\\vspace{0.4em}`;
  }).join("\n\n");

  // ── DC table (matching reference style) ───────────────────────────────────
  const dcTableRows = dcAll.map(c =>
    `${escape(c.code)} & ${escape(c.name)} & ${c.credits} \\\\\\hline`
  ).join("\n");

  // ── IC Basket section (branch-aware) ─────────────────────────────────────
  const ICB1_POOL = [
    {code:"IC-131", name:"Applied Chemistry for Engineers"},
    {code:"IC-136", name:"Understanding Biotechnology and its Applications"},
    {code:"IC-230", name:"Environmental Science"},
  ];
  const ICB2_POOL = [
    {code:"IC-121", name:"Mechanics of Particles and Waves"},
    {code:"IC-240", name:"Mechanics of Rigid Bodies"},
    {code:"IC-241", name:"Material Science for Engineers"},
    {code:"IC-253", name:"Data Structures and Algorithms"},
  ];
  const findName = (pool: {code:string;name:string}[], code: string) =>
    pool.find(c => c.code.replace(/-/g,"") === code.replace(/-/g,""))?.name ?? code;

  const compB = ICB_COMPULSION[branch] ?? {};
  const b1Forced = !!compB.ic1, b2Forced = !!compB.ic2;

  const b1Cell = b1Forced
    ? `${compB.ic1} --- ${findName(ICB1_POOL, compB.ic1!)} (\\textit{compulsory})`
    : ICB1_POOL.map(c => `${c.code} ${escape(c.name)}`).join(" \\quad ");
  const b2Cell = b2Forced
    ? `${compB.ic2} --- ${findName(ICB2_POOL, compB.ic2!)} (\\textit{compulsory})`
    : ICB2_POOL.map(c => `${c.code} ${escape(c.name)}`).join(" \\quad ");
  const b1Header = b1Forced ? "Basket 1 (fixed)" : "Basket 1 (choose one)";
  const b2Header = b2Forced ? "Basket 2 (fixed)" : "Basket 2 (choose one)";

  const icbSection = `\\section{IC Basket Courses (${cr.icb} credits required)}
\\begin{center}
\\begin{tabular}{|l|>{\\raggedright\\arraybackslash}p{10cm}|}
\\hline
\\textbf{Basket} & \\textbf{Course(s)} \\\\\\hline
${b1Header} & ${b1Cell} \\\\\\hline
${b2Header} & ${b2Cell} \\\\\\hline
\\end{tabular}
\\end{center}
\\vspace{0.8em}`;

  // ── DE list (single column, can span pages) ───────────────────────────────
  const deRows = deList.map((c, i) =>
    `${i+1} & ${escape(c.code)} & ${escape(c.name)} & ${c.credits} \\\\\\hline`
  ).join("\n");

  return `\\documentclass[a4paper,11pt]{article}
\\usepackage{fontspec}
\\setmainfont{Latin Modern Roman}
\\newfontfamily\\devfont[Script=Devanagari,Scale=0.9]{Nirmala UI}
\\usepackage[a4paper,top=3cm,bottom=2cm,left=2cm,right=2cm]{geometry}
\\usepackage{booktabs,longtable,array,graphicx,fancyhdr,titlesec,multirow,multicol}
\\setlength{\\headheight}{2.2cm}
\\pagestyle{fancy}\\fancyhf{}
\\fancyhead[L]{\\footnotesize\\devfont\\textbf{\\addfontfeature{Script=Devanagari}भारतीय प्रौद्योगिकी संस्थान मण्डी}\\\\{\\devfont\\addfontfeature{Script=Devanagari}कमांड, हिमाचल प्रदेश -- 175075}}
\\fancyhead[C]{\\includegraphics[height=1.8cm]{${LOGO}}}
\\fancyhead[R]{\\footnotesize\\textbf{Indian Institute of Technology Mandi}\\\\Kamand, Himachal Pradesh -- 175075}
\\renewcommand{\\headrulewidth}{0.8pt}
\\fancyfoot[C]{\\thepage}
\\titleformat{\\section}{\\normalfont\\large\\bfseries}{}{0em}{}[\\vspace{-0.3em}\\rule{\\linewidth}{0.4pt}]
\\begin{document}

\\begin{center}
  {\\LARGE\\bfseries B.Tech.~in ${titleName}}\\\\[0.4em]
  {\\large ${school}}
\\end{center}
\\vspace{1em}

\\section{Credit Structure of the Programme}
\\begin{center}
\\begin{tabular}{|l|l|c|}
\\hline
\\textbf{Division} & \\textbf{Sub-division} & \\textbf{Credits} \\\\\\hline
\\multirow{3}{*}{Institute Core (IC)}
  & IC Compulsory (incl.\\ FDP and DP) & ${cr.ic} \\\\\\cline{2-3}
  & IC Baskets & ${cr.icb} \\\\\\cline{2-3}
  & IKS + Humanities \\& Social Sciences & ${hss} \\\\\\hline
\\multirow{2}{*}{Discipline}
  & Discipline Core (DC) & ${cr.dc} \\\\\\cline{2-3}
  & Discipline Elective (DE) & ${cr.de} \\\\\\hline
\\multirow{3}{*}{Electives}
  & Free Electives (FE) & ${cr.fe} \\\\\\cline{2-3}
  & ISTP & 4 \\\\\\cline{2-3}
  & Major Technical Project (MTP) & ${cr.mtp - 4} \\\\\\hline
\\textbf{TOTAL} & & \\textbf{${cr.total}} \\\\\\hline
\\end{tabular}
\\end{center}
\\vspace{0.8em}

${icbSection}

\\section{Discipline Core Courses (${dcAll.length} courses, ${cr.dc} credits)}
\\begin{center}
\\begin{tabular}{|c|>{\\raggedright\\arraybackslash}p{9cm}|c|}
\\hline
\\textbf{Course Code} & \\multicolumn{1}{c|}{\\textbf{Course Name}} & \\textbf{Cr} \\\\\\hline
${dcTableRows}
\\end{tabular}
\\end{center}
\\vspace{0.8em}

\\section{Semester-wise Course Distribution}
\\textit{L = Lecture hours\\quad T = Tutorial hours\\quad P = Practical hours\\quad C = Credits}\\\\[0.5em]
\\vspace{0.4em}

${semTables}

\\clearpage
\\section{Discipline Elective (DE) Courses --- ${deList.length} courses available (${cr.de} credits required)}
\\textit{Students must earn ${cr.de} credits from the list below. Subject to Senate approval.}\\\\[0.5em]
\\begin{longtable}{|c|c|p{11cm}|c|}
\\hline
\\textbf{S.No} & \\textbf{Code} & \\textbf{Course Name} & \\textbf{Cr} \\\\\\hline
\\endfirsthead
\\multicolumn{4}{c}{\\small\\textit{(continued from previous page)}}\\\\\\hline
\\textbf{S.No} & \\textbf{Code} & \\textbf{Course Name} & \\textbf{Cr} \\\\\\hline
\\endhead
\\hline\\endlastfoot
${deRows}
\\end{longtable}

\\vspace{1em}
\\noindent\\rule{\\linewidth}{0.4pt}\\\\
{\\small PlanMyDegree $\\cdot$ IIT Mandi $\\cdot$ \\today}
\\end{document}`;
}

const PDFLATEX = "C:\\Users\\AdityaTayal\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\xelatex.exe";
const BASE = "C:\\Users\\AdityaTayal\\Desktop\\Projects\\DegreePlanner\\docs\\curricula";

const BRANCHES_BASE: Array<{key:string;label:string}> = [
  {key:"CSE",label:"CSE"},{key:"DSE",label:"DSE"},{key:"EE",label:"EE"},
  {key:"ME",label:"ME"},{key:"CE",label:"CE"},{key:"BE",label:"BE"},
  {key:"EP",label:"EP"},{key:"MNC",label:"MNC"},{key:"MSE",label:"MSE"},
  {key:"MEVLSI",label:"MEVLSI"},{key:"BSCS",label:"BSCS"},
  {key:"GE-ROBO",label:"GE-ROBO"},{key:"GE-MECH",label:"GE-MECH"},
  {key:"GE-COMM",label:"GE-COMM"},{key:"GE-OPEN",label:"GE-OPEN"},
  {key:"GE-FIN",label:"GE-FIN"},
];
// B23 didn't have GE-FIN / GE-OPEN officially; B25 also gets DSAI
const BRANCHES_B23 = BRANCHES_BASE.filter(b => b.key !== "GE-FIN" && b.key !== "GE-OPEN");
const BATCHES = [2023, 2024, 2025];

// B23 historical semester overrides — courses actually taught in a different sem than the base curriculum
function applyHistoricalSemFix(branch: string, batch: number,
    semData: {sem:number; courses:DefaultCourse[]}[]): void {
  if (branch === "MSE" && batch === 2023) {
    // IC240 was offered in Sem6 for B23 MSE students, not Sem4
    for (const sd of semData) {
      const idx = sd.courses.findIndex(c => c.code.replace(/[^A-Z0-9]/g,"") === "IC240");
      if (idx >= 0) {
        const [ic240] = sd.courses.splice(idx, 1);
        const fixed = { ...ic240, semester: 6 };
        const sem6 = semData.find(s => s.sem === 6);
        if (sem6) sem6.courses.unshift(fixed);
        else semData.push({ sem: 6, courses: [fixed] });
        if (sd.courses.length === 0) semData.splice(semData.indexOf(sd), 1);
        semData.sort((a, b) => a.sem - b.sem);
        break;
      }
    }
  }
}

async function main() {
  // Clean any leftover aux/log/out from previous runs before starting
  for (const bLabel of ["B23","B24","B25"]) {
    const pdfDir = path.join(BASE, bLabel, "pdf");
    if (fs.existsSync(pdfDir)) {
      for (const f of fs.readdirSync(pdfDir)) {
        if ([".aux",".log",".out"].some(ext => f.endsWith(ext))) {
          fs.unlinkSync(path.join(pdfDir, f));
        }
      }
    }
  }

  for (const batch of BATCHES) {
    const bLabel = `B${String(batch).slice(2)}`;
    const pdfDir = path.join(BASE, bLabel, "pdf");
    const texDir = path.join(BASE, bLabel, "tex");
    fs.mkdirSync(pdfDir, { recursive: true });
    fs.mkdirSync(texDir, { recursive: true });

    const branches = batch === 2025
      ? [...BRANCHES_BASE, {key:"DSAI",label:"DSAI"}]
      : batch === 2023
      ? BRANCHES_B23
      : BRANCHES_BASE;

    for (const {key, label} of branches) {
      console.log(`Generating ${label} ${bLabel}...`);
      const cr = getCredits(key, batch);

      // Get per-semester courses with cross-semester dedup
      const semData: {sem:number; courses:DefaultCourse[]}[] = [];
      const seenCodes = new Set<string>();
      for (let sem = 1; sem <= 8; sem++) {
        const raw = getSemCourses(key, sem, batch);
        const courses = raw.filter(c => {
          const norm = c.code.replace(/[^A-Z0-9]/g,"").toUpperCase();
          if (seenCodes.has(norm)) return false;
          seenCodes.add(norm);
          return true;
        });
        if (courses.length > 0) semData.push({ sem, courses });
      }

      // Apply historical semester corrections (e.g. MSE B23 IC240 was in Sem6 not Sem4)
      applyHistoricalSemFix(key, batch, semData);

      const deList = await getDeList(key);
      // Fetch LTPC for all courses in this curriculum
      const allCodes = [...new Set(semData.flatMap(sd => sd.courses.map(c => c.code)))];
      const ltpcMap = await getLtpcMap(allCodes);
      const tex = genTex(key, batch, cr, semData, deList, ltpcMap);

      const texFile = path.join(texDir, `${label}_${bLabel}.tex`);
      const pdfFile = path.join(pdfDir, `${label}_${bLabel}.pdf`);
      fs.writeFileSync(texFile, tex, "utf8");

      try {
        execSync(
          `"${PDFLATEX}" -interaction=nonstopmode -output-directory "${pdfDir}" "${texFile}"`,
          { timeout: 60000, stdio: "pipe" }
        );
        // Remove all aux/log/out for this job
        for (const ext of [".aux",".log",".out"]) {
          const f = path.join(pdfDir, `${label}_${bLabel}${ext}`);
          if (fs.existsSync(f)) fs.unlinkSync(f);
        }
        console.log(`  ✅ ${pdfFile}`);
      } catch (e) {
        console.error(`  ❌ ${label} ${bLabel} compile error`);
      }
    }
  }
  console.log("\nAll done.");
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
