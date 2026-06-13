import { creditCalculator } from "@/lib/creditCalculator";
import prisma from "@/lib/prisma";

async function main() {
  const students = await prisma.user.findMany({
    where: { enrollmentId: { in: ["B23243", "B25007", "B24034"] } },
    select: { id: true, name: true, enrollmentId: true, batch: true, branch: true },
  });

  for (const u of students) {
    const up = await prisma.userProgram.findFirst({
      where: { userId: u.id, isPrimary: true },
      include: { program: { select: { code: true, icCredits: true } } },
    });
    if (!up) { console.log(u.enrollmentId, u.name, "- no program"); continue; }

    const prog = await creditCalculator.calculateProgramProgress(u.id, up.programId);
    const r = prog.creditsRequiredByCategory;
    const ic = up.program.icCredits;
    const expectedHss = ic <= 52 ? 12 : 15;
    const expectedIc = ic - 6 - expectedHss;

    const hssOk = r.HSS === expectedHss ? "✅" : `❌ (got ${r.HSS})`;
    const iksOk = (r.IKS ?? 0) === 0 ? "✅" : `❌ IKS still separate (${r.IKS})`;
    const icOk = r.IC === expectedIc ? "✅" : `❌ (got ${r.IC}, expected ${expectedIc})`;

    console.log(`\n${u.enrollmentId} ${u.name} (${up.program.code} icCredits=${ic})`);
    console.log(`  IC  required: ${r.IC}/${expectedIc} ${icOk}`);
    console.log(`  HSS required: ${r.HSS}/${expectedHss} ${hssOk}`);
    console.log(`  IKS required: ${r.IKS ?? 0}/0 ${iksOk}`);
    console.log(`  HSS done: ${prog.completed?.HSS ?? "n/a"} | IKS done: ${prog.completed?.IKS ?? "n/a"}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
