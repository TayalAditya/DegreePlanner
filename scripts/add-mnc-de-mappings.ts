/**
 * Add MNC DE mappings from official MNC curriculum document.
 * Two baskets + open DE list.
 */
import prisma from "@/lib/prisma";

// Direct course codes from the document (MA-xxx series + cross-dept)
const DIRECT_CODES = [
  // Basket I: Foundation Module
  "MA-251","MA-252","MA-253","MA-254","MA-255",
  // Basket II: Advanced Modelling Module
  "MA-351","MA-352","MA-353","MA-354","MA-355","MA-356","MA-357",
  // Additional MA electives visible in DB
  "MA-460","MA-465","MA-525","MA-526","MA-527","MA-528","MA-529",
  "MA-546","MA-548","MA-550","MA-551","MA-553","MA-555","MA-560",
  "MA-563","MA-565","MA-568","MA-571","MA-572","MA-582P","MA-588",
  "MA-595","MA-601","MA-603","MA-604","MA-605","MA-607","MA-608",
  "MA-610","MA-612","MA-621","MA-641","MA-644","MA-650","MA-651",
  "MA-652","MA-653","MA-654","MA-655","MA-656","MA-665",
  // Cross-department courses named in MNC DE list
  "CS-362",   // Artificial Intelligence
  "CS-313",   // Computer Networks
  "CS-503",   // Compiler Design (CS-502 is another option)
  "CS-502",   // Compiler Design
  "CS-306",   // Operating Systems
  "CS-514",   // Advanced Data Structure and Algorithms
  "CS-580",   // Advanced Data Structures
  "CS-609",   // Speech Processing
  "CS-669",   // Pattern Recognition
  "CS-677",   // Soft Computing
  "CS-606",   // Computational Modeling of Social Systems
  "CS-302",   // Paradigms of Programming
  "CS-309",   // Information Systems and Databases
  "CS-563",   // Scalable Data Science / Big Data
  "EE-511",   // Computer Vision
  "EE-608",   // Digital Image Processing
  "EE-203",   // Network Theory
  "EE-260",   // Signals and Systems
  "EE-301",   // Control Systems
  "EE-530",   // Applied Optimization
  "DS-201",   // Data Handling and Visualization
  "DS-302",   // Computing Systems for Data Processing
  "BE-304",   // Bioinformatics
  "BE-303",   // Applied Biostatistics
  "CE-251",   // Hydraulics Engineering
  "ME-210",   // Fluid Mechanics
  "ME-303",   // Heat Transfer
  "ME-213",   // Engineering Thermodynamics / Thermodynamics
  "MA-605",   // Statistical Data Analysis (also in list above)
  "MA-322",   // Applied Graph Theory (relevant for MNC)
  "MA-221",   // Numerical Analysis
  "MA-222",   // Applied Linear Programming
  "QT-301",   // Survey of Quantum Technologies
];

async function main() {
  // Deduplicate
  const codes = [...new Set(DIRECT_CODES)];
  console.log(`Processing ${codes.length} MNC DE course codes...`);

  let added = 0, missing = 0;

  for (const code of codes) {
    const course = await prisma.course.findFirst({ where: { code } });
    if (!course) {
      console.log(`  ⚠️  Not in DB: ${code}`);
      missing++;
      continue;
    }

    await prisma.courseBranchMapping.upsert({
      where: { courseId_branch_batch: { courseId: course.id, branch: "MNC", batch: "" } },
      create: { courseId: course.id, branch: "MNC", courseCategory: "DE", batch: "" },
      update: { courseCategory: "DE" },
    });

    console.log(`  ✅ ${code} — ${course.name}`);
    added++;
  }

  console.log(`\nDone — added/updated: ${added}, missing from DB: ${missing}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
