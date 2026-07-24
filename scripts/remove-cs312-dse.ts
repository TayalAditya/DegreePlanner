/**
 * Remove CS-312 (Operating System) as an option for DSE students.
 * DSE cannot take it, so:
 *   - delete the DSE→DE branch mapping
 *   - remove "DSE" from the offering's branch list (hides it in pre-reg)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const c = await prisma.course.findFirst({ where: { code: "CS-312" }, select: { id:true } });
  if (!c) { console.log("CS-312 not found"); return; }

  // 1) delete DSE branch mapping
  const del = await prisma.courseBranchMapping.deleteMany({ where: { courseId: c.id, branch: "DSE" } });
  console.log(`Deleted ${del.count} DSE branch mapping(s)`);

  // 2) remove DSE from offering branch lists
  const offs = await prisma.courseOffering.findMany({ where: { courseCode: "CS-312" }, select: { id:true, branches:true } });
  for (const o of offs) {
    if (o.branches.includes("DSE")) {
      const next = o.branches.filter(b => b !== "DSE");
      await prisma.courseOffering.update({ where: { id: o.id }, data: { branches: next } });
      console.log(`Offering ${o.id}: branches -> ${JSON.stringify(next)}`);
    }
  }
  console.log("Done.");
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
