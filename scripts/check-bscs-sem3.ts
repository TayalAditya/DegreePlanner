import { getDefaultCurriculum, type DefaultCourse } from "@/lib/defaultCurriculum";

for (const batch of [2023, 2024, 2025]) {
  const s3 = getDefaultCurriculum("BSCS", 3, batch) as DefaultCourse[];
  const ic = s3.filter(c => c.category === "IC").map(c => c.code);
  const dc = s3.filter(c => c.category === "DC").map(c => c.code);
  console.log(`BSCS B${batch} Sem3: IC=[${ic.join(",")}] DC=[${dc.join(",")}]`);
}
