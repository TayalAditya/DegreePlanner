import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const program = await prisma.program.findFirst({
    where: {
      code: {
        in: ["BTECHCSE", "CSE"],
      },
    },
  });

  console.log(JSON.stringify(program, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
