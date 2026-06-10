import { getAllDefaultCourses } from "@/lib/defaultCurriculum";

// B23 DE/FE — seed.ts authoritative values
const B23: Record<string, { de: number; fe: number; total: number }> = {
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

// B24 explicit overrides (CE/BE/EP: DP optional → FE+3; MNC: MA120 added as DC)
const B24_OVR: Record<string, { de: number; fe: number }> = {
  CE: { de: 21, fe: 25 },
  BE: { de: 28, fe: 25 },
  EP: { de: 33, fe: 25 },
  MNC: { de: 15, fe: 22 },
};

// B25 explicit overrides (CE/BE/EP: same DP optional → FE+3 pattern as B24)
const B25_OVR: Record<string, { de: number; fe: number }> = {
  CE: { de: 17, fe: 25 },
  BE: { de: 24, fe: 25 },
  EP: { de: 29, fe: 25 },
};

// Branches per batch (B25 adds DSAI)
const BRANCHES_B23_B24 = [
  "CSE", "DSE", "EE", "ME", "CE", "BE", "EP", "MNC", "MSE",
  "GE-ROBO", "GE-MECH", "GE-COMM", "GE-FIN", "GE-OPEN",
  "MEVLSI", "BSCS",
];
const BRANCHES_B25 = [...BRANCHES_B23_B24, "DSAI"];

function getBase(b: string) { return b.startsWith("GE-") ? "GE" : b; }

function getIC_DC_ISTP_MTP(branch: string, batch: number) {
  const all = getAllDefaultCourses(branch, 8, batch);
  const seen = new Set<string>();
  let ic = 0, dc = 0, istp = 0, mtp = 0;
  let iksCode: string | null = null;
  for (const c of all) {
    const k = c.code.replace(/\s+/g, "").toUpperCase();
    if (seen.has(k)) continue;
    if (c.category === "ICB") continue;
    if (c.category === "IKS") { if (!iksCode) iksCode = k; continue; }
    seen.add(k);
    if (c.category === "IC")   ic   += c.credits;
    if (c.category === "DC")   dc   += c.credits;
    if (c.category === "ISTP") istp += c.credits;
    if (c.category === "MTP")  mtp  += c.credits;
  }
  return { ic, dc, istp, mtp };
}

const COL = ["Branch","B","IC","ICB","IKS","HSS","IC_TOT","DC","DE","FE","ISTP","MTP","Total"];
console.log(COL.join("\t"));
console.log("─".repeat(115));

const HSS = 12, ICB = 6, IKS = 3;

for (const branch of BRANCHES_B25) {
  const base = getBase(branch);
  const ref  = B23[base] ?? B23["GE"];

  for (const [label, batch] of [["23",2023],["24",2024],["25",2025]] as [string,number][]) {
    // B25 only has DSAI; B23/B24 don't. Skip DSAI for B23/B24.
    if (branch === "DSAI" && batch !== 2025) continue;

    const { ic, dc, istp, mtp } = getIC_DC_ISTP_MTP(branch, batch);
    const icTot = ic + ICB + IKS + HSS;

    let fe: number, de: number;
    if (batch === 2024 && B24_OVR[base]) {
      fe = B24_OVR[base].fe;
      de = B24_OVR[base].de;
    } else if (batch === 2025 && B25_OVR[base]) {
      fe = B25_OVR[base].fe;
      de = B25_OVR[base].de;
    } else {
      fe = ref.fe;
      de = ref.total - icTot - dc - fe - istp - mtp;
    }
    console.log([branch, label, ic, ICB, IKS, HSS, icTot, dc, de, fe, istp, mtp, ref.total].join("\t"));
  }
  console.log("");
}
