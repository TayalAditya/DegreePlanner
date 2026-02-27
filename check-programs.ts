import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkPrograms() {
  console.log("\n📚 All Programs in Database:\n");
  
  const programs = await prisma.program.findMany({
    orderBy: { code: "asc" },
  });
  
  console.log(`Total programs: ${programs.length}\n`);
  programs.forEach((p) => {
    console.log(`${p.code} | ${p.name} | Type: ${p.type}`);
  });

  console.log("\n\nChecking CSE specifically:");
  const cse = await prisma.program.findUnique({
    where: { code: "CSE" },
  });
  console.log(cse ? "✅ CSE exists" : "❌ CSE NOT FOUND");
}

checkPrograms()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
