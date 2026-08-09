import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Catalogue placement only. Credit, eligibility, course-mapping and offering
// data intentionally remain unchanged.
const DEPARTMENT_BY_CODE: Record<string, string> = {
  "CED-201": "School of Chemical Sciences",
  "HC-600": "School of Humanities & Social Sciences",
  "QS-501": "School of Physical Sciences / CQST",
  "QS-501P": "School of Physical Sciences / CQST",
  "QT-301": "School of Physical Sciences / CQST",
  "QT-406": "School of Physical Sciences / CQST",
  "QT-407": "School of Physical Sciences / SQST",
  "QT-509": "School of Physical Sciences / CQST",
  "SC-600": "School of Humanities & Social Sciences",
};

async function main() {
  const codes = Object.keys(DEPARTMENT_BY_CODE);
  const found = await prisma.course.findMany({
    where: { code: { in: codes } },
    select: { code: true, department: true },
  });
  const foundCodes = new Set(found.map(({ code }) => code));
  const missing = codes.filter((code) => !foundCodes.has(code));
  if (missing.length > 0) {
    throw new Error(`Cannot move missing course(s): ${missing.join(", ")}`);
  }

  for (const code of codes) {
    const department = DEPARTMENT_BY_CODE[code];
    const previous = found.find((course) => course.code === code)?.department;
    await prisma.course.update({ where: { code }, data: { department } });
    console.log(`${code}: ${previous} -> ${department}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
