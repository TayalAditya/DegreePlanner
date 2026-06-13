/**
 * Add DSAI DE mappings from official DSAI Curriculum PDF (docs/DSAI Curriculum.pdf)
 * 54 suggested discipline electives for B.Tech DSAI (B25 onwards)
 */
import prisma from "@/lib/prisma";

// Official DE list from DSAI Curriculum PDF page 3
// Raw codes → normalized to hyphenated DB format
const RAW_CODES = [
  "CS303","CS451","CS456","CS507","CS508","CS514","CS522",
  "CS405",  // PDF says CS523 but DB has CS-405 (Verification of Reactive Systems)
  "CS541",  // PDF says CS541P but DB has CS-541 (IoT Systems and the Cloud)
  "CS542","CS544","CS545","CS546","CS549","CS550","CS561",
  "CS563","CS606","CS609","CS611","CS660","CS662","CS670",
  "CS208","CS212","CS214","CS304","CS309","CS313","CS302",
  "AR507","AR516","AR517",
  "BE303","BE502","BE304",
  "EE305","EE530","EE531","EE541","EE543","EE574","EE575","EE608","EE620","EE511",
  "IK502","IK542","IK548","IK570",
  "ME522",
  "CS686",
];

/** Insert hyphen between letter prefix and number: CS303 → CS-303, CS541P → CS-541P */
function normalizeCode(raw: string): string {
  return raw.replace(/^([A-Z]+)(\d.*)$/, "$1-$2");
}

async function main() {
  const codes = RAW_CODES.map(normalizeCode);
  console.log(`Processing ${codes.length} DSAI DE courses...`);

  let added = 0, skipped = 0, missing = 0;

  for (const code of codes) {
    const course = await prisma.course.findFirst({ where: { code } });
    if (!course) {
      console.log(`  ⚠️  Not in DB: ${code}`);
      missing++;
      continue;
    }

    // batch="" means applies to all batches (schema default)
    await prisma.courseBranchMapping.upsert({
      where: {
        courseId_branch_batch: {
          courseId: course.id,
          branch: "DSAI",
          batch: "",
        },
      },
      create: {
        courseId: course.id,
        branch: "DSAI",
        courseCategory: "DE",
        batch: "",
      },
      update: {
        courseCategory: "DE",
      },
    });

    console.log(`  ✅ ${code}`);
    added++;
  }

  console.log(`\nDone — added/updated: ${added}, missing from DB: ${missing}, skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
