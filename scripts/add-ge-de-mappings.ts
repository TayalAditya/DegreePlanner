/**
 * Add GE sub-branch DE mappings from docs/GE DE (specialization wise).xlsx
 */
import prisma from "@/lib/prisma";

// Normalize code: ME212 → ME-212
function normalizeCode(raw: string): string {
  return raw.trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^([A-Z]+)(\d)/, "$1-$2")  // insert hyphen
    .replace(/P$/, "P");  // keep trailing P
}

const GE_DE: Record<string, string[]> = {
  "GE-MECH": [
    "ME-210","EE-231","ME-452","CS-313","EE-536","EE-314","CS-305",
    "EE-529","ME-212","IC-241","ME-213","AR-502","AR-505","ME-510",
    "AR-510","AR-511","EE-311","AR-522","DS-201","ME-100","AR-519",
    "AR-521","EE-201P","DS-313","ME-504","ME-527","ME-630","AR-526",
    "AR-508","AR-524","ME-215",
  ],
  "GE-COMM": [
    "EE-608","EE-641","EE-536","DS-313","EE-517","EE-553","EE-503",
    "CS-549","EE-518","DS-201","EE-541","EE-211","EE-533","EE-530",
    "EE-607","IC-241","ME-212","EE-201P",
  ],
  "GE-ROBO": [
    "EE-608","AR-526","EE-529","CE-251","AR-505","CS-514","ME-510",
    "CS-212","AR-508","EE-260","AR-502","AR-510","AR-511","EE-211",
    "ME-212","AR-522","ME-100","AR-513","ME-213","ME-210","AR-514",
    "IC-241","EE-201P","EE-203","DS-313","AR-524","AR-519","AR-521",
    "AR-523",
  ],
  "GE-FIN": [
    "MA-546","MA-552","MA-604","HS-307",
    // Add broader MA finance/quant courses
    "MA-353","MA-356","MA-460","MA-546","MA-548","MA-550","MA-553",
    "MA-560","MA-563","MA-565","MA-572","MA-604","MA-608","MA-641",
    "MA-644","MA-650","MA-651","MA-652","MA-653","MA-654","MA-655",
    "MA-656","MA-665","CS-313","EE-530","DS-201","DS-302",
  ],
  "GE-OPEN": [
    // GE-OPEN has free electives from any dept — add broad cross-dept list
    // DC courses are pre-defined; DEs can be from any dept
    // Based on reference doc: "any course from any dept subject to diversity requirement"
    // Add key courses from all dept pools
    "ME-210","ME-213","EE-260","EE-301","EE-529","EE-536","CS-305",
    "CS-313","CS-362","AR-502","AR-505","AR-519","AR-521","AR-522",
    "EE-608","EE-517","EE-503","DS-201","DS-313","MA-546","MA-551",
    "IC-241","ME-452","EE-311","ME-212","ME-213","EE-203","EE-211",
    "CS-514","CS-212","ME-510","AR-526","EE-607","EE-641","EE-533",
  ],
};

async function upsertDe(courseId: string, branch: string) {
  await prisma.courseBranchMapping.upsert({
    where: { courseId_branch_batch: { courseId, branch, batch: "" } },
    create: { courseId, branch, courseCategory: "DE", batch: "" },
    update: { courseCategory: "DE" },
  });
}

async function main() {
  for (const [branch, rawCodes] of Object.entries(GE_DE)) {
    const codes = [...new Set(rawCodes.map(normalizeCode))];
    console.log(`\n${branch} — ${codes.length} codes`);
    let added = 0, missing = 0;

    for (const code of codes) {
      // Try exact code, then without hyphen, then with hyphen
      const variants = [code, code.replace(/-/g,""), code.replace(/^([A-Z]+)-(\d)/, "$1$2")];
      let course = null;
      for (const v of variants) {
        course = await prisma.course.findFirst({ where: { code: v } });
        if (course) break;
      }

      if (!course) {
        console.log(`  ⚠️  ${code} not in DB`);
        missing++;
        continue;
      }

      await upsertDe(course.id, branch);
      console.log(`  ✅ ${code}`);
      added++;
    }
    console.log(`  → added: ${added}, missing: ${missing}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
