import { getCurriculumBranchCode } from "@/lib/branchInfo";
import { getMtpCourseCode, MTP_COMPONENT_CREDITS } from "@/lib/mtpConfig";
import { ICB1_CODES, ICB2_CODES, IC_BASKET_COMPULSIONS, normalizeBranchForIcBasket } from "@/lib/icBasketConfig";

// Default curriculum for each branch (B23 batch, IIT Mandi)
// IC course semester assignments confirmed by B23 students.
// DC course semester assignments verified against docs/DC_Courses_Batch_2023_filled.xlsx.
export interface DefaultCourse {
  code: string;
  name: string;
  credits: number;
  category: "IC" | "ICB" | "HSS" | "IKS" | "DC" | "DE" | "FE" | "ISTP" | "MTP";
  semester: number;
  /** If true, shown unchecked by default in import-courses (student must opt in) */
  optional?: boolean;
  /** Short label shown as a badge in import-courses UI (e.g. "Jan–May 2024") */
  tag?: string;
}

// ─── IC Compulsory – common to all B.Tech branches ───────────────────────────
const icCompSem1: DefaultCourse[] = [
  { code: "IC112",  name: "Calculus",                              credits: 2, category: "IC",  semester: 1 },
  { code: "IC113",  name: "Complex Variables and Vector Calculus", credits: 2, category: "IC",  semester: 1 },
  { code: "IC152",  name: "Computing and Data Science",            credits: 4, category: "IC",  semester: 1 },
];

// IC140, IC102P, IC181: mixed groups — some students had these in Sem-1, others Sem-2.
// Both semesters include them; students uncheck the ones not taken that semester.
const icMixedSem1: DefaultCourse[] = [
  { code: "IC140",  name: "Engineering Graphics for Design",   credits: 4, category: "IC",  semester: 1 },
  { code: "IC102P", name: "Foundations of Design Practicum",  credits: 4, category: "IC",  semester: 1 },
  { code: "IC181",  name: "Indian Knowledge Systems",          credits: 3, category: "IKS", semester: 1 },
];

const icCompSem2: DefaultCourse[] = [
  { code: "IC161",  name: "Applied Electronics",        credits: 3, category: "IC", semester: 2 },
  { code: "IC114",  name: "Linear Algebra",             credits: 2, category: "IC", semester: 2 },
  { code: "IC115",  name: "ODE & Integral Transforms",  credits: 2, category: "IC", semester: 2 },
  { code: "IC161P", name: "Applied Electronics Lab",    credits: 2, category: "IC", semester: 2 },
  { code: "IC222P", name: "Physics Practicum",          credits: 2, category: "IC", semester: 2 },
  { code: "IC252",  name: "Probability and Statistics", credits: 4, category: "IC", semester: 2 },
];

const icMixedSem2: DefaultCourse[] = [
  { code: "IC140",  name: "Engineering Graphics for Design",   credits: 4, category: "IC",  semester: 2 },
  { code: "IC102P", name: "Foundations of Design Practicum",  credits: 4, category: "IC",  semester: 2 },
  { code: "IC181",  name: "Indian Knowledge Systems",          credits: 3, category: "IKS", semester: 2 },
];

// ─── IC Basket courses (one from IC-I in Sem-1; one from IC-II in Sem-2) ─────
// IC-I options
const ICB1_IC131: DefaultCourse = { code: "IC131", name: "Applied Chemistry for Engineers",                  credits: 3, category: "ICB", semester: 1 };
const ICB1_IC136: DefaultCourse = { code: "IC136", name: "Understanding Biotechnology and its Applications", credits: 3, category: "ICB", semester: 1 };
const ICB1_IC230: DefaultCourse = { code: "IC230", name: "Environmental Science",                            credits: 3, category: "ICB", semester: 1 };
const allICB1: DefaultCourse[]  = [ICB1_IC131, ICB1_IC136, ICB1_IC230];

// IC-II options
const ICB2_IC121: DefaultCourse = { code: "IC121", name: "Mechanics of Particles and Waves",  credits: 3, category: "ICB", semester: 2 };
const ICB2_IC240: DefaultCourse = { code: "IC240", name: "Mechanics of Rigid Bodies",          credits: 3, category: "ICB", semester: 2 };
const ICB2_IC241: DefaultCourse = { code: "IC241", name: "Material Science for Engineers",     credits: 3, category: "ICB", semester: 2 };
const ICB2_IC253: DefaultCourse = { code: "IC253", name: "Data Structures and Algorithms",     credits: 3, category: "ICB", semester: 2 };
const allICB2: DefaultCourse[]  = [ICB2_IC121, ICB2_IC240, ICB2_IC241, ICB2_IC253];

// IC202P + IC272 appear in Sem-3 for most branches.
// For ME/EE/BE/DSE/EP/BSCS, IC202P is taken in Sem-4.
const icSem3: DefaultCourse[] = [
  { code: "IC202P", name: "Design Practicum", credits: 3, category: "IC", semester: 3 },
  { code: "IC272",  name: "Machine Learning", credits: 3, category: "IC", semester: 3 },
];

const icSem3WithoutIC202P: DefaultCourse[] = [
  { code: "IC272", name: "Machine Learning", credits: 3, category: "IC", semester: 3 },
];

const ic202pSem4: DefaultCourse[] = [
  { code: "IC202P", name: "Design Practicum", credits: 3, category: "IC", semester: 4 },
];

// ISTP and MTP courses (common for all BTech)
const istpSem6: DefaultCourse[] = [
  { code: "DP 301P", name: "Interdisciplinary Socio-Technical Practicum", credits: 4, category: "ISTP", semester: 6 },
];

const mtpSem7: DefaultCourse[] = [
  { code: "DP 498P", name: "Major Technical Project - I", credits: MTP_COMPONENT_CREDITS, category: "MTP", semester: 7 },
];

const mtpSem8: DefaultCourse[] = [
  { code: "DP 499P", name: "Major Technical Project - II", credits: MTP_COMPONENT_CREDITS, category: "MTP", semester: 8 },
];

// ─── CSE  (DC = 38 cr | IC-I: free choice | IC-II: free choice) ──────────────
const cseSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const cseSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const cseSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "CS208", name: "Mathematical Foundations of Computer Science", credits: 4, category: "DC", semester: 3 },
  { code: "CS214", name: "Computer Organization",                        credits: 4, category: "DC", semester: 3 },
  { code: "CS212", name: "Design of Algorithms",                         credits: 4, category: "DC", semester: 3 },
  { code: "CS213", name: "Reverse Engineering",                          credits: 1, category: "DC", semester: 3 },
];
const cseSem4: DefaultCourse[] = [
  { code: "CS304", name: "Formal Language and Automata Theory", credits: 3, category: "DC", semester: 4 },
  { code: "CS309", name: "Information Systems and Databases",   credits: 4, category: "DC", semester: 4 },
];
const cseSem5: DefaultCourse[] = [
  { code: "CS313", name: "Computer Networks",       credits: 4, category: "DC", semester: 5 },
  { code: "CS312", name: "Operating Systems",       credits: 4, category: "DC", semester: 5 },
  { code: "CS305", name: "Artificial Intelligence", credits: 3, category: "DC", semester: 5 },
];
const cseSem6: DefaultCourse[] = [
  { code: "CS302", name: "Paradigms of Programming", credits: 4, category: "DC", semester: 6 },
  { code: "CS303", name: "Software Engineering",     credits: 3, category: "DC", semester: 6 },
  ...istpSem6,
];
const cseSem7: DefaultCourse[] = [...mtpSem7];
const cseSem8: DefaultCourse[] = [
  { code: "CS010", name: "Internship", credits: 2, category: "IC", semester: 8 },
  ...mtpSem8,
];

// ─── DSE  (DC = 33 cr | IC-I: free choice | IC-II: free choice) ──────────────
const dseSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const dseSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const dseSem3: DefaultCourse[] = [
  ...icSem3WithoutIC202P,
  { code: "DS201", name: "Data Handling and Vizualisation",          credits: 3, category: "DC", semester: 3 },
  { code: "DS301", name: "Mathematical Foundations of Data Science", credits: 4, category: "DC", semester: 3 },
  { code: "CS213", name: "Reverse Engineering",                      credits: 1, category: "DC", semester: 3 },
];
const dseSem4: DefaultCourse[] = [
  ...ic202pSem4,
  { code: "DS302", name: "Computing Systems for Data Processing",   credits: 3, category: "DC", semester: 4 },
  { code: "DS313", name: "Statistical Foundations of Data Science", credits: 4, category: "DC", semester: 4 },
  { code: "DS404", name: "Information Security and Privacy",        credits: 3, category: "DC", semester: 4 },
  { code: "DS412", name: "Matrix Computations for Data Science",    credits: 4, category: "DC", semester: 4 },
];
const dseSem5: DefaultCourse[] = [
  { code: "CS305", name: "Artificial Intelligence",             credits: 3, category: "DC", semester: 5 },
  { code: "DS413", name: "Introduction to Statistical Learning", credits: 4, category: "DC", semester: 5 },
];
const dseSem6: DefaultCourse[] = [
  { code: "DS411", name: "Optimization for Data Science", credits: 4, category: "DC", semester: 6 },
  ...istpSem6,
];
const dseSem7: DefaultCourse[] = [...mtpSem7];
const dseSem8: DefaultCourse[] = [
  { code: "DS010", name: "Internship", credits: 2, category: "IC", semester: 8 },
  ...mtpSem8,
];

// ─── DSAI (B25+) – standalone curriculum, diverges significantly from DSE ─────
// DC = 31 cr. Key differences from DSE:
//   DS313 + DS412 → Sem 3 (DSE has them in Sem 4); DS301/DS201/DS404 dropped;
//   DS411 renamed "Optimization for ML"; CS305→CS362; DS413 renamed "Fundamentals of ML";
//   DS417 (Deep Learning) + DS418 (Gen AI) new in Sem 6.
//   ISTP (DP301P) remains as an ISTP basket entry (optional, not a required DC).
//   Sem 1-2 IC course differences handled in applyBatchOverrides (batch 2025, DSAI).
const dsaiSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const dsaiSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const dsaiSem3: DefaultCourse[] = [
  ...icSem3WithoutIC202P,
  { code: "CS213", name: "Reverse Engineering",                  credits: 1, category: "DC", semester: 3 },
  { code: "DS313", name: "Probability Theory and Statistics",    credits: 4, category: "DC", semester: 3 },
  { code: "DS412", name: "Matrix Computations for Data Science", credits: 4, category: "DC", semester: 3 },
];
const dsaiSem4: DefaultCourse[] = [
  { code: "IC202P", name: "Design Practicum",                      credits: 3, category: "IC", semester: 4 },
  { code: "DS411",  name: "Optimization for Machine Learning",     credits: 4, category: "DC", semester: 4 },
  { code: "DS302",  name: "Computing Systems for Data Processing", credits: 3, category: "DC", semester: 4 },
];
const dsaiSem5: DefaultCourse[] = [
  { code: "DS413", name: "Fundamentals of Machine Learning", credits: 4, category: "DC", semester: 5 },
  { code: "CS305", name: "Artificial Intelligence",          credits: 3, category: "DC", semester: 5 },
];
const dsaiSem6: DefaultCourse[] = [
  { code: "DS417", name: "Deep Learning",                 credits: 4, category: "DC", semester: 6 },
  { code: "DS418", name: "Introduction to Generative AI", credits: 4, category: "DC", semester: 6 },
  // ISTP is an optional basket for DSAI B25 — skipping it adds +4 FE credits instead.
  { code: "DP 301P", name: "Interdisciplinary Socio-Technical Practicum", credits: 4, category: "ISTP", semester: 6, optional: true },
];
const dsaiSem7: DefaultCourse[] = [
  ...mtpSem7,
];
const dsaiSem8: DefaultCourse[] = [
  { code: "DS010", name: "Internship", credits: 2, category: "IC", semester: 8 },
  ...mtpSem8,
];

// ─── EE  (DC = 52 cr | both IC baskets: free choice) ─────────────────────────
const eeSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const eeSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const eeSem3: DefaultCourse[] = [
  ...icSem3WithoutIC202P,
  { code: "EE203",  name: "Network Theory",                   credits: 3, category: "DC", semester: 3 },
  { code: "EE210",  name: "Digital System Design",            credits: 3, category: "DC", semester: 3 },
  { code: "EE210P", name: "Digital Systems Design Practicum", credits: 1, category: "DC", semester: 3 },
  { code: "EE260",  name: "Signals and Systems",              credits: 3, category: "DC", semester: 3 },
  { code: "EE261",  name: "Electrical Systems Around Us",     credits: 3, category: "DC", semester: 3 },
  { code: "EE261P", name: "Electrical Systems Around Us Lab", credits: 2, category: "DC", semester: 3 },
  { code: "EE311",  name: "Device Electronics",               credits: 3, category: "DC", semester: 3 },
];
const eeSem4: DefaultCourse[] = [
  ...ic202pSem4,
  { code: "EE201",  name: "Electro-Mechanics",                   credits: 3, category: "DC", semester: 4 },
  { code: "EE201P", name: "Electro-Mechanics Lab",               credits: 1, category: "DC", semester: 4 },
  { code: "EE202",  name: "Electromagnetics & Wave Propagation", credits: 3, category: "DC", semester: 4 },
  { code: "EE211",  name: "Analog Circuit Design",               credits: 3, category: "DC", semester: 4 },
  { code: "EE304",  name: "Communication Systems",               credits: 4, category: "DC", semester: 4 },
  { code: "EE223P", name: "Reverse Engineering",                 credits: 1, category: "DC", semester: 4 },
];
const eeSem5: DefaultCourse[] = [
  { code: "EE231", name: "Measurement and Instrumentation",                         credits: 3, category: "DC", semester: 5 },
  { code: "EE302", name: "Control Systems",                                         credits: 4, category: "DC", semester: 5 },
  { code: "EE303", name: "Power Systems",                                           credits: 4, category: "DC", semester: 5 },
  { code: "EE314", name: "Digital Signal Processing",                               credits: 4, category: "DC", semester: 5 },
  { code: "EE326", name: "Computer Organization & Processor Architecture Design",   credits: 4, category: "DC", semester: 5 },
];
const eeSem6: DefaultCourse[] = [
  ...istpSem6,
];
const eeSem7: DefaultCourse[] = [...mtpSem7];
const eeSem8: DefaultCourse[] = [
  { code: "EE010", name: "Internship", credits: 2, category: "IC", semester: 8 },
  ...mtpSem8,
];

// ─── ME  (DC = 50 cr | IC-I: free choice | IC-II: free choice) ───────────────
// IC-II for ME: IC241 (Material Science) is DC for ME → exclude it from ICB2 basket
const meICB2: DefaultCourse[] = [ICB2_IC121, ICB2_IC240, ICB2_IC253];
const meSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const meSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...meICB2];
const meSem3: DefaultCourse[] = [
  ...icSem3WithoutIC202P,
  { code: "EE261", name: "Electrical Systems Around Us",        credits: 3, category: "DC", semester: 3 },
  { code: "IC241", name: "Material Science for Engineers",      credits: 3, category: "DC", semester: 3 },
  { code: "ME100", name: "Reverse Engineering",                 credits: 1, category: "DC", semester: 3 },
  { code: "ME205", name: "Machine Drawing",                     credits: 3, category: "DC", semester: 3 },
  { code: "ME210", name: "Fluid Mechanics",                     credits: 3, category: "DC", semester: 3 },
  { code: "ME212", name: "Product Manufacturing Technologies",  credits: 3, category: "DC", semester: 3 },
  { code: "ME213", name: "Engineering Thermodynamics",          credits: 4, category: "DC", semester: 3 },
  { code: "ME308", name: "Manufacturing Engineering 1",         credits: 3, category: "DC", semester: 3 },
  { code: "ME310", name: "System Dynamics and Control",         credits: 3, category: "DC", semester: 3 },
];
const meSem4: DefaultCourse[] = [
  ...ic202pSem4,
  { code: "ME206",  name: "Mechanics of Solids",           credits: 3, category: "DC", semester: 4 },
  { code: "ME210P", name: "Fluid Mechanics Lab",           credits: 1, category: "DC", semester: 4 },
  { code: "ME303",  name: "Heat Transfer",                 credits: 3, category: "DC", semester: 4 },
  { code: "ME307",  name: "Energy Conversion Devices",     credits: 3, category: "DC", semester: 4 },
  { code: "ME309",  name: "Theory of Machines",            credits: 4, category: "DC", semester: 4 },
];
const meSem5: DefaultCourse[] = [
  { code: "ME303P", name: "Heat Transfer Lab",          credits: 1, category: "DC", semester: 5 },
  { code: "ME305",  name: "Design of Machine Elements", credits: 4, category: "DC", semester: 5 },
  { code: "ME311P", name: "Design Lab 1",               credits: 1, category: "DC", semester: 5 },
  { code: "ME315",  name: "Manufacturing Engineering 2", credits: 3, category: "DC", semester: 5 },
];
const meSem6: DefaultCourse[] = [
  { code: "ME312P", name: "Design Lab 2", credits: 1, category: "DC", semester: 6 },
  ...istpSem6,
];
const meSem7: DefaultCourse[] = [...mtpSem7];
const meSem8: DefaultCourse[] = [
  { code: "ME010", name: "Internship", credits: 2, category: "IC", semester: 8 },
  ...mtpSem8,
];

// ─── CE  (DC = 49 cr | IC-I: free choice | IC-II: free choice) ───────────────
const ceSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const ceSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const ceSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "CE202",  name: "Introduction to Civil Engineering Profession",    credits: 1, category: "DC", semester: 3 },
  { code: "CE203",  name: "Construction Materials",                          credits: 3, category: "DC", semester: 3 },
  { code: "CE252",  name: "Geology and Geomorphology",                        credits: 3, category: "DC", semester: 3 },
  { code: "CE301",  name: "Strength of Materials and Structures",             credits: 3, category: "DC", semester: 3 },
  { code: "CE301P", name: "Strength of Materials and Structures Lab",         credits: 1, category: "DC", semester: 3 },
  { code: "CE354P", name: "Construction Materials Lab",                       credits: 1, category: "DC", semester: 3 },
];
const ceSem4: DefaultCourse[] = [
  { code: "CE201",  name: "Surveying Traditional and Digital",    credits: 4, category: "DC", semester: 4 },
  { code: "CE251",  name: "Hydraulics Engineering",               credits: 3, category: "DC", semester: 4 },
  { code: "CE302",  name: "Geotechnical Engineering I",           credits: 3, category: "DC", semester: 4 },
  { code: "CE302P", name: "Geotechnical Engineering Lab",         credits: 1, category: "DC", semester: 4 },
  { code: "CE304P", name: "Hydraulics Engineering Lab",           credits: 1, category: "DC", semester: 4 },
  { code: "CE404",  name: "Analysis of Structures",               credits: 3, category: "DC", semester: 4 },
];
const ceSem5: DefaultCourse[] = [
  { code: "CE303",  name: "Water Resources Engineering",              credits: 3, category: "DC", semester: 5 },
  { code: "CE351",  name: "Design of Reinforced Concrete Structures", credits: 3, category: "DC", semester: 5 },
  { code: "CE352",  name: "Transportation Engineering",               credits: 3, category: "DC", semester: 5 },
  { code: "CE352P", name: "Transportation Engineering Lab",           credits: 1, category: "DC", semester: 5 },
  { code: "CE353P", name: "Civil Engineering Drawing",                credits: 1, category: "DC", semester: 5 },
  { code: "CE402",  name: "Geotechnical Engineering II",              credits: 3, category: "DC", semester: 5 },
];
const ceSem6: DefaultCourse[] = [
  { code: "CE305P", name: "Environmental Engineering Lab",    credits: 1, category: "DC", semester: 6 },
  { code: "CE401",  name: "Design of Steel Structures",       credits: 3, category: "DC", semester: 6 },
  { code: "CE403",  name: "Water and Wastewater Engineering", credits: 3, category: "DC", semester: 6 },
  { code: "CEXXX",  name: "Reverse Engineering",              credits: 1, category: "DC", semester: 6 },
  ...istpSem6,
];
const ceSem7: DefaultCourse[] = [...mtpSem7];
const ceSem8: DefaultCourse[] = [
  { code: "CE010", name: "Internship", credits: 2, category: "IC", semester: 8 },
  ...mtpSem8,
];

// ─── BE  (DC = 42 cr | IC-I: free choice | IC-II: free choice) ───────────────
const beSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const beSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const beSem3: DefaultCourse[] = [
  ...icSem3WithoutIC202P,
  { code: "BE201", name: "Cell Biology",                        credits: 4, category: "DC", semester: 3 },
  { code: "BE202", name: "Biochemistry and Molecular Biology",  credits: 4, category: "DC", semester: 3 },
  { code: "BE308", name: "Introduction to Biomanufacturing",    credits: 4, category: "DC", semester: 3 },
  { code: "BE309", name: "Biosensing & Bioinstrumentation",     credits: 4, category: "DC", semester: 3 },
];
const beSem4: DefaultCourse[] = [
  ...ic202pSem4,
  { code: "BE203", name: "Enzymology and Bioprocessing", credits: 4, category: "DC", semester: 4 },
  { code: "BE301", name: "Biomechanics",                 credits: 4, category: "DC", semester: 4 },
  { code: "BE304", name: "Bioinformatics",               credits: 4, category: "DC", semester: 4 },
];
const beSem5: DefaultCourse[] = [
  { code: "BE303", name: "Applied Biostatistics",             credits: 4, category: "DC", semester: 5 },
  { code: "BE305", name: "Bioethics and Regulatory Affairs",  credits: 1, category: "DC", semester: 5 },
  { code: "BE306", name: "Fundamentals of Genetic Engineering", credits: 4, category: "DC", semester: 5 },
  { code: "BE310", name: "Biomaterials",                       credits: 4, category: "DC", semester: 5 },
  { code: "BEXXX", name: "Reverse Engineering",                credits: 1, category: "DC", semester: 5 },
];
const beSem6: DefaultCourse[] = [
  ...istpSem6,
];
const beSem7: DefaultCourse[] = [...mtpSem7];
const beSem8: DefaultCourse[] = [
  { code: "BE010", name: "Internship", credits: 2, category: "IC", semester: 8 },
  ...mtpSem8,
];

// ─── EP  (DC = 37 cr | IC-I: free choice | IC-II: free choice) ───────────────
const epSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const epSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const epSem3: DefaultCourse[] = [
  ...icSem3WithoutIC202P,
  { code: "EP301", name: "Engineering Mathematics 2",         credits: 4, category: "DC", semester: 3 },
  { code: "EP321", name: "Foundations of Electrodynamics",    credits: 3, category: "DC", semester: 3 },
  { code: "PH301", name: "Quantum Mechanics and Applications", credits: 3, category: "DC", semester: 3 },
];
const epSem4: DefaultCourse[] = [
  ...ic202pSem4,
  { code: "EP403", name: "Physics of Atoms and Molecules",         credits: 3, category: "DC", semester: 4 },
  { code: "EE223P", name: "Reverse Engineering",                   credits: 1, category: "DC", semester: 4 },
  { code: "PH302", name: "Introduction to Statistical Mechanics",  credits: 3, category: "DC", semester: 4 },
  { code: "PH501", name: "Solid State Physics",                    credits: 3, category: "DC", semester: 4 },
];
const epSem5: DefaultCourse[] = [
  { code: "EE311",  name: "Device Electronics for Integrated Circuits", credits: 3, category: "DC", semester: 5 },
  { code: "EP302",  name: "Computational Methods for Engineering",      credits: 3, category: "DC", semester: 5 },
  { code: "EP402P", name: "Engineering Physics Practicum",              credits: 4, category: "DC", semester: 5 },
];
const epSem6: DefaultCourse[] = [
  { code: "EP401P", name: "Engineering of Instrumentation", credits: 4, category: "DC", semester: 6 },
  { code: "PH502",  name: "Photonics",                     credits: 3, category: "DC", semester: 6 },
  ...istpSem6,
];
const epSem7: DefaultCourse[] = [...mtpSem7];
const epSem8: DefaultCourse[] = [
  { code: "EP010", name: "Internship", credits: 2, category: "IC", semester: 8 },
  ...mtpSem8,
];

// ─── MNC  (DC = 51 cr | IC-I: free choice | IC-II: free choice) ──────────────
const mncSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const mncSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const mncSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "CS208", name: "Mathematical Foundations of Computer Science", credits: 4, category: "DC", semester: 3 },
  { code: "CS214", name: "Computer Organisation",                      credits: 4, category: "DC", semester: 3 },
  { code: "MA210", name: "Real and Complex Analysis",                  credits: 3, category: "DC", semester: 3 },
  { code: "MA211", name: "Ordinary Differential Equations",              credits: 4, category: "DC", semester: 3 },
  { code: "CS212", name: "Design of Algorithms",                         credits: 4, category: "DC", semester: 3 },
];
const mncSem4: DefaultCourse[] = [
  { code: "CS304", name: "Formal Language and Automata Theory", credits: 3, category: "DC", semester: 4 },
  { code: "MA220", name: "Partial Differential Equations", credits: 4, category: "DC", semester: 4 },
  { code: "MA221", name: "Numerical Analysis",            credits: 4, category: "DC", semester: 4 },
  { code: "MA222", name: "Applied Linear Programming",    credits: 4, category: "DC", semester: 4 },
];
const mncSem5: DefaultCourse[] = [
  { code: "MA310",  name: "Matrix Computation and Lab",           credits: 4, category: "DC", semester: 5 },
  { code: "MA311",  name: "Mathematical Modelling",               credits: 3, category: "DC", semester: 5 },
  { code: "MA322",  name: "Applied Graph Theory",                 credits: 4, category: "DC", semester: 5 },
];
const mncSem6: DefaultCourse[] = [
  { code: "MA321",  name: "Numerics of Differential Equation", credits: 4, category: "DC", semester: 6 },
  { code: "MA323P", name: "Applied Databases Practicum",       credits: 2, category: "DC", semester: 6 },
  ...istpSem6,
];
const mncSem7: DefaultCourse[] = [...mtpSem7];
const mncSem8: DefaultCourse[] = [
  { code: "MC010", name: "Internship", credits: 2, category: "IC", semester: 8 },
  ...mtpSem8,
];

// ─── MSE  (DC = 45 cr | IC-I: free choice | IC-II: free choice) ──────────────
// IC-II for MSE: IC240 is DC (not ICB2 for MSE), so exclude it from the basket options
const mseICB2: DefaultCourse[] = [ICB2_IC121, ICB2_IC241, ICB2_IC253];
const mseSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const mseSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...mseICB2];
const mseSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "MT201", name: "Physics of Solids",                        credits: 3, category: "DC", semester: 3 },
  { code: "MT202", name: "Quantum Mechanics and Applications",       credits: 3, category: "DC", semester: 3 },
  { code: "MT203", name: "Material Synthesis and Characterisation",  credits: 4, category: "DC", semester: 3 },
  { code: "ME206", name: "Mechanics of Solids",                      credits: 3, category: "DC", semester: 3 },
  { code: "ME212", name: "Product Realization (Manufacturing) Technology", credits: 3, category: "DC", semester: 3 },
];
const mseSem4: DefaultCourse[] = [
  { code: "IC240", name: "Mechanics of Rigid Bodies",                   credits: 3, category: "DC", semester: 4 },
  { code: "ME100", name: "Reverse Engineering",                         credits: 1, category: "DC", semester: 4 },
  { code: "MT204", name: "Thermodynamics and Kinetics and Materials",   credits: 3, category: "DC", semester: 4 },
  { code: "MT205", name: "Functional Properties of Materials",          credits: 4, category: "DC", semester: 4 },
  { code: "MT206", name: "Extraction and Materials Processing",         credits: 4, category: "DC", semester: 4 },
];
const mseSem5: DefaultCourse[] = [
  { code: "ME212", name: "Product Realization (Manufacturing) Technology", credits: 3, category: "DC", semester: 5 },
  { code: "MT301", name: "Phase Transformations",                         credits: 3, category: "DC", semester: 5 },
  { code: "MT302", name: "Transport Phenomena",                           credits: 3, category: "DC", semester: 5 },
  { code: "MT303", name: "Computational Materials Science",               credits: 4, category: "DC", semester: 5 },
  { code: "MT304", name: "Mechanical Behaviour of Materials",             credits: 4, category: "DC", semester: 5 },
];
const mseSem6: DefaultCourse[] = [...istpSem6];
const mseSem7: DefaultCourse[] = [...mtpSem7];
const mseSem8: DefaultCourse[] = [
  { code: "MS010", name: "Internship", credits: 2, category: "IC", semester: 8 },
  ...mtpSem8,
];

// ─── GE  (DC = 36 cr | IC-I: free choice | IC-II: free choice) ───────────────
// Sem 1 is identical for all GE sub-branches.
// Sem 2 ICB2 options differ per sub-branch based on which IC courses are DC for that branch:
//   GE-RAI : IC253 DC (sem4) → only IC121, IC240 eligible as ICB2 (IC241 also excluded to keep ICB2 small)
//   GE-CE  : IC253 DC (sem4) → only IC121, IC240, IC241 eligible
//   GE-MECH: no ICB2 conflicts → all 4 options
const geSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const geRaiICB2: DefaultCourse[]  = [ICB2_IC121, ICB2_IC240];
const geCeICB2: DefaultCourse[]   = [ICB2_IC121, ICB2_IC240, ICB2_IC241];
const geRaiSem2: DefaultCourse[]  = [...icCompSem2, ...icMixedSem2, ...geRaiICB2];
const geCeSem2: DefaultCourse[]   = [...icCompSem2, ...icMixedSem2, ...geCeICB2];
const geMechSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];

// ── GE sub-branch: Robotics & AI ──
// DC = 36: EE201(3)+ME206(3)+DS201(3)+ME309(4)+AR520(3)+ME305(4)+EE261(3)+IC253(3)+EE301(3)+AR523(3)+AR521(3)+ME100(1) = 36
const geRaiSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "EE261", name: "Electrical System Around Us",     credits: 3, category: "DC", semester: 3 },
  { code: "ME206", name: "Mechanics of Solids",             credits: 3, category: "DC", semester: 3 },
  { code: "DS201", name: "Data Handling and Vizualization", credits: 3, category: "DC", semester: 3 },
];
const geRaiSem4: DefaultCourse[] = [
  // IC222P (2cr) added via B24/B25 override
  { code: "IC253", name: "Programming and Data Structures", credits: 3, category: "DC", semester: 4 },
  { code: "EE201", name: "Electromechanics",                credits: 3, category: "DC", semester: 4 },
  { code: "ME100", name: "Reverse Engineering",             credits: 1, category: "DC", semester: 4 },
];
const geRaiSem5: DefaultCourse[] = [
  { code: "ME309", name: "Theory of Machines",                       credits: 4, category: "DC", semester: 5 },
  { code: "ME305", name: "Design of Machine Elements",               credits: 4, category: "DC", semester: 5 },
  { code: "AR523", name: "Robot Manipulators",                       credits: 3, category: "DC", semester: 5 },
  { code: "AR521", name: "Control of Robotic Systems",               credits: 3, category: "DC", semester: 5 },
  { code: "AR520", name: "Design Practicum of Mechatronic Systems",  credits: 3, category: "DC", semester: 5 },
  { code: "EE301", name: "Control Systems",                          credits: 3, category: "DC", semester: 5 },
];
const geRaiSem6: DefaultCourse[] = [...istpSem6];
const geRaiSem7: DefaultCourse[] = [...mtpSem7];
const geRaiSem8: DefaultCourse[] = [
  { code: "IC010", name: "Internship", credits: 2, category: "IC", semester: 8 },
  ...mtpSem8,
];

// ── GE sub-branch: Communication Engineering ──
// DC = 36: ME100(1)+EE261(3)+EE231(3)+EE316(4)+EE201(3)+DS404(3)+EE203(3)+IC253(3)+EE260(3)+CS313(4)+EE314(4)+EE202(3) = 37 per sem table; DC list = 36 (EE316 used per B24 semester table)
const geCeSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "EE261", name: "Electrical System Around Us", credits: 3, category: "DC", semester: 3 },
  { code: "EE203", name: "Network Theory",              credits: 3, category: "DC", semester: 3 },
  { code: "EE260", name: "Signals and Systems",         credits: 3, category: "DC", semester: 3 },
  { code: "CS313", name: "Computer Networks",           credits: 4, category: "DC", semester: 3 },
];
const geCeSem4: DefaultCourse[] = [
  // IC222P (2cr) added via B24/B25 override
  { code: "EE201", name: "Electromechanics",                credits: 3, category: "DC", semester: 4 },
  { code: "EE316", name: "Communication Systems",           credits: 3, category: "DC", semester: 4 },
  { code: "ME100", name: "Reverse Engineering",             credits: 1, category: "DC", semester: 4 },
  { code: "IC253", name: "Programming and Data Structures", credits: 3, category: "DC", semester: 4 },
  { code: "DS404", name: "Information Security and Privacy", credits: 3, category: "DC", semester: 4 },
  { code: "EE202", name: "Electromagnetics & Wave Propagation", credits: 3, category: "DC", semester: 4 },
];
const geCeSem5: DefaultCourse[] = [
  { code: "EE231", name: "Measurement and Instrumentation", credits: 3, category: "DC", semester: 5 },
  { code: "EE314", name: "Digital Signal Processing",       credits: 4, category: "DC", semester: 5 },
];
const geCeSem6: DefaultCourse[] = [
  ...istpSem6,
];
const geCeSem7: DefaultCourse[] = [...mtpSem7];
const geCeSem8: DefaultCourse[] = [
  { code: "IC010", name: "Internship", credits: 2, category: "IC", semester: 8 },
  ...mtpSem8,
];

// ── GE sub-branch: Mechatronics & AI ──
// DC = 36: EE261(3)+EE260(3)+EE201(3)+EE211(3)+ME305(4)+AR520(3)+ME206(3)+ME309(4)+EE301(3)+EE203(3)+EE231(3)+ME100(1) = 36
const geMechSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "EE261", name: "Electrical System Around Us", credits: 3, category: "DC", semester: 3 },
  { code: "ME206", name: "Mechanics of Solids",         credits: 3, category: "DC", semester: 3 },
  { code: "EE203", name: "Network Theory",              credits: 3, category: "DC", semester: 3 },
  { code: "EE260", name: "Signals and Systems",         credits: 3, category: "DC", semester: 3 },
];
const geMechSem4: DefaultCourse[] = [
  // IC222P (2cr) added via B24/B25 override
  { code: "EE201", name: "Electromechanics",       credits: 3, category: "DC", semester: 4 },
  { code: "EE211", name: "Analog Circuit Design",  credits: 3, category: "DC", semester: 4 },
  { code: "ME100", name: "Reverse Engineering",    credits: 1, category: "DC", semester: 4 },
];
const geMechSem5: DefaultCourse[] = [
  { code: "AR520", name: "Design Practicum of Mechatronic Systems", credits: 3, category: "DC", semester: 5 },
  { code: "ME305", name: "Design of Machine Elements",              credits: 4, category: "DC", semester: 5 },
  { code: "ME309", name: "Theory of Machines",                      credits: 4, category: "DC", semester: 5 },
  { code: "EE301", name: "Control Systems",                         credits: 3, category: "DC", semester: 5 },
  { code: "EE231", name: "Measurement and Instrumentation",         credits: 3, category: "DC", semester: 5 },
];
const geMechSem6: DefaultCourse[] = [...istpSem6];
const geMechSem7: DefaultCourse[] = [...mtpSem7];
const geMechSem8: DefaultCourse[] = [
  { code: "IC010", name: "Internship", credits: 2, category: "IC", semester: 8 },
  ...mtpSem8,
];

// ── GE sub-branch: Fintech (B24 unofficial track) ──
// Sem 1-2 use the common GE base (geSem1 + geRaiSem2) and get transformed by B24 overrides.
// Sem 5-8 deferred; Sem 6/7/8 inherit ISTP/MTP slots.
const geFinSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "EE261", name: "Electrical Systems Around Us",       credits: 3, category: "DC", semester: 3 },
  { code: "DS201", name: "Data Handling and Visualisation",    credits: 3, category: "DC", semester: 3 },
  { code: "ME206", name: "Mechanics of Solids",                credits: 3, category: "DC", semester: 3 },
  // DE options for Sem-3 (not DC — shown unchecked for student to select)
  { code: "ME212", name: "Product Manufacturing Technology",   credits: 3, category: "DE", semester: 3, optional: true },
  { code: "IC241", name: "Material Science for Engineers",     credits: 3, category: "DE", semester: 3, optional: true },
  { code: "EE203", name: "Network Theory",                     credits: 3, category: "DE", semester: 3, optional: true },
];
const geFinSem4: DefaultCourse[] = [
  { code: "IC222P", name: "Physics Practicum",                       credits: 2, category: "IC", semester: 4 },
  { code: "IC253",  name: "Programming and Data Structures",         credits: 3, category: "DC", semester: 4 },
  { code: "DS313",  name: "Statistical Foundations of Data Science", credits: 4, category: "DC", semester: 4 },
  { code: "DS412",  name: "Matrix Computations for Data Science",    credits: 4, category: "DC", semester: 4 },
  { code: "MA546",  name: "Introduction to Quantitative Finance",    credits: 4, category: "DC", semester: 4 },
  { code: "CS671",  name: "Deep Learning and Applications",          credits: 4, category: "DC", semester: 4 },
  { code: "MA653P", name: "Computational Financial Modelling Lab",   credits: 1, category: "DE", semester: 4, optional: true },
];

// ── GE sub-branch: Open Specialisation (B24 official 4th track) ──
// DC = 36 cr. HS307 and HS541 are classified DC (not HSS) per the official GE curriculum doc.
// Sem 1-2 use common GE base; B24 overrides apply (IC102P in Sem-2, IC222P in Sem-4).
// IC-I compulsory: IC230 | IC-II compulsory: IC240 (same as GE-ROBO).
const geOpenSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "EE261", name: "Electrical Systems Around Us",     credits: 3, category: "DC", semester: 3 },
  { code: "ME213", name: "Thermodynamics",                   credits: 3, category: "DC", semester: 3 },
  { code: "ME212", name: "Product Manufacturing Technology", credits: 3, category: "DC", semester: 3 },
  { code: "IC241", name: "Material Science for Engineers",   credits: 3, category: "DC", semester: 3 },
];
const geOpenSem4: DefaultCourse[] = [
  // IC222P (2cr) added via B24 override (case 4).
  { code: "IC253", name: "Programming and Data Structures", credits: 3, category: "DC", semester: 4 },
  { code: "EE211", name: "Analog Circuit Design",           credits: 3, category: "DC", semester: 4 },
  { code: "ME100", name: "Reverse Engineering",             credits: 1, category: "DC", semester: 4 },
  { code: "EE201", name: "Electromechanics",                credits: 3, category: "DC", semester: 4 },
  { code: "HS307", name: "Macroeconomics",                  credits: 3, category: "DC", semester: 4 },
];
const geOpenSem5: DefaultCourse[] = [
  { code: "ME305", name: "Design of Machine Elements",      credits: 4, category: "DC", semester: 5 },
  { code: "DS201", name: "Data Handling and Visualisation", credits: 3, category: "DC", semester: 5 },
  { code: "EE231", name: "Measurement and Instrumentation", credits: 3, category: "DC", semester: 5 },
];
const geOpenSem6: DefaultCourse[] = [
  { code: "HS541", name: "Technical Communication", credits: 1, category: "DC", semester: 6 },
  ...istpSem6,
];
const geOpenSem7: DefaultCourse[] = [...mtpSem7];
const geOpenSem8: DefaultCourse[] = [
  { code: "IC010", name: "Internship", credits: 2, category: "IC", semester: 8 },
  ...mtpSem8,
];

// ─── MEVLSI  (DC = 54 cr | both IC baskets: free choice) ─────────────────────
const mevlsiSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const mevlsiSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const mevlsiSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "EE203", name: "Network Theory",                   credits: 3, category: "DC", semester: 3 },
  { code: "EE210", name: "Digital System Design and Practicum",  credits: 4, category: "DC", semester: 3 },
  { code: "EE260", name: "Signals and Systems",                  credits: 3, category: "DC", semester: 3 },
  { code: "EE301", name: "Control Systems",                      credits: 4, category: "DC", semester: 3 },
  { code: "EE311", name: "Device Electronics",                   credits: 3, category: "DC", semester: 3 },
];
const mevlsiSem4: DefaultCourse[] = [
  { code: "EE202", name: "Electromagnetics & Wave Propagation", credits: 3, category: "DC", semester: 4 },
  { code: "EE211", name: "Analog Circuit Design",                         credits: 4, category: "DC", semester: 4 },
  { code: "VL-326", name: "Computer Organization",                    credits: 4, category: "DC", semester: 4 },
  { code: "VL-311", name: "CMOS Processing and Practicum",            credits: 4, category: "DC", semester: 4 },
  { code: "VL-312", name: "Electronic System Packaging",              credits: 3, category: "DC", semester: 4 },
  { code: "VL-300", name: "Reverse Engineering - E-waste management", credits: 1, category: "DC", semester: 4 },
];
const mevlsiSem5: DefaultCourse[] = [
  { code: "VL-401", name: "RTL Design and Verification", credits: 3, category: "DC", semester: 5 },
  { code: "VL-402", name: "RF IC Design",                credits: 3, category: "DC", semester: 5 },
  { code: "VL-403", name: "CMOS Digital IC Design",      credits: 4, category: "DC", semester: 5 },
  { code: "VL-404", name: "CMOS Analog IC Design",       credits: 4, category: "DC", semester: 5 },
  { code: "VL-405", name: "Design for Testability",      credits: 4, category: "DC", semester: 5 },
];
const mevlsiSem6: DefaultCourse[] = [...istpSem6];
const mevlsiSem7: DefaultCourse[] = [...mtpSem7];
const mevlsiSem8: DefaultCourse[] = [
  { code: "VL010", name: "Internship", credits: 2, category: "IC", semester: 8 },
  ...mtpSem8,
];

// ─── BSCS  (B.S. Chemical Sciences | DC = 62 cr) ─────────────────────────────
// IC-I: forced IC131 | IC-II: forced IC121
// IC136 (Biotechnology, 3cr) counts as DC for BSCS (not ICB).
// BSCS has 31 cr IC Compulsory (vs 39 for BTech); IC272 not included.
const bscsSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ICB1_IC131];
const bscsSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ICB2_IC121];
const bscsSem3: DefaultCourse[] = [
  { code: "IC136",  name: "Understanding Biotechnology and its Applications",     credits: 3, category: "DC", semester: 3 },
  { code: "CY301",  name: "Principles and Theories of Physical Chemistry",        credits: 3, category: "DC", semester: 3 },
  { code: "CY302",  name: "Principles of Organic Chemistry",                     credits: 3, category: "DC", semester: 3 },
  { code: "CY303",  name: "Fundamentals of Inorganic Chemistry",                 credits: 3, category: "DC", semester: 3 },
  { code: "CY201P", name: "Physical Chemistry Laboratory",                       credits: 2, category: "DC", semester: 3 },
];
const bscsSem4: DefaultCourse[] = [
  { code: "IC202P", name: "Design Practicum", credits: 3, category: "FE", semester: 4 },
  { code: "CY304",  name: "Fundamental Analytical Chemistry",    credits: 3, category: "DC", semester: 4 },
  { code: "CY202P", name: "Organic Chemistry Laboratory",        credits: 2, category: "DC", semester: 4 },
  { code: "CY203P", name: "Inorganic Chemistry Laboratory",      credits: 2, category: "DC", semester: 4 },
  { code: "CY401",  name: "Introduction to Quantum Chemistry and Molecular Spectroscopy", credits: 3, category: "DC", semester: 4 },
];
const bscsSem5: DefaultCourse[] = [
  { code: "CY512",  name: "Advanced Quantum Chemistry",                                  credits: 3, category: "DC", semester: 5 },
  { code: "CY512P", name: "Physical Chemistry Laboratory",                               credits: 3, category: "DC", semester: 5 },
  { code: "CY531",  name: "Organic Reactions and Mechanisms",                             credits: 3, category: "DC", semester: 5 },
  { code: "CY533P", name: "Inorganic Chemistry Laboratory",                              credits: 3, category: "DC", semester: 5 },
];
const bscsSem6: DefaultCourse[] = [
  { code: "CY511",  name: "Group Theory and Spectroscopy",            credits: 3, category: "DC", semester: 6 },
  { code: "CY531P", name: "Organic Chemistry Laboratory",             credits: 3, category: "DC", semester: 6 },
  { code: "CY532",  name: "Photochemistry and Pericyclic Reactions",  credits: 3, category: "DC", semester: 6 },
  { code: "CY533",  name: "Chemistry of Main Group Elements",         credits: 3, category: "DC", semester: 6 },
  { code: "CY534",  name: "Chemistry of Transition Elements",         credits: 3, category: "DC", semester: 6 },
];
const bscsSem7: DefaultCourse[] = [
  { code: "CY514",  name: "Chemical and Statistical Thermodynamics",  credits: 3, category: "DC", semester: 7 },
  { code: "CY535",  name: "Introduction to Organometallic Chemistry", credits: 3, category: "DC", semester: 7 },
  ...mtpSem7,
];
const bscsSem8: DefaultCourse[] = [
  { code: "CY513", name: "Chemical Kinetics and Reaction Dynamics", credits: 3, category: "DC", semester: 8 },
  { code: "CY504", name: "Heterocyclic Chemistry",                  credits: 2, category: "DC", semester: 8 },
  ...mtpSem8,
];

// ─── Optional HSS electives shown (unchecked) in Semester 2 for all branches ──
// These were offered as 2-credit courses in the Jan–May 2024 term (B23 batch, Sem 2).
const hssOptionalSem2: DefaultCourse[] = [
  { code: "HS-357-S24", name: "French Language and Culture", credits: 2, category: "HSS", semester: 2, optional: true, tag: "Jan–May 2024" },
  { code: "HS-308-S24", name: "European Literature",         credits: 2, category: "HSS", semester: 2, optional: true, tag: "Jan–May 2024" },
  { code: "HS-151",     name: "Introduction to English Literature", credits: 3, category: "HSS", semester: 2, optional: true },
];

// ─── Export ───────────────────────────────────────────────────────────────────
export const DEFAULT_CURRICULUM: Record<string, DefaultCourse[]> = {
  // CSE
  CSE_1: cseSem1, CSE_2: cseSem2, CSE_3: cseSem3,
  CSE_4: cseSem4, CSE_5: cseSem5, CSE_6: cseSem6,
  CSE_7: cseSem7, CSE_8: cseSem8,

  // DSE
  DSE_1: dseSem1, DSE_2: dseSem2, DSE_3: dseSem3,
  DSE_4: dseSem4, DSE_5: dseSem5, DSE_6: dseSem6,
  DSE_7: dseSem7, DSE_8: dseSem8,

  // DSAI (B25+) — standalone curriculum, fully diverged from DSE.
  // Uses dedicated dsaiSem* arrays; see the DSAI section above for the full diff.
  DSAI_1: dsaiSem1, DSAI_2: dsaiSem2, DSAI_3: dsaiSem3,
  DSAI_4: dsaiSem4, DSAI_5: dsaiSem5, DSAI_6: dsaiSem6,
  DSAI_7: dsaiSem7, DSAI_8: dsaiSem8,

  // EE
  EE_1: eeSem1, EE_2: eeSem2, EE_3: eeSem3,
  EE_4: eeSem4, EE_5: eeSem5, EE_6: eeSem6, EE_7: eeSem7, EE_8: eeSem8,

  // ME
  ME_1: meSem1, ME_2: meSem2, ME_3: meSem3,
  ME_4: meSem4, ME_5: meSem5, ME_6: meSem6, ME_7: meSem7, ME_8: meSem8,

  // CE
  CE_1: ceSem1, CE_2: ceSem2, CE_3: ceSem3,
  CE_4: ceSem4, CE_5: ceSem5, CE_6: ceSem6, CE_7: ceSem7, CE_8: ceSem8,

  // BE
  BE_1: beSem1, BE_2: beSem2, BE_3: beSem3,
  BE_4: beSem4, BE_5: beSem5, BE_6: beSem6, BE_7: beSem7, BE_8: beSem8,

  // EP
  EP_1: epSem1, EP_2: epSem2, EP_3: epSem3,
  EP_4: epSem4, EP_5: epSem5, EP_6: epSem6,
  EP_7: epSem7, EP_8: epSem8,

  // MNC
  MNC_1: mncSem1, MNC_2: mncSem2, MNC_3: mncSem3,
  MNC_4: mncSem4, MNC_5: mncSem5, MNC_6: mncSem6, MNC_7: mncSem7, MNC_8: mncSem8,

  // MSE
  MSE_1: mseSem1, MSE_2: mseSem2, MSE_3: mseSem3,
  MSE_4: mseSem4, MSE_5: mseSem5, MSE_6: mseSem6, MSE_7: mseSem7, MSE_8: mseSem8,

  // GE – Robotics & AI (default for plain "GE" branch — backward compat for B23 students)
  GE_1: geSem1, GE_2: geRaiSem2, GE_3: geRaiSem3,
  GE_4: geRaiSem4, GE_5: geRaiSem5, GE_6: geRaiSem6,
  GE_7: geRaiSem7, GE_8: geRaiSem8,
  // GE – Robotics & AI (canonical key from normalizeBranchCode: GERAI → GE-ROBO)
  "GE-ROBO_1": geSem1, "GE-ROBO_2": geRaiSem2, "GE-ROBO_3": geRaiSem3,
  "GE-ROBO_4": geRaiSem4, "GE-ROBO_5": geRaiSem5, "GE-ROBO_6": geRaiSem6,
  "GE-ROBO_7": geRaiSem7, "GE-ROBO_8": geRaiSem8,
  // GE – Communication Engineering (canonical: GECE → GE-COMM)
  "GE-COMM_1": geSem1, "GE-COMM_2": geCeSem2, "GE-COMM_3": geCeSem3,
  "GE-COMM_4": geCeSem4, "GE-COMM_5": geCeSem5, "GE-COMM_6": geCeSem6,
  "GE-COMM_7": geCeSem7, "GE-COMM_8": geCeSem8,
  // GE – Mechatronics (canonical: GEMECH → GE-MECH)
  "GE-MECH_1": geSem1, "GE-MECH_2": geMechSem2, "GE-MECH_3": geMechSem3,
  "GE-MECH_4": geMechSem4, "GE-MECH_5": geMechSem5, "GE-MECH_6": geMechSem6,
  "GE-MECH_7": geMechSem7, "GE-MECH_8": geMechSem8,
  // GE – Fintech (B24 unofficial track; Sem 1-2 use common GE base + B24 override;
  // Sem 5-8 deferred — only ISTP/MTP slots).
  "GE-FIN_1": geSem1, "GE-FIN_2": geRaiSem2, "GE-FIN_3": geFinSem3,
  "GE-FIN_4": geFinSem4, "GE-FIN_5": [], "GE-FIN_6": [...istpSem6],
  "GE-FIN_7": [...mtpSem7],
  "GE-FIN_8": [{ code: "IC010", name: "Internship", credits: 2, category: "IC", semester: 8 }, ...mtpSem8],
  // GE – Open Specialisation (B24 official 4th track; DC = 36 cr).
  "GE-OPEN_1": geSem1, "GE-OPEN_2": geRaiSem2, "GE-OPEN_3": geOpenSem3,
  "GE-OPEN_4": geOpenSem4, "GE-OPEN_5": geOpenSem5, "GE-OPEN_6": geOpenSem6,
  "GE-OPEN_7": geOpenSem7, "GE-OPEN_8": geOpenSem8,

  // MEVLSI
  MEVLSI_1: mevlsiSem1, MEVLSI_2: mevlsiSem2, MEVLSI_3: mevlsiSem3,
  MEVLSI_4: mevlsiSem4, MEVLSI_5: mevlsiSem5, MEVLSI_6: mevlsiSem6, MEVLSI_7: mevlsiSem7, MEVLSI_8: mevlsiSem8,

  // BSCS
  BSCS_1: bscsSem1, BSCS_2: bscsSem2, BSCS_3: bscsSem3,
  BSCS_4: bscsSem4, BSCS_5: bscsSem5, BSCS_6: bscsSem6,
  BSCS_7: bscsSem7, BSCS_8: bscsSem8,
};

const B24_BRANCH_OVERRIDES = new Set(["CSE", "DSE", "EE", "MEVLSI", "MSE", "CE"]);
const B24_GE_SUBBRANCHES = new Set(["GE-ROBO", "GE-MECH", "GE-COMM", "GE-FIN", "GE-OPEN"]);
const B24_IKS_IC182_SEM2: DefaultCourse = {
  code: "IC182",
  name: "Indian Knowledge Systems (Alt)",
  credits: 3,
  category: "IKS",
  semester: 2,
};
const B25_IKS_IC182_SEM1: DefaultCourse = {
  code: "IC182",
  name: "History of Science and Technology",
  credits: 3,
  category: "IKS",
  semester: 1,
};
const B25_IC114_SEM1: DefaultCourse = {
  code: "IC114",
  name: "Linear Algebra",
  credits: 2,
  category: "IC",
  semester: 1,
};
const B25_IC113_SEM2: DefaultCourse = {
  code: "IC113",
  name: "Complex Variables and Vector Calculus",
  credits: 2,
  category: "IC",
  semester: 2,
};
const B24_IC202P_SEM3: DefaultCourse = {
  code: "IC202P",
  name: "Design Practicum",
  credits: 3,
  category: "IC",
  semester: 3,
};
const B24_IC222P_SEM4: DefaultCourse = {
  code: "IC222P",
  name: "Physics Practicum",
  credits: 2,
  category: "IC",
  semester: 4,
};
const B22_IC202P_SEM4: DefaultCourse = {
  code: "IC202P",
  name: "Design Practicum",
  credits: 3,
  category: "IC",
  semester: 4,
};
const B22_IC222P_SEM3: DefaultCourse = {
  code: "IC222P",
  name: "Physics Practicum",
  credits: 2,
  category: "IC",
  semester: 3,
};
const B25_HSS_SEM1: DefaultCourse[] = [
  { code: "HS-108", name: "Basic English for Engineers", credits: 3, category: "HSS", semester: 1, optional: true },
  { code: "HS-112", name: "Japanese Language Class I", credits: 3, category: "HSS", semester: 1, optional: true },
  { code: "HS-256", name: "Introduction to Spanish", credits: 3, category: "HSS", semester: 1, optional: true },
  { code: "HS-342", name: "German I", credits: 3, category: "HSS", semester: 1, optional: true },
];

// ─── B24 CE course constants ──────────────────────────────────────────────────
const B24_CE_CE202_SEM2: DefaultCourse  = { code: "CE202",  name: "Introduction to Civil Engineering",         credits: 1, category: "DC", semester: 2 };
const B24_CE_CE310_SEM3: DefaultCourse  = { code: "CE310",  name: "Strength of Materials and Structures",      credits: 3, category: "DC", semester: 3 };
const B24_CE_CE310P_SEM3: DefaultCourse = { code: "CE310P", name: "Strength of Materials and Structures Lab",  credits: 1, category: "DC", semester: 3 };
const B24_CE_CE203P_SEM3: DefaultCourse = { code: "CE203P", name: "Building Materials Lab",                    credits: 1, category: "DC", semester: 3 };
const B24_CE_CE311_SEM4: DefaultCourse  = { code: "CE311",  name: "Geotechnical Engineering I",                credits: 3, category: "DC", semester: 4 };
const B24_CE_CE311P_SEM4: DefaultCourse = { code: "CE311P", name: "Geotechnical Engineering Laboratory",       credits: 1, category: "DC", semester: 4 };

// ─── B24 GE course constants ──────────────────────────────────────────────────
// (All GE DC changes are now baked into the base arrays; no B24-only constants needed.)

// IC202P as optional FE — used by B24/B25 branches where DP is not compulsory.
// Shown unchecked; if student selects it, credits count toward Free Electives.
const IC202P_OPTIONAL_FE_SEM3: DefaultCourse = { code: "IC202P", name: "Design Practicum", credits: 3, category: "FE", semester: 3, optional: true };
const IC202P_OPTIONAL_FE_SEM4: DefaultCourse = { code: "IC202P", name: "Design Practicum", credits: 3, category: "FE", semester: 4, optional: true };

// ─── B24 BSCS course constants ────────────────────────────────────────────────
const B24_BSCS_CY200_SEM2: DefaultCourse = { code: "CY200", name: "Foundations and Applications of Chemistry", credits: 3, category: "DC", semester: 2 };

// ─── B24 MNC course constants ─────────────────────────────────────────────────
// FDP (IC102P) is replaced by MA120 (Computing Systems & Databases) for B24 MNC.
const B24_MNC_MA120_SEM2: DefaultCourse = { code: "MA120", name: "Introduction to Computing Systems and Databases", credits: 4, category: "DC", semester: 2 };
// B23's CS214 (4cr Computer Organization) is split for B24 MNC into CS201 theory (3cr) + CS201P lab (1cr).
const B24_MNC_CS201_SEM4: DefaultCourse  = { code: "CS201",  name: "Computer Organization",            credits: 3, category: "DC", semester: 4 };
const B24_MNC_CS201P_SEM4: DefaultCourse = { code: "CS201P", name: "Computer Organization Laboratory", credits: 1, category: "DC", semester: 4 };
// CS304 (Formal Language & Automata Theory) moves to Sem-5 for B24 MNC, offered as MA313.
const B24_MNC_MA313_SEM5: DefaultCourse  = { code: "MA313", name: "Formal Language and Automata Theory", credits: 3, category: "DC", semester: 5 };

// ─── DSAI B25 constants ───────────────────────────────────────────────────────
// IC253 counts as IC for DSAI B25 in Sem 2 (Programming and Data Structures moved from Sem 4).
const DSAI_B25_IC253_SEM2: DefaultCourse  = { code: "IC253",  name: "Programming and Data Structures",  credits: 3, category: "IC", semester: 2 };

// ─── B24 EE course constants ──────────────────────────────────────────────────
const B24_EE_EE210P_SEM3: DefaultCourse = { code: "EE210P", name: "Digital Systems Design Practicum", credits: 1, category: "DC", semester: 3 };
const B24_EE_EE261P_SEM3: DefaultCourse = { code: "EE261P", name: "Electrical Systems Around Us Lab",  credits: 2, category: "DC", semester: 3 };

// ─── B24 ME course constants ──────────────────────────────────────────────────
const B24_ME_ME206_SEM3: DefaultCourse = { code: "ME206", name: "Mechanics of Solids",          credits: 3, category: "DC", semester: 3 };
const B24_ME_ME100_SEM4: DefaultCourse = { code: "ME100", name: "Reverse Engineering",          credits: 1, category: "DC", semester: 4 };
const B24_ME_ME205_SEM4: DefaultCourse = { code: "ME205", name: "Machine Drawing",              credits: 3, category: "DC", semester: 4 };
const B24_ME_ME215_SEM4: DefaultCourse = { code: "ME215", name: "Manufacturing Engineering 1",  credits: 3, category: "DC", semester: 4 };
const B24_ME_ME310_SEM5: DefaultCourse = { code: "ME310", name: "System Dynamics and Control",   credits: 3, category: "DC", semester: 5 };
const B24_ME_ME309_SEM5: DefaultCourse = { code: "ME309", name: "Theory of Machines",            credits: 4, category: "DC", semester: 5 };

const normalizeCurriculumCode = (code: string) =>
  (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const addCourseIfMissing = (courses: DefaultCourse[], course: DefaultCourse) =>
  courses.some((c) => normalizeCurriculumCode(c.code) === normalizeCurriculumCode(course.code))
    ? courses
    : [...courses, course];

const applyBatchOverrides = (
  branch: string,
  semester: number,
  courses: DefaultCourse[],
  batch?: number | null
) => {
  const effectiveBranch = getCurriculumBranchCode(branch);

  if (batch === 2024 && B24_BRANCH_OVERRIDES.has(effectiveBranch)) {
    switch (semester) {
      case 1: {
        // Batch-24: IC102P is compulsory in Sem-2 (not shown in Sem-1).
        let updated = courses.filter((c) => normalizeCurriculumCode(c.code) !== "IC102P");
        if (effectiveBranch === "CE") {
          // Batch-24 CE: IC140 moves to Sem-2 as compulsory; ICB1 pruned to only IC230 (EVS).
          updated = updated.filter((c) => {
            const code = normalizeCurriculumCode(c.code);
            return code !== "IC140" && code !== "IC131" && code !== "IC136";
          });
        }
        return updated;
      }

      case 2: {
        if (effectiveBranch === "CE") {
          // Batch-24 CE: IC222P moves to Sem-4; IC102P/IC181 not here; IC182 added (same as other B24 branches).
          // ICB2 pruned to only IC240 (RBD); CE202 (Intro to Civil Engg) added as DC.
          let filtered = courses.filter((c) => {
            const code = normalizeCurriculumCode(c.code);
            return !["IC222P", "IC102P", "IC181", "IC121", "IC241", "IC253"].includes(code);
          });
          filtered = addCourseIfMissing(filtered, B24_IKS_IC182_SEM2);
          return addCourseIfMissing(filtered, B24_CE_CE202_SEM2);
        }
        // Batch-24: Sem-1 choice IC140/IC181, Sem-2 choice IC140/IC182. So IC181 not shown in Sem-2; add IC182.
        // Batch-24: Physics Practicum (IC222P) is in Sem-4 (not Sem-2).
        const filtered = courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return code !== "IC181" && code !== "IC222P";
        });
        const hasIc182 = filtered.some((c) => normalizeCurriculumCode(c.code) === "IC182");
        return hasIc182 ? filtered : [...filtered, B24_IKS_IC182_SEM2];
      }

      case 3: {
        if (effectiveBranch === "CE") {
          // Batch-24 CE: CE202 moved to Sem-2; CE301/CE301P/CE354P renumbered to CE310/CE310P/CE203P.
          // CE203 renamed to "Civil Engineering Materials".
          let updated = courses.filter((c) => {
            const code = normalizeCurriculumCode(c.code);
            return !["CE202", "CE301", "CE301P", "CE354P", "IC202P"].includes(code);
          });
          updated = updated.map((c) =>
            normalizeCurriculumCode(c.code) === "CE203"
              ? { ...c, name: "Civil Engineering Materials" }
              : c
          );
          updated = addCourseIfMissing(updated, B24_CE_CE310_SEM3);
          updated = addCourseIfMissing(updated, B24_CE_CE310P_SEM3);
          updated = addCourseIfMissing(updated, B24_CE_CE203P_SEM3);
          return updated;
        }
        let updated = courses;
        if (effectiveBranch === "EE") {
          // B24 EE: EE-210/EE210P replaced by EE-212 (4cr). EE261P lab stays (already in B23 base).
          updated = updated.filter((c) => {
            const code = normalizeCurriculumCode(c.code);
            return code !== "EE210" && code !== "EE210P";
          });
          updated = addCourseIfMissing(updated, { code: "EE-212", name: "Digital System Design", credits: 4, category: "DC" as const, semester: 3 });
        }
        if (effectiveBranch === "MEVLSI") {
          // B24 MEVLSI Sem3: EE-210→EE-212 and EE-301→EE-302 (both confirmed replacements).
          updated = updated.filter((c) => {
            const code = normalizeCurriculumCode(c.code);
            return code !== "EE210" && code !== "EE301";
          });
          updated = addCourseIfMissing(updated, { code: "EE-212", name: "Digital System Design", credits: 4, category: "DC" as const, semester: 3 });
          updated = addCourseIfMissing(updated, { code: "EE-302", name: "Control Systems", credits: 4, category: "DC" as const, semester: 3 });
        }
        // Batch-24: Design Practicum (IC202P) is in Sem-3 for all allowed B24 branches.
        const hasIc202p = updated.some((c) => normalizeCurriculumCode(c.code) === "IC202P");
        return hasIc202p ? updated : [B24_IC202P_SEM3, ...updated];
      }

      case 4: {
        // Batch-24: Physics Practicum (IC222P) is in Sem-4 for all allowed B24 branches.
        // Batch-24: DSE moves DS404 from Sem-4 → Sem-5 (not dropped).
        // Batch-24: EE Reverse Engineering code is EE223P (not placeholder EEXXXP).
        let updated = courses;

        if (effectiveBranch === "DSE" || effectiveBranch === "EE") {
          updated = updated.filter((c) => normalizeCurriculumCode(c.code) !== "IC202P");
        }
        if (effectiveBranch === "DSE") {
          updated = updated.filter((c) => normalizeCurriculumCode(c.code) !== "DS404");
          // DS404 moves to Sem-5 — handled in case 5 below.
        }
        if (effectiveBranch === "EE") {
          // B24 EE: RE placeholder → EE223P; EE304→EE316.
          updated = updated.map((c) => {
            const code = normalizeCurriculumCode(c.code);
            if (code === "EEXXXP") return { ...c, code: "EE223P" };
            if (code === "EE304") return { ...c, code: "EE316" };
            return c;
          });
        }
        if (effectiveBranch === "CE") {
          // Batch-24 CE: CE302/CE302P renumbered to CE311/CE311P.
          updated = updated.filter((c) => {
            const code = normalizeCurriculumCode(c.code);
            return code !== "CE302" && code !== "CE302P";
          });
          updated = addCourseIfMissing(updated, B24_CE_CE311_SEM4);
          updated = addCourseIfMissing(updated, B24_CE_CE311P_SEM4);
        }

        const hasIc222p = updated.some((c) => normalizeCurriculumCode(c.code) === "IC222P");
        return hasIc222p ? updated : [B24_IC222P_SEM4, ...updated];
      }

      case 5: {
        if (effectiveBranch === "DSE") {
          // B24 DSE: DS404 (Info Security & Privacy, 3cr) moved here from Sem-4.
          return addCourseIfMissing(courses, {
            code: "DS404", name: "Information Security and Privacy",
            credits: 3, category: "DC", semester: 5,
          });
        }
        // B24 EE: EE314 credit changes 4→3cr vs B23.
        if (effectiveBranch === "EE") {
          const upd = courses.map((c) =>
            normalizeCurriculumCode(c.code) === "EE314" ? { ...c, credits: 3 } : c
          );
          return upd;
        }
        return courses;
      }

      default:
        return courses;
    }
  }

  if (batch === 2024 && effectiveBranch === "EP") {
    switch (semester) {
      case 1: {
        // B24 EP: FDP (IC102P) not run; IC140 (Graphics) moved to Sem-2 only; ICB1 forced to IC230.
        return courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return !["IC102P", "IC140", "IC131", "IC136"].includes(code);
        });
      }

      case 2: {
        // B24 EP: IC102P dropped; IC222P → Sem-4; IKS IC181 → IC182; IC-II forced to IC121.
        const updated = courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return !["IC102P", "IC222P", "IC181", "IC240", "IC241", "IC253"].includes(code);
        });
        return addCourseIfMissing(updated, B24_IKS_IC182_SEM2);
      }

      case 4: {
        // B24 EP: Design Practicum (IC202P) dropped; IC222P moved here; Reverse Engineering code EPXXX → EP201.
        const updated = courses
          .filter((c) => normalizeCurriculumCode(c.code) !== "IC202P")
          .map((c) =>
            normalizeCurriculumCode(c.code) === "EPXXX" ? { ...c, code: "EP201" } : c
          );
        return addCourseIfMissing(updated, B24_IC222P_SEM4);
      }

      default:
        return courses;
    }
  }

  if (batch === 2024 && effectiveBranch === "MNC") {
    switch (semester) {
      case 1: {
        // B24 MNC: FDP (IC102P) replaced by MA120 in Sem-2 (drop here); IC140 → Sem-2;
        // ICB1 forced to IC136 (drop IC131, IC230); IC181 (IKS) stays in Sem-1.
        return courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return !["IC102P", "IC140", "IC131", "IC230"].includes(code);
        });
      }

      case 2: {
        // B24 MNC: FDP (IC102P) replaced by MA120 (DC); IC222P → Sem-4; IC181 (in Sem-1);
        // ICB2 forced to IC253 (drop IC121, IC240, IC241); IC140 (Graphics) here.
        let updated = courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return !["IC102P", "IC222P", "IC181", "IC121", "IC240", "IC241"].includes(code);
        });
        updated = addCourseIfMissing(updated, B24_MNC_MA120_SEM2);
        return updated;
      }

      case 3: {
        // B24 MNC: CS214 moves to Sem-4.
        return courses.filter((c) => normalizeCurriculumCode(c.code) !== "CS214");
      }

      case 4: {
        // B24 MNC: CS304 moves to Sem-5 as MA313; CS214 split into CS201+CS201P; IC222P moves here.
        let updated = courses.filter((c) => normalizeCurriculumCode(c.code) !== "CS304");
        updated = addCourseIfMissing(updated, B24_MNC_CS201_SEM4);
        updated = addCourseIfMissing(updated, B24_MNC_CS201P_SEM4);
        updated = addCourseIfMissing(updated, B24_IC222P_SEM4);
        return updated;
      }

      case 5: {
        // B24 MNC: MA313 (alias for CS304) offered in Sem-5; MA312 (Design of Algorithms) is in Sem-5 for B24.
        const withMA313 = addCourseIfMissing(courses, B24_MNC_MA313_SEM5);
        return addCourseIfMissing(withMA313, { code: "MA312", name: "Design of Algorithms", credits: 4, category: "DC" as const, semester: 5 });
      }

      default:
        return courses;
    }
  }

  if (batch === 2024 && effectiveBranch === "ME") {
    switch (semester) {
      case 1: {
        // B24 ME: FDP (IC102P) → Sem-2; IKS IC181 → IC182 (Sem-2). IC140 (Graphics) stays Sem-1.
        return courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return code !== "IC102P" && code !== "IC181";
        });
      }

      case 2: {
        // B24 ME: IC222P → Sem-4; IC140 locked to Sem-1; IKS IC181 → IC182; IC-II forced to IC240.
        // IC102P (FDP) stays here as the Sem-2 elective-basket course.
        const updated = courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return !["IC222P", "IC140", "IC181", "IC121", "IC253"].includes(code);
        });
        return addCourseIfMissing(updated, B24_IKS_IC182_SEM2);
      }

      case 3: {
        // B24 ME: ME206 ← Sem-4 and IC202P ← Sem-4; ME100/ME205/ME308 → Sem-4; ME310 → Sem-5.
        let updated = courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return !["ME100", "ME205", "ME308", "ME310"].includes(code);
        });
        updated = addCourseIfMissing(updated, B24_ME_ME206_SEM3);
        updated = addCourseIfMissing(updated, B24_IC202P_SEM3);
        return updated;
      }

      case 4: {
        // B24 ME: ME206 → Sem-3, IC202P → Sem-3, ME309 → Sem-5; IC222P moved here.
        // Add ME100, ME205 (← Sem-3) and ME215 (← ME308, renumbered).
        let updated = courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return !["ME206", "ME309", "IC202P"].includes(code);
        });
        updated = addCourseIfMissing(updated, B24_ME_ME100_SEM4);
        updated = addCourseIfMissing(updated, B24_ME_ME205_SEM4);
        updated = addCourseIfMissing(updated, B24_ME_ME215_SEM4);
        return addCourseIfMissing(updated, B24_IC222P_SEM4);
      }

      case 5: {
        // B24 ME: ME310 (System Dynamics) and ME309 (Theory of Machines) pushed here from Sem-3/Sem-4.
        const withSysDyn = addCourseIfMissing(courses, B24_ME_ME310_SEM5);
        return addCourseIfMissing(withSysDyn, B24_ME_ME309_SEM5);
      }

      default:
        return courses;
    }
  }

  if (batch === 2024 && effectiveBranch === "BE") {
    switch (semester) {
      case 1: {
        // B24 BE: FDP (IC102P) not run; remove from Sem-1.
        return courses.filter((c) => normalizeCurriculumCode(c.code) !== "IC102P");
      }
      case 2: {
        // B24 BE: IC102P dropped; IC222P → Sem-4; IKS IC181 → IC182.
        const updated = courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return !["IC102P", "IC222P", "IC181"].includes(code);
        });
        return addCourseIfMissing(updated, B24_IKS_IC182_SEM2);
      }
      case 4: {
        // B24 BE: Design Practicum (IC202P) not run; IC222P moved here from Sem-2.
        const updated = courses.filter((c) => normalizeCurriculumCode(c.code) !== "IC202P");
        return addCourseIfMissing(updated, B24_IC222P_SEM4);
      }
      default:
        return courses;
    }
  }

  if (batch === 2024 && B24_GE_SUBBRANCHES.has(effectiveBranch)) {
    switch (semester) {
      case 1: {
        // B24 GE (all sub-branches): IC102P → Sem-2; IKS IC181 → IC182 (Sem-2 only);
        // ICB1 pruned to only IC230 (EVS). IC140 (Graphics) stays in Sem-1.
        return courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return !["IC102P", "IC181", "IC131", "IC136"].includes(code);
        });
      }

      case 2: {
        // B24 GE: IC222P → Sem-4; IC140 (in Sem-1) removed; IC181 → IC182; ICB2 pruned to IC240.
        // IC102P (Foundations of Design Practicum) is compulsory in Sem-2 — stays.
        let updated = courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return !["IC222P", "IC140", "IC181", "IC121", "IC241", "IC253"].includes(code);
        });
        updated = addCourseIfMissing(updated, B24_IKS_IC182_SEM2);
        return updated;
      }

      case 3: {
        // GE-ROBO: ME206 now in base (IC241 removed from base). No additional changes needed.
        // GE-MECH: ME206/EE203/EE260 now in base. No additional changes needed.
        // GE-FIN: base curriculum (geFinSem3) is already B24-final. Return as-is.
        // GE-COMM: no B24 logic (no student); return B23 base.
        return courses;
      }

      case 4: {
        if (effectiveBranch === "GE-ROBO" || effectiveBranch === "GE-MECH" || effectiveBranch === "GE-COMM" || effectiveBranch === "GE-OPEN") {
          // B24 GE-ROBO/GE-MECH/GE-COMM/GE-OPEN: add IC222P (moved from Sem-2).
          // ME100 is now in the base arrays for GE-ROBO/GE-MECH/GE-COMM — no longer added here.
          return addCourseIfMissing(courses, B24_IC222P_SEM4);
        }
        // GE-FIN: base curriculum (geFinSem4) already includes IC222P. Return as-is.
        return courses;
      }

      case 5: {
        // B24 GE: EE-301 replaced by EE-302 (Control Systems, 4cr, confirmed replacement).
        const upd = courses.filter((c) => normalizeCurriculumCode(c.code) !== "EE301");
        return addCourseIfMissing(upd, { code: "EE-302", name: "Control Systems", credits: 4, category: "DC" as const, semester: 5 });
      }

      case 7: {
        // GE-ROBO: ME305/ME309 no longer in base geRaiSem7 (now in Sem-5). IC010+MTP-1 in base.
        // GE-MECH: EE311/EE326/ME305/ME309 no longer in base geMechSem7. IC010+MTP-1 in base.
        return courses;
      }

      default:
        return courses;
    }
  }

  if (batch === 2024 && effectiveBranch === "BSCS") {
    switch (semester) {
      case 1: {
        // B24 BSCS: IC102P (FDP) dropped — replaced credit-wise by CY200 in Sem-2.
        // IC152, IC181 unchanged; no IC182 in Sem-2 (unlike BTech B24 branches).
        return courses.filter((c) => normalizeCurriculumCode(c.code) !== "IC102P");
      }

      case 2: {
        // B24 BSCS: IC102P/IC181 (mixed) and IC222P dropped; IC222P moves to Sem-4.
        // CY200 (Foundations and Applications of Chemistry, DC) added.
        // IC252 stays as IC. No IC182 IKS replacement for BSCS.
        const updated = courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return !["IC102P", "IC181", "IC222P"].includes(code);
        });
        return addCourseIfMissing(updated, B24_BSCS_CY200_SEM2);
      }

      case 4: {
        // B24 BSCS: IC202P (Design Practicum) reclassified from IC → FE;
        // IC222P (Physics Practicum) moves here from Sem-2.
        const updated = courses.map((c) =>
          normalizeCurriculumCode(c.code) === "IC202P" ? { ...c, category: "FE" as const } : c
        );
        return addCourseIfMissing(updated, B24_IC222P_SEM4);
      }

      default:
        return courses;
    }
  }

  // ── DSAI B25: handled before the generic B25 block so it returns early ──────
  if (batch === 2025 && effectiveBranch === "DSAI") {
    switch (semester) {
      case 1: {
        // DSAI B25 Sem 1: IC113 stays here (unlike general B25 which swaps IC113↔IC114).
        // IC181 (old IKS) removed; IC182 (History of Science & Technology) added.
        // IC102P stays — half the batch does FDP here, half does IKS (they swap in Sem 2).
        let updated = courses.filter((c) => normalizeCurriculumCode(c.code) !== "IC181");
        return addCourseIfMissing(updated, B25_IKS_IC182_SEM1);
      }
      case 2: {
        // DSAI B25 Sem 2: IC114 stays here (not in Sem 1 like general B25).
        // IC222P moves to Sem 3 (same as all other B25 branches); IC140 and IKS variants not in Sem 2.
        // IC253 (Programming & Data Structures) classified as IC for DSAI.
        let updated = courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return !["IC140", "IC181", "IC182", "IC222P"].includes(code);
        });
        updated = addCourseIfMissing(updated, DSAI_B25_IC253_SEM2);
        return updated;
      }
      case 3: {
        // IC202P + IC222P both move to Sem 3 for DSAI B25.
        let updated = addCourseIfMissing(courses, B24_IC202P_SEM3);
        return addCourseIfMissing(updated, B22_IC222P_SEM3);
      }
      case 4: {
        // IC202P moved to Sem 3 — remove from Sem 4 for DSAI B25.
        return courses.filter((c) => normalizeCurriculumCode(c.code) !== "IC202P");
      }
      default:
        // Sems 5-8 are correct in the dedicated dsaiSem* arrays; no further overrides needed.
        return courses;
    }
  }

  if (batch === 2025) {
    const basketBranch = normalizeBranchForIcBasket(effectiveBranch);
    const branchCompulsion = IC_BASKET_COMPULSIONS[basketBranch] || {};

    switch (semester) {
      case 1: {
        let updated = courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return code !== "IC113" && code !== "IC140" && code !== "IC102P";
        });

        updated = addCourseIfMissing(updated, B25_IC114_SEM1);
        updated = addCourseIfMissing(updated, B25_IKS_IC182_SEM1);

        if (branchCompulsion.ic1) {
          const forcedIc1 = normalizeCurriculumCode(branchCompulsion.ic1);
          updated = updated.filter((c) => {
            const code = normalizeCurriculumCode(c.code);
            return !(c.category === "ICB" && ICB1_CODES.has(code) && code !== forcedIc1);
          });
        }

        for (const hssCourse of B25_HSS_SEM1) {
          updated = addCourseIfMissing(updated, hssCourse);
        }

        return updated;
      }

      case 2: {
        let updated = courses.filter((c) => {
          const code = normalizeCurriculumCode(c.code);
          return code !== "IC114" && code !== "IC181" && code !== "IC182" && code !== "IC222P";
        });

        updated = addCourseIfMissing(updated, B25_IC113_SEM2);

        if (branchCompulsion.ic2) {
          const forcedIc2 = normalizeCurriculumCode(branchCompulsion.ic2);
          updated = updated.filter((c) => {
            const code = normalizeCurriculumCode(c.code);
            return !(c.category === "ICB" && ICB2_CODES.has(code) && code !== forcedIc2);
          });
        }

        // MA120 (MNC) and CY200 (BSCS) were B24-only — not carried to B25.
        // B25 CE: CE202 (Intro to Civil Engineering, 1cr DC) is in Sem-2 (moved from Sem-3).
        if (effectiveBranch === "CE") {
          updated = addCourseIfMissing(updated, B24_CE_CE202_SEM2);
        }

        return updated;
      }

      case 3: {
        // B25 inherits B24's DC restructuring in Sem 3. IC222P (Physics Practicum) moves to Sem 3 for B25.
        let updated = courses;
        if (effectiveBranch === "EE") {
          // B25: EE-210 replaced by EE-212 (4cr, confirmed). Remove EE210/EE210P split; add EE212.
          // EE261 keeps 3cr + EE261P lab split.
          updated = updated.filter((c) => {
            const code = normalizeCurriculumCode(c.code);
            return code !== "EE210" && code !== "EE210P";
          });
          updated = updated.map((c) =>
            normalizeCurriculumCode(c.code) === "EE261" ? { ...c, credits: 3 } : c
          );
          updated = addCourseIfMissing(updated, { code: "EE-212", name: "Digital System Design", credits: 4, category: "DC" as const, semester: 3 });
          updated = addCourseIfMissing(updated, B24_EE_EE261P_SEM3);
        }
        if (effectiveBranch === "MEVLSI") {
          // B25 MEVLSI Sem3: EE-210→EE-212, EE-301→EE-302, EE-311→VL-201.
          updated = updated.filter((c) => {
            const code = normalizeCurriculumCode(c.code);
            return code !== "EE210" && code !== "EE301" && code !== "EE311";
          });
          updated = addCourseIfMissing(updated, { code: "EE-212", name: "Digital System Design", credits: 4, category: "DC" as const, semester: 3 });
          updated = addCourseIfMissing(updated, { code: "EE-302", name: "Control Systems", credits: 4, category: "DC" as const, semester: 3 });
          updated = addCourseIfMissing(updated, { code: "VL-201", name: "Semiconductor Device for ICs", credits: 3, category: "DC" as const, semester: 3 });
        }
        if (effectiveBranch === "MNC") {
          // CS214 deferred to Sem 4; MA312 (Design of Algorithms) moves to Sem-3 for B25 (from Sem-5 in B24).
          updated = updated.filter((c) => normalizeCurriculumCode(c.code) !== "CS214");
          updated = addCourseIfMissing(updated, { code: "MA312", name: "Design of Algorithms", credits: 4, category: "DC" as const, semester: 3 });
        }
        if (effectiveBranch === "CE") {
          // CE301/CE301P/CE354P renumbered; CE202 moved to Sem-2; IC202P optional FE (DP not compulsory for B25 CE).
          updated = updated.filter((c) => {
            const code = normalizeCurriculumCode(c.code);
            return !["CE202", "CE301", "CE301P", "CE354P", "IC202P"].includes(code);
          });
          updated = updated.map((c) =>
            normalizeCurriculumCode(c.code) === "CE203" ? { ...c, name: "Civil Engineering Materials" } : c
          );
          updated = addCourseIfMissing(updated, B24_CE_CE310_SEM3);
          updated = addCourseIfMissing(updated, B24_CE_CE310P_SEM3);
          updated = addCourseIfMissing(updated, B24_CE_CE203P_SEM3);
          // IC202P removed — DP not in default curriculum for B25 CE.
        }
        if (effectiveBranch === "ME") {
          // ME100/ME205/ME308/ME310 move to Sem 4/5; ME206 added here.
          updated = updated.filter((c) => {
            const code = normalizeCurriculumCode(c.code);
            return !["ME100", "ME205", "ME308", "ME310"].includes(code);
          });
          updated = addCourseIfMissing(updated, B24_ME_ME206_SEM3);
        }
        // GE-ROBO: ME206 now in base; IC241 no longer in base. No changes needed.
        // GE-MECH: ME206/EE203/EE260 now in base. No changes needed.
        // IC202P moves to Sem-3 for DSE, EE, ME in B25 (same as B24).
        if (effectiveBranch === "DSE" || effectiveBranch === "EE" || effectiveBranch === "ME") {
          updated = addCourseIfMissing(updated, B24_IC202P_SEM3);
        }
        // IC222P (Physics Practicum) moves to Sem-3 for B25 — all branches except DSAI.
        if (effectiveBranch !== "DSAI") {
          updated = addCourseIfMissing(updated, B22_IC222P_SEM3);
        }
        return updated;
      }

      case 4: {
        // B25 Sem-4: IC202P removed for DSE/EE/ME (moved to Sem-3). DC restructuring inherited from B24.
        let updated = courses;
        if (effectiveBranch === "DSE" || effectiveBranch === "EE" || effectiveBranch === "ME") {
          updated = updated.filter((c) => normalizeCurriculumCode(c.code) !== "IC202P");
        }
        if (effectiveBranch === "DSE") {
          // DS404 (Information Security) removed from DSE Sem 4 (same as B24).
          updated = updated.filter((c) => normalizeCurriculumCode(c.code) !== "DS404");
        }
        if (effectiveBranch === "EE") {
          // B25 EE: EE304 → EE316.
          updated = updated.map((c) => {
            const code = normalizeCurriculumCode(c.code);
            if (code === "EE304") return { ...c, code: "EE316" };
            return c;
          });
        }
        if (effectiveBranch === "EP") {
          // Reverse Engineering placeholder EPXXX → EP201.
          updated = updated.map((c) =>
            normalizeCurriculumCode(c.code) === "EPXXX" ? { ...c, code: "EP201" } : c
          );
        }
        if (effectiveBranch === "CE") {
          // CE302/CE302P renumbered to CE311/CE311P.
          updated = updated.filter((c) => {
            const code = normalizeCurriculumCode(c.code);
            return code !== "CE302" && code !== "CE302P";
          });
          updated = addCourseIfMissing(updated, B24_CE_CE311_SEM4);
          updated = addCourseIfMissing(updated, B24_CE_CE311P_SEM4);
        }
        if (effectiveBranch === "MNC") {
          // CS304 deferred; CS214 split into CS201 (3cr theory) + CS201P (1cr lab).
          updated = updated.filter((c) => normalizeCurriculumCode(c.code) !== "CS304");
          updated = addCourseIfMissing(updated, B24_MNC_CS201_SEM4);
          updated = addCourseIfMissing(updated, B24_MNC_CS201P_SEM4);
        }
        if (effectiveBranch === "ME") {
          // ME206 moved to Sem 3; ME309 moved to Sem 5; ME100/ME205/ME215 added.
          updated = updated.filter((c) => {
            const code = normalizeCurriculumCode(c.code);
            return !["ME206", "ME309"].includes(code);
          });
          updated = addCourseIfMissing(updated, B24_ME_ME100_SEM4);
          updated = addCourseIfMissing(updated, B24_ME_ME205_SEM4);
          updated = addCourseIfMissing(updated, B24_ME_ME215_SEM4);
        }
        // B25 BE/EP/BSCS: Design Practicum (IC202P) not compulsory — remove from default curriculum.
        if (effectiveBranch === "BE" || effectiveBranch === "EP" || effectiveBranch === "BSCS") {
          updated = updated.filter((c) => normalizeCurriculumCode(c.code) !== "IC202P");
        }
        // GE-ROBO: ME100 now in base geRaiSem4. No changes needed here.
        return updated;
      }

      case 5: {
        // B25 ME inherits ME310 (System Dynamics) and ME309 (Theory of Machines) pushed from Sem 3/4.
        if (effectiveBranch === "ME") {
          const withSysDyn = addCourseIfMissing(courses, B24_ME_ME310_SEM5);
          return addCourseIfMissing(withSysDyn, B24_ME_ME309_SEM5);
        }
        // B25 MNC: MA313 (alias for CS304) in Sem-5 (same as B24).
        if (effectiveBranch === "MNC") {
          return addCourseIfMissing(courses, B24_MNC_MA313_SEM5);
        }
        // B25 DSE: DS404 (Info Security & Privacy, 3cr) moved to Sem-5 from Sem-4.
        if (effectiveBranch === "DSE") {
          return addCourseIfMissing(courses, {
            code: "DS404", name: "Information Security and Privacy",
            credits: 3, category: "DC", semester: 5,
          });
        }
        // B25 EE/GE: EE-301→EE-302 (Control Systems); EE305→EE314 for EE (from B24+).
        if (effectiveBranch === "EE" || effectiveBranch.startsWith("GE-") || effectiveBranch === "GE") {
          let upd = courses.filter((c) => {
            const code = normalizeCurriculumCode(c.code);
            return code !== "EE301" && code !== "EE305";
          });
          upd = addCourseIfMissing(upd, { code: "EE-302", name: "Control Systems", credits: 4, category: "DC" as const, semester: 5 });
          if (effectiveBranch === "EE") {
            upd = addCourseIfMissing(upd, { code: "EE-314", name: "Digital Signal Processing", credits: 3, category: "DC" as const, semester: 5 });
          }
          return upd;
        }
        return courses;
      }

      default:
        return courses;
    }
  }

  if (batch === 2022) {
    switch (semester) {
      case 2: {
        // Batch-22: Physics Practicum (IC222P) is in Sem-3 (not Sem-2).
        return courses.filter((c) => normalizeCurriculumCode(c.code) !== "IC222P");
      }

      case 3: {
        // Batch-22: Physics Practicum (IC222P) is in Sem-3.
        // Batch-22: Design Practicum (IC202P) is in Sem-4 (not Sem-3).
        const filtered = courses.filter((c) => normalizeCurriculumCode(c.code) !== "IC202P");
        const hasIc222p = filtered.some((c) => normalizeCurriculumCode(c.code) === "IC222P");
        return hasIc222p ? filtered : [B22_IC222P_SEM3, ...filtered];
      }

      case 4: {
        const hasIc202p = courses.some((c) => normalizeCurriculumCode(c.code) === "IC202P");
        return hasIc202p ? courses : [B22_IC202P_SEM4, ...courses];
      }

      default:
        return courses;
    }
  }

  return courses;
};

export function getDefaultCurriculum(branch: string, semester: number, batch?: number | null): DefaultCourse[] {
  const effectiveBranch = getCurriculumBranchCode(branch);
  const key = `${effectiveBranch}_${semester}`;
  const courses = applyBatchOverrides(effectiveBranch, semester, DEFAULT_CURRICULUM[key] || [], batch)
    .map((course) => {
      if (course.category !== "MTP") return course;
      const component = course.semester === 8 ? 2 : 1;
      return {
        ...course,
        code: getMtpCourseCode(effectiveBranch, component),
        credits: MTP_COMPONENT_CREDITS,
      };
    });
  // Append optional HSS electives to semester 2 (Batch 2023 only)
  if (semester === 2 && (batch == null || batch === 2023)) {
    return [...courses, ...hssOptionalSem2];
  }
  return courses;
}

export function getAllDefaultCourses(branch: string, upToSemester: number = 8, batch?: number | null): DefaultCourse[] {
  const courses: DefaultCourse[] = [];
  for (let sem = 1; sem <= upToSemester; sem++) {
    courses.push(...getDefaultCurriculum(branch, sem, batch));
  }
  return courses;
}
