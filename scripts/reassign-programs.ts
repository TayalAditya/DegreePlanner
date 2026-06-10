import prisma from "@/lib/prisma";
import { getProgramLookupBranchCode } from "@/lib/branchInfo";

async function main() {
  const users = await prisma.user.findMany({
    where: { isApproved: true, programs: { none: {} } },
    select: { id: true, branch: true, batch: true, enrollmentId: true, name: true },
  });
  console.log(`Users without program: ${users.length}`);

  let ok = 0, skip = 0;
  for (const u of users) {
    if (!u.branch) { skip++; continue; }
    const code = getProgramLookupBranchCode(u.branch, u.batch);
    let prog = await prisma.program.findUnique({ where: { code } });
    if (!prog) prog = await prisma.program.findUnique({ where: { code: u.branch } });
    if (!prog) { console.log(`  No program for branch=${u.branch} batch=${u.batch}`); skip++; continue; }
    await prisma.userProgram.create({
      data: { userId: u.id, programId: prog.id, programType: "MAJOR", isPrimary: true, startSemester: 1, status: "ACTIVE" },
    });
    ok++;
  }
  console.log(`Done. Enrolled: ${ok} | Skipped: ${skip}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
