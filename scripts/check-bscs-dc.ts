import { getAllDefaultCourses, type DefaultCourse } from "@/lib/defaultCurriculum";

for (const batch of [2023, 2024, 2025]) {
  const all = getAllDefaultCourses("BSCS", 8, batch) as DefaultCourse[];
  const seen = new Set<string>(); let dc = 0;
  const dcList: string[] = [];
  for (const c of all) {
    const k = c.code.replace(/\s+/g, "").toUpperCase();
    if (seen.has(k)) continue; seen.add(k);
    if (c.category === "DC") { dc += c.credits; dcList.push(c.code + "(" + c.credits + ")"); }
  }
  console.log(`BSCS B${batch} DC=${dc}: ${dcList.join(" ")}`);
}
