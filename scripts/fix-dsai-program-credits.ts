import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Fix the DSAI Program row.
 *
 * DSAI was seeded by copying DSE's credit structure (DC=33, DE=33). But the authoritative
 * DC IIT Mandi source gives DSAI DC = 31 (9 courses: CS-213, DS-313, DS-412, DS-411, DS-302,
 * DS-413, CS-305, DS-417, DS-418). With IC 60 + FE 22 + MTP 12 fixed and total 160, the
 * discipline-elective budget must be DE = 160 - 60 - 31 - 22 - 12 = 35, not 33.
 * So: DC 33 -> 31, DE 33 -> 35 (DC+DE stays at the 66 budget).
 */
async function main() {
  const before = await prisma.program.findFirst({ where: { code: "DSAI" } });
  if (!before) { console.log("DSAI Program row not found"); return; }
  console.log(`Before: DC=${before.dcCredits} DE=${before.deCredits} FE=${before.feCredits} IC=${before.icCredits} tot=${before.totalCreditsRequired}`);

  if (before.dcCredits === 31 && before.deCredits === 35) {
    console.log("Already correct — nothing to do.");
    return;
  }

  const after = await prisma.program.update({
    where: { id: before.id },
    data: { dcCredits: 31, deCredits: 35 },
  });
  console.log(`After : DC=${after.dcCredits} DE=${after.deCredits} FE=${after.feCredits} IC=${after.icCredits} tot=${after.totalCreditsRequired}`);
  const sum = after.icCredits + after.dcCredits + after.deCredits + after.feCredits + after.mtpIstpCredits;
  console.log(`Sum check: ${sum} === ${after.totalCreditsRequired} -> ${sum === after.totalCreditsRequired ? "OK" : "MISMATCH"}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
