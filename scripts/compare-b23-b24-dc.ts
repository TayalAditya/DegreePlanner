import { getAllDefaultCourses } from "@/lib/defaultCurriculum";

const BRANCHES = [
  "CSE", "DSE", "EE", "ME", "CE", "BE", "EP", "MNC", "MSE",
  "GE-ROBO", "GE-MECH", "GE-COMM", "GE-FIN", "GE-OPEN",
  "MEVLSI", "BSCS",
];

function getDC(branch: string, batch: number) {
  const all = getAllDefaultCourses(branch, 8, batch);
  const seen = new Set<string>();
  let dc = 0;
  for (const c of all) {
    const key = c.code.replace(/\s+/g, "").toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (c.category === "DC") dc += c.credits;
  }
  return dc;
}

console.log("Branch\t\tB23 DC\tB24 DC\tDiff");
console.log("─".repeat(40));
for (const b of BRANCHES) {
  const b23 = getDC(b, 2023);
  const b24 = getDC(b, 2024);
  const diff = b24 - b23;
  const diffStr = diff === 0 ? "—" : (diff > 0 ? `+${diff}` : `${diff}`);
  const pad = b.length < 8 ? "\t\t" : "\t";
  console.log(`${b}${pad}${b23}\t${b24}\t${diffStr}`);
}
