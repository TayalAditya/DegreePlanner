// me206-mse-b25-s3-dc.mjs — ME-206 as DC sem-3 for MSE B25 (idempotent)
// B25 MSE students take ME-206 in S3 (B24 MSE already did it in S3).
// Adds a batch-specific mapping (batch="2025") which overrides the generic
// MSE mapping (batch="", sem=5) for B25 only — B23/B24 MSE unaffected.
// Run: npx tsx scripts/me206-mse-b25-s3-dc.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CODE = 'ME-206', BRANCH = 'MSE', BATCH = '2025', CAT = 'DC', SEM = 3;

const c = await prisma.course.findFirstOrThrow({ where: { code: CODE }, select: { id: true } });
const where = { courseId_branch_batch: { courseId: c.id, branch: BRANCH, batch: BATCH } };
const existing = await prisma.courseBranchMapping.findUnique({ where, select: { courseCategory: true, semester: true } });

if (existing) {
  if (existing.courseCategory !== CAT || existing.semester !== SEM) {
    await prisma.courseBranchMapping.update({ where, data: { courseCategory: CAT, semester: SEM } });
    console.log(`UPDATED ${CODE} ${BRANCH} B${BATCH} → ${CAT} sem=${SEM}`);
  } else {
    console.log(`OK      ${CODE} ${BRANCH} B${BATCH} already ${CAT} sem=${SEM}`);
  }
} else {
  await prisma.courseBranchMapping.create({ data: { courseId: c.id, branch: BRANCH, batch: BATCH, courseCategory: CAT, semester: SEM } });
  console.log(`CREATED ${CODE} ${BRANCH} B${BATCH} ${CAT} sem=${SEM}`);
}

await prisma.$disconnect();
