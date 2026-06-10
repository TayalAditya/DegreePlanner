import { getAllDefaultCourses, type DefaultCourse } from "@/lib/defaultCurriculum";

for (const [branch, batch] of [["GE-COMM",2023],["GE-COMM",2024],["GE-MECH",2023]] as [string,number][]) {
  const all = getAllDefaultCourses(branch, 8, batch) as DefaultCourse[];
  const seen = new Set<string>(); let dc=0; const list:string[]=[];
  for (const c of all) {
    const k = c.code.replace(/\s+/g,"").toUpperCase();
    if (seen.has(k)) continue;
    if (c.category==="ICB"||c.category==="IKS") continue;
    seen.add(k);
    if (c.category==="DC") { dc+=c.credits; list.push(`${c.code}(${c.credits},S${c.semester})`); }
  }
  console.log(`${branch} B${String(batch).slice(2)} DC=${dc}`);
  console.log(" ", list.join("  "));
}
