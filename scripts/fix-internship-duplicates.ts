import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CourseRow = {
  id: string;
  code: string;
  name: string;
  credits: number;
  offeredInFall: boolean;
  offeredInSpring: boolean;
  offeredInSummer: boolean;
  isPassFailEligible: boolean;
  isActive: boolean;
};

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const dryRun = !apply || args.has("--dry-run");

  const baseInternshipWhere = {
    isActive: true,
    name: { contains: "internship", mode: "insensitive" as const },
    OR: [{ code: { endsWith: "-396" } }, { code: { endsWith: "-399" } }],
  };

  const pfInternshipWhere = {
    isActive: true,
    OR: [{ code: { endsWith: "-396P" } }, { code: { endsWith: "-399P" } }],
  };

  const baseInternships = await prisma.course.findMany({
    where: baseInternshipWhere,
    select: {
      id: true,
      code: true,
      name: true,
      credits: true,
      offeredInFall: true,
      offeredInSpring: true,
      offeredInSummer: true,
      isPassFailEligible: true,
      isActive: true,
    },
    orderBy: { code: "asc" },
  });

  const pfInternships = await prisma.course.findMany({
    where: pfInternshipWhere,
    select: {
      id: true,
      code: true,
      name: true,
      credits: true,
      offeredInFall: true,
      offeredInSpring: true,
      offeredInSummer: true,
      isPassFailEligible: true,
      isActive: true,
    },
    orderBy: { code: "asc" },
  });

  const pfNeedingFix = pfInternships.filter(
    (c: CourseRow) =>
      !c.offeredInFall || !c.offeredInSpring || c.offeredInSummer || !c.isPassFailEligible,
  );

  console.log("\n🧹 Internship catalog cleanup\n");
  console.log(`- Base internship codes active (non-P): ${baseInternships.length}`);
  console.log(`- P-suffix internship codes active: ${pfInternships.length}`);
  console.log(`- P-suffix needing offering/PF fix: ${pfNeedingFix.length}`);
  console.log(`- Mode: ${dryRun ? "DRY RUN (no DB writes)" : "APPLY (DB will be updated)"}\n`);

  if (baseInternships.length > 0) {
    console.log("Sample base internship codes to deactivate (up to 20):");
    baseInternships.slice(0, 20).forEach((c) => {
      console.log(`- ${c.code} (${c.credits} cr) — ${c.name}`);
    });
    console.log("");
  }

  if (pfNeedingFix.length > 0) {
    console.log("Sample P-suffix internship codes to fix (up to 20):");
    pfNeedingFix.slice(0, 20).forEach((c) => {
      console.log(
        `- ${c.code}: offered(F/S/Su)=(${c.offeredInFall ? "Y" : "N"}/${c.offeredInSpring ? "Y" : "N"}/${c.offeredInSummer ? "Y" : "N"}), PF=${c.isPassFailEligible ? "Y" : "N"}`,
      );
    });
    console.log("");
  }

  if (dryRun) {
    console.log("ℹ️  Re-run with `--apply` to deactivate non-P internship codes and fix P-course offerings.\n");
    return;
  }

  const deactivated = await prisma.course.updateMany({
    where: baseInternshipWhere,
    data: { isActive: false },
  });

  const updatedPf = await prisma.course.updateMany({
    where: pfInternshipWhere,
    data: {
      offeredInFall: true,
      offeredInSpring: true,
      offeredInSummer: false,
      isPassFailEligible: true,
    },
  });

  console.log(`✅ Deactivated base internship codes: ${deactivated.count}`);
  console.log(`✅ Updated P-suffix internship offerings/PF: ${updatedPf.count}\n`);
}

main()
  .catch((err) => {
    console.error("❌ Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

