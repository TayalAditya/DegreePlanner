import { PrismaClient, CourseCategoryType } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const BRANCHES = ["MEVLSI", "VL", "VLSI"];
const BATCH_VALUES = [2025, 25];
const OFFERING_SEMESTER = 3;
const OFFERING_YEAR = 2026;

function migrateRegistrationTypes(
  value: unknown,
  vl201OfferingId: string,
  ee311OfferingId: string,
): Record<string, string> {
  const types = value && typeof value === "object"
    ? { ...(value as Record<string, string>) }
    : {};
  if (types[vl201OfferingId] && !types[ee311OfferingId]) {
    types[ee311OfferingId] = types[vl201OfferingId];
  }
  delete types[vl201OfferingId];
  return types;
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (writing to DB)" : "DRY RUN (no writes)"}\n`);

  const [ee311, vl201, offerings, users] = await Promise.all([
    prisma.course.findUnique({ where: { code: "EE-311" }, select: { id: true } }),
    prisma.course.findUnique({ where: { code: "VL-201" }, select: { id: true } }),
    prisma.courseOffering.findMany({
      where: { offeringYear: OFFERING_YEAR, courseCode: { in: ["EE-311", "VL-201"] } },
      select: { id: true, courseCode: true },
    }),
    prisma.user.findMany({
      where: { branch: { in: BRANCHES }, batch: { in: BATCH_VALUES } },
      select: { id: true },
    }),
  ]);

  if (!ee311 || !vl201) throw new Error("EE-311 or VL-201 catalog course is missing");
  const ee311Offering = offerings.find((offering) => offering.courseCode === "EE-311");
  const vl201Offering = offerings.find((offering) => offering.courseCode === "VL-201");
  if (!ee311Offering || !vl201Offering) throw new Error("EE-311 or VL-201 Fall 2026 offering is missing");

  const plans = await prisma.preRegistrationPlan.findMany({
    where: {
      userId: { in: users.map((user) => user.id) },
      offeringSemester: OFFERING_SEMESTER,
      offeringYear: OFFERING_YEAR,
    },
    select: { id: true, selectedIds: true, registrationTypes: true },
  });

  const planChanges = plans.flatMap((plan) => {
    if (!plan.selectedIds.includes(vl201Offering.id)) return [];
    const selectedIds = Array.from(new Set(
      plan.selectedIds.map((id) => id === vl201Offering.id ? ee311Offering.id : id),
    ));
    return [{
      id: plan.id,
      selectedIds,
      registrationTypes: migrateRegistrationTypes(
        plan.registrationTypes,
        vl201Offering.id,
        ee311Offering.id,
      ),
    }];
  });

  const staleVlMappings = await prisma.courseBranchMapping.findMany({
    where: {
      courseId: vl201.id,
      branch: "MEVLSI",
      batch: { in: ["2025", "B25"] },
    },
    select: { id: true, batch: true, courseCategory: true, semester: true },
  });

  console.log(`Affected students: ${users.length}`);
  console.log(`Saved plans: ${plans.length}; plans migrating VL-201 -> EE-311: ${planChanges.length}`);
  console.log(`Stale B25 VL-201 mappings to remove: ${staleVlMappings.length}`);
  console.log("Ensure mapping: EE-311 / MEVLSI / batch 2025 / DC / semester 3");

  if (APPLY) {
    await prisma.$transaction(async (tx) => {
      await tx.courseBranchMapping.upsert({
        where: {
          courseId_branch_batch: {
            courseId: ee311.id,
            branch: "MEVLSI",
            batch: "2025",
          },
        },
        create: {
          courseId: ee311.id,
          branch: "MEVLSI",
          batch: "2025",
          courseCategory: CourseCategoryType.DC,
          semester: 3,
        },
        update: { courseCategory: CourseCategoryType.DC, semester: 3 },
      });

      if (staleVlMappings.length > 0) {
        await tx.courseBranchMapping.deleteMany({
          where: { id: { in: staleVlMappings.map((mapping) => mapping.id) } },
        });
      }

      for (const plan of planChanges) {
        await tx.preRegistrationPlan.update({
          where: { id: plan.id },
          data: {
            selectedIds: plan.selectedIds,
            registrationTypes: plan.registrationTypes,
          },
        });
      }
    });

    const [verifiedEeMapping, remainingVlMappings, verifiedPlans] = await Promise.all([
      prisma.courseBranchMapping.findUnique({
        where: {
          courseId_branch_batch: {
            courseId: ee311.id,
            branch: "MEVLSI",
            batch: "2025",
          },
        },
        select: { courseCategory: true, semester: true },
      }),
      prisma.courseBranchMapping.count({
        where: {
          courseId: vl201.id,
          branch: "MEVLSI",
          batch: { in: ["2025", "B25"] },
        },
      }),
      prisma.preRegistrationPlan.findMany({
        where: {
          userId: { in: users.map((user) => user.id) },
          offeringSemester: OFFERING_SEMESTER,
          offeringYear: OFFERING_YEAR,
        },
        select: { selectedIds: true },
      }),
    ]);

    const plansWithVl201 = verifiedPlans.filter((plan) => plan.selectedIds.includes(vl201Offering.id)).length;
    if (verifiedEeMapping?.courseCategory !== CourseCategoryType.DC || verifiedEeMapping.semester !== 3) {
      throw new Error(`EE-311 mapping verification failed: ${JSON.stringify(verifiedEeMapping)}`);
    }
    if (remainingVlMappings !== 0 || plansWithVl201 !== 0) {
      throw new Error(`Verification failed: VL mappings=${remainingVlMappings}, plans with VL-201=${plansWithVl201}`);
    }
    console.log(`\nVerified: EE-311 mapping is DC/S3; VL-201 B25 mappings=0; plans with VL-201=0.`);
  }

  console.log(`\n${APPLY ? "Done — changes written and verified." : "Dry run complete. Re-run with --apply to write."}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
