import { getDefaultCurriculum } from "@/lib/defaultCurriculum";

for (const branch of ["CE", "BE", "EP", "BSCS"]) {
  for (const batch of [2023, 2024, 2025]) {
    const sem = branch === "CE" ? 3 : 4; // CE has IC202P in Sem3, others in Sem4
    const courses = getDefaultCurriculum(branch, sem, batch);
    const dp = courses.find(c => c.code === "IC202P");
    console.log(`${branch} B${batch} Sem${sem}: IC202P = ${dp ? dp.category + (dp.optional ? " optional" : " REQUIRED") : "not present"}`);
  }
}
