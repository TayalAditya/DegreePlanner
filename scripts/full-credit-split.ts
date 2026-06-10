import { getAllDefaultCourses } from "@/lib/defaultCurriculum";

// B23 DE/FE from seed.ts (authoritative)
const B23_DEFU: Record<string, { de: number; fe: number; total: number }> = {
  CSE:    { de: 28, fe: 22, total: 160 },
  DSE:    { de: 33, fe: 22, total: 160 },
  EE:     { de: 20, fe: 17, total: 161 },
  ME:     { de: 16, fe: 22, total: 160 },
  CE:     { de: 17, fe: 22, total: 160 },
  BE:     { de: 24, fe: 22, total: 160 },
  EP:     { de: 29, fe: 22, total: 160 },
  MNC:    { de: 15, fe: 22, total: 160 },
  MSE:    { de: 21, fe: 22, total: 160 },
  GE:     { de: 30, fe: 22, total: 160 },
  MEVLSI: { de: 12, fe: 22, total: 160 },
  BSCS:   { de: 23, fe: 15, total: 163 },
};

// B24 overrides for branches where DE/FE split changes.
// CE/BE/EP: FDP(4cr) + DP(3cr) dropped from IC → 7cr freed.
//   DP is optional for B24 (counts as FE if taken) → FE min = 25 (22 regular + 3 optional DP).
//   Remaining credits shift to DE.
// MNC: MA120(4cr DC) added, FDP(4cr IC) dropped → IC-DC net neutral → DE/FE unchanged.
const B24_OVERRIDES: Record<string, { de: number; fe: number }> = {
  CE: { de: 21, fe: 25 },
  BE: { de: 28, fe: 25 },
  EP: { de: 33, fe: 25 },
};

const BRANCHES = [
  "CSE", "DSE", "EE", "ME", "CE", "BE", "EP", "MNC", "MSE",
  "GE-ROBO", "GE-MECH", "GE-COMM", "GE-FIN", "GE-OPEN",
  "MEVLSI", "BSCS",
];

function getBase(b: string) { return b.startsWith("GE-") ? "GE" : b; }

function getIC_DC_ISTP_MTP(branch: string, batch: number) {
  const all = getAllDefaultCourses(branch, 8, batch);
  const seen = new Set<string>();
  let ic = 0, dc = 0, istp = 0, mtp = 0;
  // Track unique IKS codes so we only count one (IC181 or IC182, not both)
  let iksCode: string | null = null;
  for (const c of all) {
    const k = c.code.replace(/\s+/g, "").toUpperCase();
    if (seen.has(k)) continue;
    // For ICB: skip — always 6 (counted separately)
    if (c.category === "ICB") continue;
    // For IKS: count only the first one (student does either IC181 or IC182)
    if (c.category === "IKS") { if (!iksCode) { iksCode = k; } continue; }
    seen.add(k);
    if (c.category === "IC")   ic   += c.credits;
    if (c.category === "DC")   dc   += c.credits;
    if (c.category === "ISTP") istp += c.credits;
    if (c.category === "MTP")  mtp  += c.credits;
  }
  return { ic, dc, istp, mtp };
}

const COL = ["Branch","Batch","IC","ICB","IKS","HSS","IC_TOT","DC","DE","FE","ISTP","MTP","TOTAL"];
console.log(COL.join("\t"));
console.log("─".repeat(110));

for (const branch of BRANCHES) {
  const base  = getBase(branch);
  const ref   = B23_DEFU[base] ?? B23_DEFU["GE"];
  const HSS   = 12;
  const ICB   = 6;
  const IKS   = 3;

  for (const [label, batch] of [["B23", 2023], ["B24", 2024]] as [string, number][]) {
    const { ic, dc, istp, mtp } = getIC_DC_ISTP_MTP(branch, batch);
    const icTot = ic + ICB + IKS + HSS;
    // For B24 branches with explicit overrides, use those DE/FE values; otherwise derive from formula
    let fe: number, de: number;
    if (batch === 2024 && B24_OVERRIDES[base]) {
      fe = B24_OVERRIDES[base].fe;
      de = B24_OVERRIDES[base].de;
    } else {
      fe = ref.fe;
      de = ref.total - icTot - dc - fe - istp - mtp;
    }
    console.log([branch, label, ic, ICB, IKS, HSS, icTot, dc, de, fe, istp, mtp, ref.total].join("\t"));
  }
  console.log("─".repeat(110));
}
