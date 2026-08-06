/**
 * Withdraws CS-511 and CS-512 from the current B.Tech pre-registration
 * offering while retaining the BSCS offering and every student's saved-plan
 * history. Run without arguments to audit; pass --apply to write.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const CODES = ["CS-511", "CS-512"];
const BS_BRANCHES = new Set(["BSCS"]);

async function main() {
  const offerings = await prisma.courseOffering.findMany({
    where: { courseCode: { in: CODES }, offeringYear: 2026, isActive: true },
    select: {
      id: true,
      courseCode: true,
      offeringSemester: true,
      offeringYear: true,
      branches: true,
    },
    orderBy: { courseCode: "asc" },
  });

  if (offerings.length !== CODES.length) {
    throw new Error(`Expected one active 2026 offering for each of ${CODES.join(", ")}`);
  }

  const changes = offerings.map((offering) => ({
    ...offering,
    retainedBranches: offering.branches.filter((branch) => BS_BRANCHES.has(branch)),
    removedBranches: offering.branches.filter((branch) => !BS_BRANCHES.has(branch)),
  }));
  if (changes.some((offering) => offering.retainedBranches.length === 0)) {
    throw new Error("Refusing to withdraw the BSCS offering along with B.Tech branches");
  }

  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  for (const offering of changes) {
    console.log(
      `${offering.courseCode} Sem ${offering.offeringSemester}/${offering.offeringYear}: ` +
        `remove [${offering.removedBranches.join(", ")}], retain [${offering.retainedBranches.join(", ")}]`,
    );
  }

  if (!APPLY) {
    console.log("Dry run complete. Re-run with --apply to write.");
    return;
  }

  await prisma.$transaction(
    changes.map((offering) =>
      prisma.courseOffering.update({
        where: { id: offering.id },
        data: { branches: offering.retainedBranches },
      }),
    ),
  );

  const verified = await prisma.courseOffering.findMany({
    where: { id: { in: offerings.map((offering) => offering.id) } },
    select: { courseCode: true, branches: true },
    orderBy: { courseCode: "asc" },
  });
  if (
    verified.length !== CODES.length ||
    verified.some(
      (offering) =>
        offering.branches.length !== 1 ||
        offering.branches[0] !== "BSCS",
    )
  ) {
    throw new Error("B.Tech withdrawal verification failed");
  }

  console.log("Verified: CS-511 and CS-512 are offered to BSCS only for 2026.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
