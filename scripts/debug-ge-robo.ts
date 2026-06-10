import { getAllDefaultCourses } from "@/lib/defaultCurriculum";

for (const batch of [2023, 2024]) {
  const all = getAllDefaultCourses("GE-ROBO", 8, batch);
  const seen = new Set<string>();
  let dc = 0;
  const list: string[] = [];
  for (const c of all) {
    const k = c.code.replace(/\s+/g, "").toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    if (c.category === "DC") { dc += c.credits; list.push(`${c.code}(${c.credits},S${c.semester})`); }
  }
  console.log(`\nB${batch} GE-ROBO DC=${dc}`);
  console.log(list.join("  "));
}
