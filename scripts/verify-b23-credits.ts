import { DEFAULT_CURRICULUM, type DefaultCourse } from "@/lib/defaultCurriculum";

const BRANCHES = ["CSE", "DSE", "EE", "ME", "CE", "BE", "EP", "MNC", "MSE", "GE", "MEVLSI", "BSCS"];

function collect(branch: string): DefaultCourse[] {
  const out: DefaultCourse[] = [];
  for (let s = 1; s <= 8; s++) {
    const arr = DEFAULT_CURRICULUM[`${branch}_${s}`];
    if (arr) out.push(...arr);
  }
  // de-dupe by code (mixed sem-1/sem-2 alternates are listed twice on purpose)
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = c.code.replace(/\s+/g, "").toUpperCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

for (const b of BRANCHES) {
  const courses = collect(b);
  const ic = courses.filter((c) => c.category === "IC");
  const icb = courses.filter((c) => c.category === "ICB");
  const icSum = ic.reduce((a, c) => a + c.credits, 0);
  const icbSum = icb.reduce((a, c) => a + c.credits, 0);
  const dcSum = courses.filter((c) => c.category === "DC").reduce((a, c) => a + c.credits, 0);

  console.log(`\n=== ${b} ===  IC=${icSum}  ICB(pool listed)=${icbSum}  DC=${dcSum}`);
  console.log("  IC courses: " + ic.map((c) => `${c.code}(${c.credits})`).join(" "));
  console.log("  ICB courses: " + icb.map((c) => `${c.code}(${c.credits})`).join(" "));
}
