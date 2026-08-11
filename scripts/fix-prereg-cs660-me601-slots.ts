import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const OFFERING_SEMESTER = 7;
const OFFERING_YEAR = 2026;
const DATA_MINING_CODE = "CS-660";
const NO_SLOT_CODE = "ME-601";

function withoutLabSlots(slots: string | null): string | null {
  if (!slots) return null;

  const remaining = slots
    .split(/[+&,]/)
    .map((slot) => slot.trim())
    .filter(Boolean)
    .filter((slot) => !/^L[1-5]$/i.test(slot));

  return remaining.length > 0 ? remaining.join(" & ") : null;
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (writing to DB)" : "DRY RUN (no writes)"}\n`);

  const offerings = await prisma.courseOffering.findMany({
    where: {
      offeringSemester: OFFERING_SEMESTER,
      offeringYear: OFFERING_YEAR,
      courseCode: { in: [DATA_MINING_CODE, NO_SLOT_CODE] },
    },
    select: { id: true, courseCode: true, courseName: true, slots: true },
    orderBy: { courseCode: "asc" },
  });

  for (const code of [DATA_MINING_CODE, NO_SLOT_CODE]) {
    const matches = offerings.filter((offering) => offering.courseCode === code);
    if (matches.length !== 1) {
      throw new Error(`Expected exactly one ${code} offering for semester ${OFFERING_SEMESTER}/${OFFERING_YEAR}; found ${matches.length}`);
    }
  }

  const dataMining = offerings.find((offering) => offering.courseCode === DATA_MINING_CODE)!;
  const dataMiningSlots = withoutLabSlots(dataMining.slots);
  const removedLab = dataMiningSlots !== dataMining.slots;

  console.log(
    `${DATA_MINING_CODE} ${JSON.stringify(dataMining.slots)} -> ${JSON.stringify(dataMiningSlots)}` +
      (removedLab ? " (lab slot removed)" : " (no lab slot present)"),
  );
  console.log(`${NO_SLOT_CODE} ${JSON.stringify(offerings.find((offering) => offering.courseCode === NO_SLOT_CODE)!.slots)} -> null (NO SLOT)`);

  if (APPLY) {
    await prisma.$transaction([
      prisma.courseOffering.update({
        where: { id: dataMining.id },
        data: { slots: dataMiningSlots },
      }),
      prisma.courseOffering.update({
        where: { id: offerings.find((offering) => offering.courseCode === NO_SLOT_CODE)!.id },
        data: { slots: null },
      }),
    ]);
  }

  const expectedDataMiningSlots = APPLY ? dataMiningSlots : dataMining.slots;
  const expectedMe601Slots = APPLY
    ? null
    : offerings.find((offering) => offering.courseCode === NO_SLOT_CODE)!.slots;

  if (APPLY) {
    const verified = await prisma.courseOffering.findMany({
      where: { id: { in: [dataMining.id, offerings.find((offering) => offering.courseCode === NO_SLOT_CODE)!.id] } },
      select: { courseCode: true, slots: true },
      orderBy: { courseCode: "asc" },
    });
    const verifiedDataMining = verified.find((offering) => offering.courseCode === DATA_MINING_CODE);
    const verifiedMe601 = verified.find((offering) => offering.courseCode === NO_SLOT_CODE);

    if (verifiedDataMining?.slots !== expectedDataMiningSlots || /(?:^|[+&,]\s*)L[1-5](?:$|\s*[+&,])/i.test(verifiedDataMining?.slots ?? "")) {
      throw new Error(`${DATA_MINING_CODE} verification failed: slots=${JSON.stringify(verifiedDataMining?.slots)}`);
    }
    if (verifiedMe601?.slots !== expectedMe601Slots) {
      throw new Error(`${NO_SLOT_CODE} verification failed: slots=${JSON.stringify(verifiedMe601?.slots)}`);
    }

    console.log(`\nVerified: ${DATA_MINING_CODE} slots=${JSON.stringify(verifiedDataMining.slots)}; ${NO_SLOT_CODE} slots=null.`);
  }

  console.log(`\n${APPLY ? "Done — changes written and verified." : "Dry run complete. Re-run with --apply to write."}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
