/**
 * Canonical Program record for the Senate-approved Minor in Entrepreneurship.
 *
 * The planner requirements live in lib/minors.ts because the Minor has a
 * choose-any-two elective basket. This record lets the admin/programme data
 * model identify the Minor with the same code when it is assigned to a
 * student or used by another surface.
 *
 * Run with: npx tsx scripts/seed-entrepreneurship-minor.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const minor = {
  code: "ENTREPRENEURSHIP",
  name: "Minor in Entrepreneurship",
  department: "Indian Institute of Technology Mandi",
  totalCreditsRequired: 11,
  description:
    "Senate 49.3.5 (12 Jun 2026), B23 onwards: IC-202P and DP-302P (5 core credits), plus any two 3-credit electives from GE-523, HS-510, ME-523 and AR-527 (6 credits). Minimum GPA 7.0 across the 11 Minor credits.",
  type: "MINOR" as const,
  icCredits: 0,
  dcCredits: 0,
  deCredits: 0,
  feCredits: 0,
  mtpIstpCredits: 0,
};

async function main() {
  const program = await prisma.program.upsert({
    where: { code: minor.code },
    create: minor,
    update: {
      name: minor.name,
      department: minor.department,
      totalCreditsRequired: minor.totalCreditsRequired,
      description: minor.description,
      type: minor.type,
    },
  });

  console.log(`Synced ${program.code} — ${program.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
