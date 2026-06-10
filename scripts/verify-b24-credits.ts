import { getAllDefaultCourses, type DefaultCourse } from "@/lib/defaultCurriculum";

const B24_BRANCHES = [
  "CSE", "DSE", "EE", "ME", "CE", "BE", "EP", "MNC", "MSE",
  "GE-ROBO", "GE-MECH", "GE-COMM", "GE-FIN",
  "MEVLSI", "BSCS",
];

function run(branch: string) {
  const all = getAllDefaultCourses(branch, 8, 2024);

  // dedupe by code (mixed-sem courses appear twice)
  const seen = new Set<string>();
  const courses: DefaultCourse[] = [];
  for (const c of all) {
    const key = c.code.replace(/\s+/g, "").toUpperCase();
    if (!seen.has(key)) { seen.add(key); courses.push(c); }
  }

  const byCat: Record<string, number> = {};
  for (const c of courses) byCat[c.category] = (byCat[c.category] || 0) + c.credits;

  const g = (k: string) => byCat[k] || 0;
  const icList  = courses.filter(c => c.category === "IC").map(c => `${c.code}(${c.credits})`);
  const icbList = courses.filter(c => c.category === "ICB").map(c => `${c.code}(${c.credits})`);
  const dcList  = courses.filter(c => c.category === "DC").map(c => `${c.code}(${c.credits})`);

  console.log(`\n=== ${branch} ===`);
  console.log(`  IC  = ${g("IC")}  | ${icList.join(" ")}`);
  console.log(`  ICB pool = ${g("ICB")} (required = 6) | ${icbList.join(" ")}`);
  console.log(`  IKS = ${g("IKS")}`);
  console.log(`  DC  = ${g("DC")}  | ${dcList.join(" ")}`);
  console.log(`  ISTP=${g("ISTP")}  MTP=${g("MTP")}`);
  console.log(`  Sum tracked = ${Object.values(byCat).reduce((a,x)=>a+x,0)} (excl HSS/DE/FE)`);
}

for (const b of B24_BRANCHES) run(b);
