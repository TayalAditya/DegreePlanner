import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Delete all sessions/accounts for sae first (cascade)
  const saeUser = await prisma.user.findUnique({ where: { email: "sae@iitmandi.ac.in" } });
  if (saeUser) {
    await prisma.session.deleteMany({ where: { userId: saeUser.id } });
    await prisma.account.deleteMany({ where: { userId: saeUser.id } });
    await prisma.user.delete({ where: { email: "sae@iitmandi.ac.in" } });
    console.log("✅ Removed sae@iitmandi.ac.in from DB");
  } else {
    console.log("sae@iitmandi.ac.in not found in DB");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
