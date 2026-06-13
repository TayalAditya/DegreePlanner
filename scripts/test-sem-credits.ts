import { getDefaultCurriculum, type DefaultCourse } from "@/lib/defaultCurriculum";

const SEM1_ONLY = new Set(["IC140","IC181","IC182"]);
const SEM2_ONLY = new Set(["IC102P"]);
const norm = (c: {code:string}) => c.code.replace(/[^A-Z0-9]/g,"").toUpperCase();
const ICB1 = new Set(["IC131","IC136","IC230"]);
// CSE ICB2 compulsion = IC253 only
const ICB2_SKIP_CSE = new Set(["IC121","IC240","IC241"]);

// Same logic as gen-curricula.ts getSemCourses
for (let sem = 1; sem <= 3; sem++) {
  const raw = getDefaultCurriculum("CSE", sem, 2023);
  const nonOpt = raw.filter((c: DefaultCourse) => !c.optional); // filter optional
  const filtered = sem === 1
    ? nonOpt.filter((c: DefaultCourse) => !SEM2_ONLY.has(norm(c)))
    : nonOpt.filter((c: DefaultCourse) => !SEM1_ONLY.has(norm(c)));
  const final = filtered.filter((c: DefaultCourse) => {
    const n = norm(c);
    if (c.category === "ICB" && ICB1.has(n)) return n === "IC131";
    if (c.category === "ICB" && ICB2_SKIP_CSE.has(n)) return false;
    return true;
  });
  const total = final.reduce((s: number, c: DefaultCourse) => s + c.credits, 0);
  console.log(`\nSem ${sem} — ${total} cr`);
  final.forEach((c: DefaultCourse) => console.log(`  ${c.code.padEnd(10)} ${c.credits}cr ${c.category}`));
}
