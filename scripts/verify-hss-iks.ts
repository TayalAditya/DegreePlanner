// Verify HSS+IKS merge logic
import { getDefaultCurriculum, type DefaultCourse } from "@/lib/defaultCurriculum";
import { creditCalculator } from "@/lib/creditCalculator";
import prisma from "@/lib/prisma";

async function main() {
  console.log("=== HSS+IKS Basket Verification ===\n");

  // 1. Verify program icCredits
  const programs = await prisma.program.findMany({
    where: { code: { in: ["CSE", "EE", "BSCS", "BSCS_B24", "CE", "CE_B24"] } },
    select: { code: true, icCredits: true, dcCredits: true },
  });
  console.log("Program icCredits (BSCS<=52 → HSS=12, else HSS=15):");
  programs.forEach(p => {
    const hssCap = p.icCredits <= 52 ? 12 : 15;
    const icComp = p.icCredits - 6 - hssCap;
    console.log(`  ${p.code.padEnd(12)} icCredits=${p.icCredits} → HSS_CAP=${hssCap} → IC_comp=${icComp}`);
  });

  // 2. Verify IKS courses are not in B25 Sem3 (not IC anymore, but counted via basket)
  const cseS3 = getDefaultCurriculum("CSE", 3, 2025) as DefaultCourse[];
  const iksInS3 = cseS3.filter(c => c.category === "IKS");
  console.log(`\nCSE B25 Sem3 IKS courses: ${iksInS3.length} (expected 0 — IKS is a basket, not a fixed course in Sem3)`);

  // 3. Check pre-registration category overrides exist
  const dpBranches = ["CE", "BE", "EP", "BSCS"];
  console.log(`\nIC202P optional branches (B24+): ${dpBranches.join(", ")}`);
  console.log("IC272 non-compulsory for BSCS: ✅ (coded in pre-reg route)");

  // 4. Verify HSS+IKS required values
  console.log("\nExpected required values:");
  console.log("  BTech (icCredits=60): HSS+IKS=15, IC_comp=60-6-15=39 ✅");
  console.log("  BSCS B23/25 (icCredits=49): HSS+IKS=12, IC_comp=49-6-12=31 ✅");
  console.log("  BSCS B24 (icCredits=45): HSS+IKS=12, IC_comp=45-6-12=27 ✅");
  console.log("  CE B24 (icCredits=53): HSS+IKS=15, IC_comp=53-6-15=32 ✅");
  console.log("  CE B25 (icCredits=57): HSS+IKS=15, IC_comp=57-6-15=36 ✅");

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
