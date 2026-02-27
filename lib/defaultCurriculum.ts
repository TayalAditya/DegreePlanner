// Default curriculum for each branch (B23 batch, IIT Mandi)
// IC course semester assignments confirmed by B23 students.
// DC course semester assignments are best estimates based on course numbering.
export interface DefaultCourse {
  code: string;
  name: string;
  credits: number;
  category: "IC" | "ICB" | "HSS" | "IKS" | "DC" | "DE" | "FE" | "ISTP" | "MTP";
  semester: number;
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

// IC202P + IC272 appear in Sem-3 for most branches
const icSem3: DefaultCourse[] = [
  { code: "IC202P", name: "Design Practicum", credits: 3, category: "IC", semester: 3 },
  { code: "IC272",  name: "Machine Learning", credits: 3, category: "IC", semester: 3 },
];

// ISTP and MTP courses (common for all BTech)
const istpSem6: DefaultCourse[] = [
  { code: "DP 301P", name: "Interdisciplinary Socio-Technical Practicum", credits: 4, category: "ISTP", semester: 6 },
];

const mtpSem7: DefaultCourse[] = [
  { code: "DP 498P", name: "Major Technical Project - I", credits: 3, category: "MTP", semester: 7 },
];

const mtpSem8: DefaultCourse[] = [
  { code: "DP 499P", name: "Major Technical Project - II", credits: 5, category: "MTP", semester: 8 },
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
const cseSem8: DefaultCourse[] = [...mtpSem8];

// ─── DSE  (DC = 33 cr | IC-I: free choice | IC-II: free choice) ──────────────
const dseSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const dseSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const dseSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "DS201", name: "Data Handling and Vizualisation",          credits: 3, category: "DC", semester: 3 },
  { code: "DS301", name: "Mathematical Foundations of Data Science", credits: 4, category: "DC", semester: 3 },
  { code: "CS213", name: "Reverse Engineering",                      credits: 1, category: "DC", semester: 3 },
];
const dseSem4: DefaultCourse[] = [
  { code: "DS302", name: "Computing Systems for Data Processing",   credits: 3, category: "DC", semester: 4 },
  { code: "DS313", name: "Statistical Foundations of Data Science", credits: 4, category: "DC", semester: 4 },
];
const dseSem5: DefaultCourse[] = [
  { code: "DS404", name: "Information Security and Privacy", credits: 3, category: "DC", semester: 5 },
  { code: "DS411", name: "Optimization for Data Science",    credits: 4, category: "DC", semester: 5 },
  { code: "CS305", name: "Artificial Intelligence",          credits: 3, category: "DC", semester: 5 },
];
const dseSem6: DefaultCourse[] = [
  { code: "DS412", name: "Matrix Computations for Data Science",  credits: 4, category: "DC", semester: 6 },
  { code: "DS413", name: "Introduction to Statistical Learning",  credits: 4, category: "DC", semester: 6 },
  ...istpSem6,
];
const dseSem7: DefaultCourse[] = [...mtpSem7];
const dseSem8: DefaultCourse[] = [...mtpSem8];

// ─── EE  (DC = 52 cr | both IC baskets: free choice) ─────────────────────────
const eeSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const eeSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const eeSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "EE261", name: "Electrical Systems Around Us", credits: 5, category: "DC", semester: 3 },
  { code: "EE260", name: "Signals and Systems",          credits: 3, category: "DC", semester: 3 },
];
const eeSem4: DefaultCourse[] = [
  { code: "EE210", name: "Digital System Design",            credits: 4, category: "DC", semester: 4 },
  { code: "EE203", name: "Network Theory",                   credits: 3, category: "DC", semester: 4 },
  { code: "EE231", name: "Measurement and Instrumentation",  credits: 3, category: "DC", semester: 4 },
];
const eeSem5: DefaultCourse[] = [
  { code: "EE311", name: "Device Electronics",      credits: 3, category: "DC", semester: 5 },
  { code: "EE202", name: "Electromagnetic Theory",  credits: 3, category: "DC", semester: 5 },
  { code: "EE201", name: "Electro-Mechanics",       credits: 4, category: "DC", semester: 5 },
];
const eeSem6: DefaultCourse[] = [
  { code: "EE211",  name: "Analog Circuit Design",    credits: 4, category: "DC", semester: 6 },
  ...istpSem6,
];
const eeSem7: DefaultCourse[] = [
  { code: "EE314",  name: "Digital Signal Processing",                             credits: 3, category: "DC", semester: 7 },
  { code: "EE326",  name: "Computer Organization & Processor Architecture Design", credits: 4, category: "DC", semester: 7 },
  { code: "EEXXX2", name: "Reverse Engineering",                                   credits: 1, category: "DC", semester: 7 },
  ...mtpSem7,
];
const eeSem8: DefaultCourse[] = [...mtpSem8];

// ─── ME  (DC = 50 cr | IC-I: free choice | IC-II: free choice) ───────────────
const meSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const meSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const meSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "EE261", name: "Electrical Systems Around Us",        credits: 3, category: "DC", semester: 3 },
  { code: "ME212", name: "Product Manufacturing Technologies",  credits: 3, category: "DC", semester: 3 },
  { code: "ME213", name: "Engineering Thermodynamics",          credits: 3, category: "DC", semester: 3 },
];
const meSem4: DefaultCourse[] = [
  { code: "IC241", name: "Material Science for Engineers", credits: 3, category: "DC", semester: 4 },
  { code: "ME205", name: "Machine Drawing",                credits: 3, category: "DC", semester: 4 },
  { code: "ME206", name: "Mechanics of Solids",            credits: 3, category: "DC", semester: 4 },
];
const meSem5: DefaultCourse[] = [
  { code: "ME210",  name: "Fluid Mechanics",            credits: 3, category: "DC", semester: 5 },
  { code: "ME210P", name: "Fluid Mechanics Lab",        credits: 1, category: "DC", semester: 5 },
  { code: "ME303",  name: "Heat Transfer",              credits: 3, category: "DC", semester: 5 },
  { code: "ME303P", name: "Heat Transfer Lab",          credits: 1, category: "DC", semester: 5 },
  { code: "ME305",  name: "Design of Machine Elements", credits: 4, category: "DC", semester: 5 },
];
const meSem6: DefaultCourse[] = [
  { code: "ME307",  name: "Energy Conversion Devices",    credits: 3, category: "DC", semester: 6 },
  { code: "ME308",  name: "Manufacturing Engineering 1",  credits: 3, category: "DC", semester: 6 },
  { code: "ME309",  name: "Theory of Machines",           credits: 4, category: "DC", semester: 6 },
  { code: "ME310",  name: "System Dynamics and Control",  credits: 3, category: "DC", semester: 6 },
  { code: "ME311P", name: "Design Lab 1",                 credits: 1, category: "DC", semester: 6 },
  { code: "ME312P", name: "Design Lab 2",                 credits: 1, category: "DC", semester: 6 },
  ...istpSem6,
];
const meSem7: DefaultCourse[] = [
  { code: "ME315", name: "Manufacturing Engineering 2", credits: 3, category: "DC", semester: 7 },
  { code: "ME100", name: "Reverse Engineering",         credits: 1, category: "DC", semester: 7 },
  ...mtpSem7,
];
const meSem8: DefaultCourse[] = [...mtpSem8];

// ─── CE  (DC = 49 cr | IC-I: free choice | IC-II: free choice) ───────────────
const ceSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const ceSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const ceSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "CE201", name: "Surveying Traditional and Digital",             credits: 4, category: "DC", semester: 3 },
  { code: "CE251", name: "Hydraulics Engineering",                        credits: 3, category: "DC", semester: 3 },
  { code: "CE202", name: "Introduction to Civil Engineering Profession",  credits: 1, category: "DC", semester: 3 },
];
const ceSem4: DefaultCourse[] = [
  { code: "CE252",  name: "Geology and Geomorphology",  credits: 3, category: "DC", semester: 4 },
  { code: "CE203",  name: "Construction Materials",     credits: 3, category: "DC", semester: 4 },
  { code: "CE354P", name: "Construction Materials Lab", credits: 1, category: "DC", semester: 4 },
];
const ceSem5: DefaultCourse[] = [
  { code: "CE301",  name: "Strength of Materials and Structures",     credits: 3, category: "DC", semester: 5 },
  { code: "CE301P", name: "Strength of Materials and Structures Lab", credits: 1, category: "DC", semester: 5 },
  { code: "CE302",  name: "Geotechnical Engineering I",               credits: 3, category: "DC", semester: 5 },
  { code: "CE302P", name: "Geotechnical Engineering Lab",             credits: 1, category: "DC", semester: 5 },
  { code: "CE304P", name: "Hydraulics Engineering Lab",               credits: 1, category: "DC", semester: 5 },
  { code: "CE305P", name: "Environmental Engineering Lab",            credits: 1, category: "DC", semester: 5 },
];
const ceSem6: DefaultCourse[] = [
  { code: "CE352",  name: "Transportation Engineering",       credits: 3, category: "DC", semester: 6 },
  { code: "CE352P", name: "Transportation Engineering Lab",   credits: 1, category: "DC", semester: 6 },
  { code: "CE401",  name: "Design of Steel Structures",       credits: 3, category: "DC", semester: 6 },
  { code: "CE403",  name: "Water and Wastewater Engineering", credits: 3, category: "DC", semester: 6 },
  { code: "CE404",  name: "Analysis of Structures",           credits: 3, category: "DC", semester: 6 },
  ...istpSem6,
];
const ceSem7: DefaultCourse[] = [
  { code: "CE402",  name: "Geotechnical Engineering II",              credits: 3, category: "DC", semester: 7 },
  { code: "CE303",  name: "Water Resources Engineering",              credits: 3, category: "DC", semester: 7 },
  { code: "CE351",  name: "Design of Reinforced Concrete Structures", credits: 3, category: "DC", semester: 7 },
  { code: "CE353P", name: "Civil Engineering Drawing",                credits: 1, category: "DC", semester: 7 },
  { code: "CEXXX",  name: "Reverse Engineering",                      credits: 1, category: "DC", semester: 7 },
  ...mtpSem7,
];
const ceSem8: DefaultCourse[] = [...mtpSem8];

// ─── BE  (DC = 42 cr | IC-I: free choice | IC-II: free choice) ───────────────
const beSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const beSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const beSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "BE201", name: "Cell Biology",                        credits: 4, category: "DC", semester: 3 },
  { code: "BE202", name: "Biochemistry and Molecular Biology",  credits: 4, category: "DC", semester: 3 },
];
const beSem4: DefaultCourse[] = [
  { code: "BE203", name: "Enzymology and Bioprocessing", credits: 4, category: "DC", semester: 4 },
  { code: "BE301", name: "Biomechanics",                 credits: 4, category: "DC", semester: 4 },
];
const beSem5: DefaultCourse[] = [
  { code: "BE308", name: "Introduction to Biomanufacturing",  credits: 4, category: "DC", semester: 5 },
  { code: "BE303", name: "Applied Biostatistics",             credits: 4, category: "DC", semester: 5 },
  { code: "BE305", name: "Bioethics and Regulatory Affairs",  credits: 1, category: "DC", semester: 5 },
];
const beSem6: DefaultCourse[] = [
  { code: "BE304", name: "Bioinformatics",                      credits: 4, category: "DC", semester: 6 },
  { code: "BE306", name: "Fundamentals of Genetic Engineering", credits: 4, category: "DC", semester: 6 },
  { code: "BE309", name: "Biosensing & Bioinstrumentation",     credits: 4, category: "DC", semester: 6 },
  ...istpSem6,
];
const beSem7: DefaultCourse[] = [
  { code: "BE310", name: "Biomaterials",      credits: 4, category: "DC", semester: 7 },
  { code: "BEXXX", name: "Reverse Engineering", credits: 1, category: "DC", semester: 7 },
  ...mtpSem7,
];
const beSem8: DefaultCourse[] = [...mtpSem8];

// ─── EP  (DC = 37 cr | IC-I: free choice | IC-II: free choice) ───────────────
const epSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const epSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const epSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "EP321", name: "Foundations of Electrodynamics", credits: 3, category: "DC", semester: 3 },
  { code: "EP301", name: "Engineering Mathematics 2",      credits: 4, category: "DC", semester: 3 },
];
const epSem4: DefaultCourse[] = [
  { code: "PH301", name: "Quantum Mechanics and Applications",          credits: 3, category: "DC", semester: 4 },
  { code: "PH302", name: "Introduction to Statistical Mechanics",       credits: 3, category: "DC", semester: 4 },
  { code: "EE311", name: "Device Electronics for Integrated Circuits",  credits: 3, category: "DC", semester: 4 },
  { code: "EP302", name: "Computational Methods for Engineering",       credits: 3, category: "DC", semester: 4 },
];
const epSem5: DefaultCourse[] = [
  { code: "EP402P", name: "Engineering Physics Practicum",   credits: 4, category: "DC", semester: 5 },
  { code: "PH502",  name: "Photonics",                       credits: 3, category: "DC", semester: 5 },
  { code: "EP403",  name: "Physics of Atoms and Molecules",  credits: 3, category: "DC", semester: 5 },
];
const epSem6: DefaultCourse[] = [
  { code: "EP401P", name: "Engineering of Instrumentation", credits: 4, category: "DC", semester: 6 },
  { code: "PH501",  name: "Solid State Physics",            credits: 3, category: "DC", semester: 6 },
  { code: "EPXXX",  name: "Reverse Engineering",            credits: 1, category: "DC", semester: 6 },
  ...istpSem6,
];
const epSem7: DefaultCourse[] = [...mtpSem7];
const epSem8: DefaultCourse[] = [...mtpSem8];

// ─── MNC  (DC = 51 cr | IC-I: free choice | IC-II: free choice) ──────────────
const mncSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const mncSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const mncSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "CS208", name: "Mathematical Foundations of Computer Science", credits: 4, category: "DC", semester: 3 },
  { code: "MA211", name: "Ordinary Differential Equations",              credits: 4, category: "DC", semester: 3 },
];
const mncSem4: DefaultCourse[] = [
  { code: "MA220", name: "Partial Differential Equations", credits: 4, category: "DC", semester: 4 },
  { code: "CS214", name: "Computer Organisation",          credits: 4, category: "DC", semester: 4 },
  { code: "MA210", name: "Real and Complex Analysis",      credits: 3, category: "DC", semester: 4 },
];
const mncSem5: DefaultCourse[] = [
  { code: "MA221",  name: "Numerical Analysis",                   credits: 4, category: "DC", semester: 5 },
  { code: "MA310",  name: "Matrix Computation and Lab",           credits: 4, category: "DC", semester: 5 },
  { code: "CS304",  name: "Formal Language and Automata Theory",  credits: 3, category: "DC", semester: 5 },
  { code: "MA323P", name: "Applied Databases Practicum",          credits: 2, category: "DC", semester: 5 },
];
const mncSem6: DefaultCourse[] = [
  { code: "MA222", name: "Applied Linear Programming",  credits: 4, category: "DC", semester: 6 },
  { code: "CS312", name: "Design of Algorithms",        credits: 4, category: "DC", semester: 6 },
  { code: "MA311", name: "Mathematical Modelling",      credits: 3, category: "DC", semester: 6 },
  ...istpSem6,
];
const mncSem7: DefaultCourse[] = [
  { code: "MA321", name: "Numerics of Differential Equation", credits: 4, category: "DC", semester: 7 },
  { code: "MA322", name: "Applied Graph Theory",              credits: 4, category: "DC", semester: 7 },
  ...mtpSem7,
];
const mncSem8: DefaultCourse[] = [...mtpSem8];

// ─── MSE  (DC = 45 cr | IC-I: free choice | IC-II: free choice) ──────────────
const mseSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const mseSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const mseSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "MT201", name: "Physics of Solids",                        credits: 3, category: "DC", semester: 3 },
  { code: "MT203", name: "Material Synthesis and Characterisation",  credits: 4, category: "DC", semester: 3 },
];
const mseSem4: DefaultCourse[] = [
  { code: "MT301", name: "Phase Transformations",                       credits: 3, category: "DC", semester: 4 },
  { code: "MT204", name: "Thermodynamics and Kinetics and Materials",   credits: 3, category: "DC", semester: 4 },
  { code: "MT202", name: "Quantum Mechanics and Applications",          credits: 3, category: "DC", semester: 4 },
];
const mseSem5: DefaultCourse[] = [
  { code: "MT304", name: "Mechanical Behaviour of Materials",  credits: 4, category: "DC", semester: 5 },
  { code: "MT205", name: "Functional Properties of Materials", credits: 4, category: "DC", semester: 5 },
  { code: "ME206", name: "Mechanics of Solids",                credits: 3, category: "DC", semester: 5 },
];
const mseSem6: DefaultCourse[] = [
  { code: "MT206", name: "Extraction and Materials Processing", credits: 4, category: "DC", semester: 6 },
  { code: "MT302", name: "Transport Phenomena",                 credits: 3, category: "DC", semester: 6 },
  { code: "MT303", name: "Computational Materials Science",     credits: 4, category: "DC", semester: 6 },
  ...istpSem6,
];
const mseSem7: DefaultCourse[] = [
  { code: "ME212", name: "Product Realization (Manufacturing) Technology", credits: 3, category: "DC", semester: 7 },
  { code: "ME100", name: "Reverse Engineering",                            credits: 1, category: "DC", semester: 7 },
  ...mtpSem7,
];
const mseSem8: DefaultCourse[] = [...mtpSem8];

// ─── GE  (DC = 36 cr | IC-I: free choice | IC-II: free choice) ───────────────
// GE has 3 sub-branches; Sem 1 & 2 are identical for all three.
const geSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const geSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];

// ── GE sub-branch: Robotics & AI ──
const geRaiSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "EE201", name: "Electromechanics",            credits: 3, category: "DC", semester: 3 },
  { code: "EE261", name: "Electrical System Around Us", credits: 3, category: "DC", semester: 3 },
];
const geRaiSem4: DefaultCourse[] = [
  { code: "IC241", name: "Material Science for Engineers",  credits: 3, category: "DC", semester: 4 },
  { code: "IC253", name: "Programming and Data Structures", credits: 3, category: "DC", semester: 4 },
  { code: "DS201", name: "Data Handling and Vizualization", credits: 3, category: "DC", semester: 4 },
  { code: "EE301", name: "Control Systems",                 credits: 3, category: "DC", semester: 4 },
];
const geRaiSem5: DefaultCourse[] = [
  { code: "ME309", name: "Theory of Machines",                     credits: 4, category: "DC", semester: 5 },
  { code: "AR501", name: "Robot Kinematics, Dynamics and Control", credits: 4, category: "DC", semester: 5 },
  { code: "AR503", name: "Mechatronics",                           credits: 3, category: "DC", semester: 5 },
];
const geRaiSem6: DefaultCourse[] = [
  { code: "AR504", name: "Robot Programming",          credits: 3, category: "DC", semester: 6 },
  { code: "ME305", name: "Design of Machine Elements", credits: 4, category: "DC", semester: 6 },
  ...istpSem6,
];
const geRaiSem7: DefaultCourse[] = [...mtpSem7];
const geRaiSem8: DefaultCourse[] = [...mtpSem8];

// ── GE sub-branch: Communication Engineering ──
const geCeSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "EE261", name: "Electrical System Around Us",    credits: 3, category: "DC", semester: 3 },
  { code: "EE231", name: "Measurement and Instrumentation", credits: 3, category: "DC", semester: 3 },
  { code: "EE201", name: "Electromechanics",                credits: 3, category: "DC", semester: 3 },
];
const geCeSem4: DefaultCourse[] = [
  { code: "EE203", name: "Network Theory",                  credits: 3, category: "DC", semester: 4 },
  { code: "IC253", name: "Programming and Data Structures", credits: 3, category: "DC", semester: 4 },
  { code: "EE260", name: "Signals and Systems",             credits: 3, category: "DC", semester: 4 },
  { code: "EE304", name: "Communication Theory",            credits: 3, category: "DC", semester: 4 },
];
const geCeSem5: DefaultCourse[] = [
  { code: "DS404", name: "Information Security and Privacy", credits: 3, category: "DC", semester: 5 },
  { code: "CS313", name: "Computer Networks",                credits: 4, category: "DC", semester: 5 },
  { code: "EE314", name: "Digital Signal Processing",        credits: 4, category: "DC", semester: 5 },
  { code: "ME100", name: "Reverse Engineering",              credits: 1, category: "DC", semester: 5 },
];
const geCeSem6: DefaultCourse[] = [
  { code: "EE202", name: "Electromagnetic Theory", credits: 3, category: "DC", semester: 6 },
  ...istpSem6,
];
const geCeSem7: DefaultCourse[] = [...mtpSem7];
const geCeSem8: DefaultCourse[] = [...mtpSem8];

// ── GE sub-branch: Mechatronics ──
const geMechSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "EE201", name: "Electromechanics",            credits: 3, category: "DC", semester: 3 },
  { code: "EE261", name: "Electrical System Around Us", credits: 3, category: "DC", semester: 3 },
  { code: "EE260", name: "Signals and Systems",         credits: 3, category: "DC", semester: 3 },
];
const geMechSem4: DefaultCourse[] = [
  { code: "EE211", name: "Analog Circuit Design", credits: 3, category: "DC", semester: 4 },
  { code: "ME206", name: "Mechanics of Solids",   credits: 3, category: "DC", semester: 4 },
  { code: "EE301", name: "Control Systems",       credits: 3, category: "DC", semester: 4 },
];
const geMechSem5: DefaultCourse[] = [
  { code: "ME309", name: "Theory of Machines",                   credits: 4, category: "DC", semester: 5 },
  { code: "EE326", name: "CO and Processor Architecture Design", credits: 4, category: "DC", semester: 5 },
  { code: "AR503", name: "Mechatronics",                         credits: 3, category: "DC", semester: 5 },
];
const geMechSem6: DefaultCourse[] = [
  { code: "EE311", name: "Device Electronics for Integrated Circuits", credits: 3, category: "DC", semester: 6 },
  { code: "ME305", name: "Design of Machine Elements",                 credits: 4, category: "DC", semester: 6 },
  { code: "ME100", name: "Reverse Engineering",                        credits: 1, category: "DC", semester: 6 },
  ...istpSem6,
];
const geMechSem7: DefaultCourse[] = [...mtpSem7];
const geMechSem8: DefaultCourse[] = [...mtpSem8];

// ─── MEVLSI  (DC = 54 cr | both IC baskets: free choice) ─────────────────────
const mevlsiSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ...allICB1];
const mevlsiSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ...allICB2];
const mevlsiSem3: DefaultCourse[] = [
  ...icSem3,
  { code: "EE260", name: "Signals and Systems",                  credits: 3, category: "DC", semester: 3 },
  { code: "EE210", name: "Digital System Design and Practicum",  credits: 4, category: "DC", semester: 3 },
];
const mevlsiSem4: DefaultCourse[] = [
  { code: "EE203",  name: "Network Theory",                   credits: 3, category: "DC", semester: 4 },
  { code: "EE301",  name: "Control Systems",                  credits: 4, category: "DC", semester: 4 },
  { code: "VLXXX1", name: "Semiconductor Devices for IC's",   credits: 3, category: "DC", semester: 4 },
];
const mevlsiSem5: DefaultCourse[] = [
  { code: "EE202", name: "Electromagnetic Theory and Transmission Lines", credits: 3, category: "DC", semester: 5 },
  { code: "EE326", name: "Computer Organization and Design",              credits: 4, category: "DC", semester: 5 },
  { code: "EE211", name: "Analog Circuit Design",                         credits: 4, category: "DC", semester: 5 },
  { code: "VL311", name: "CMOS Processing and Practicum",                 credits: 4, category: "DC", semester: 5 },
];
const mevlsiSem6: DefaultCourse[] = [
  { code: "VL402",  name: "RF IC Design",                   credits: 3, category: "DC", semester: 6 },
  { code: "VL401",  name: "RTL Design and Verification",    credits: 3, category: "DC", semester: 6 },
  { code: "VL403",  name: "CMOS Digital IC Design",         credits: 4, category: "DC", semester: 6 },
  { code: "VL404",  name: "CMOS Analog IC Design",          credits: 4, category: "DC", semester: 6 },
  { code: "VLXXX2", name: "Electronic System Packaging",    credits: 3, category: "DC", semester: 6 },
  ...istpSem6,
];
const mevlsiSem7: DefaultCourse[] = [
  { code: "VL405",  name: "Design for Testability", credits: 4, category: "DC", semester: 7 },
  { code: "VLXXX3", name: "Reverse Engineering",    credits: 1, category: "DC", semester: 7 },
  ...mtpSem7,
];
const mevlsiSem8: DefaultCourse[] = [...mtpSem8];

// ─── BSCS  (B.S. Chemical Sciences | DC = 59 cr) ─────────────────────────────
// IC-I: forced IC131 | IC-II: forced IC121
// BSCS has 31 cr IC Compulsory (vs 39 for BTech); IC272 not included.
const bscsSem1: DefaultCourse[] = [...icCompSem1, ...icMixedSem1, ICB1_IC131];
const bscsSem2: DefaultCourse[] = [...icCompSem2, ...icMixedSem2, ICB2_IC121];
const bscsSem3: DefaultCourse[] = [
  { code: "IC202P", name: "Design Practicum",                                    credits: 3, category: "IC", semester: 3 },
  { code: "CY301",  name: "Principles and Theories of Physical Chemistry",        credits: 3, category: "DC", semester: 3 },
  { code: "CY302",  name: "Principles of Organic Chemistry",                     credits: 3, category: "DC", semester: 3 },
  { code: "CY201P", name: "Physical Chemistry Laboratory",                       credits: 2, category: "DC", semester: 3 },
];
const bscsSem4: DefaultCourse[] = [
  { code: "CY303",  name: "Fundamentals of Inorganic Chemistry", credits: 3, category: "DC", semester: 4 },
  { code: "CY304",  name: "Fundamental Analytical Chemistry",    credits: 3, category: "DC", semester: 4 },
  { code: "CY202P", name: "Organic Chemistry Laboratory",        credits: 2, category: "DC", semester: 4 },
  { code: "CY203P", name: "Inorganic Chemistry Laboratory",      credits: 2, category: "DC", semester: 4 },
];
const bscsSem5: DefaultCourse[] = [
  { code: "CY401",  name: "Introduction to Quantum Chemistry and Molecular Spectroscopy", credits: 3, category: "DC", semester: 5 },
  { code: "CY531",  name: "Organic Reactions and Mechanisms",                             credits: 3, category: "DC", semester: 5 },
  { code: "CY533",  name: "Chemistry of Main Group Elements",                            credits: 3, category: "DC", semester: 5 },
  { code: "CY512",  name: "Advanced Quantum Chemistry",                                  credits: 3, category: "DC", semester: 5 },
];
const bscsSem6: DefaultCourse[] = [
  { code: "CY512P", name: "Physical Chemistry Laboratory",           credits: 3, category: "DC", semester: 6 },
  { code: "CY533P", name: "Inorganic Chemistry Laboratory",          credits: 3, category: "DC", semester: 6 },
  { code: "CY532",  name: "Photochemistry and Pericyclic Reactions", credits: 3, category: "DC", semester: 6 },
  { code: "CY534",  name: "Chemistry of Transition Elements",        credits: 3, category: "DC", semester: 6 },
  ...istpSem6,
];
const bscsSem7: DefaultCourse[] = [
  { code: "CY511",  name: "Group Theory and Spectroscopy",            credits: 3, category: "DC", semester: 7 },
  { code: "CY531P", name: "Organic Chemistry Laboratory",             credits: 3, category: "DC", semester: 7 },
  { code: "CY514",  name: "Chemical and Statistical Thermodynamics",  credits: 3, category: "DC", semester: 7 },
  { code: "CY535",  name: "Introduction to Organometallic Chemistry", credits: 3, category: "DC", semester: 7 },
  ...mtpSem7,
];
const bscsSem8: DefaultCourse[] = [
  { code: "CY513", name: "Chemical Kinetics and Reaction Dynamics", credits: 3, category: "DC", semester: 8 },
  { code: "CY504", name: "Heterocyclic Chemistry",                  credits: 2, category: "DC", semester: 8 },
  ...mtpSem8,
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

  // GE – Robotics & AI (default / backward compat)
  GE_1: geSem1, GE_2: geSem2, GE_3: geRaiSem3,
  GE_4: geRaiSem4, GE_5: geRaiSem5, GE_6: geRaiSem6,
  GE_7: geRaiSem7, GE_8: geRaiSem8,
  // GE – Robotics & AI (explicit key)
  GERAI_1: geSem1, GERAI_2: geSem2, GERAI_3: geRaiSem3,
  GERAI_4: geRaiSem4, GERAI_5: geRaiSem5, GERAI_6: geRaiSem6,
  GERAI_7: geRaiSem7, GERAI_8: geRaiSem8,
  // GE – Communication Engineering
  GECE_1: geSem1, GECE_2: geSem2, GECE_3: geCeSem3,
  GECE_4: geCeSem4, GECE_5: geCeSem5, GECE_6: geCeSem6,
  GECE_7: geCeSem7, GECE_8: geCeSem8,
  // GE – Mechatronics
  GEMECH_1: geSem1, GEMECH_2: geSem2, GEMECH_3: geMechSem3,
  GEMECH_4: geMechSem4, GEMECH_5: geMechSem5, GEMECH_6: geMechSem6,
  GEMECH_7: geMechSem7, GEMECH_8: geMechSem8,

  // MEVLSI
  MEVLSI_1: mevlsiSem1, MEVLSI_2: mevlsiSem2, MEVLSI_3: mevlsiSem3,
  MEVLSI_4: mevlsiSem4, MEVLSI_5: mevlsiSem5, MEVLSI_6: mevlsiSem6, MEVLSI_7: mevlsiSem7, MEVLSI_8: mevlsiSem8,

  // BSCS
  BSCS_1: bscsSem1, BSCS_2: bscsSem2, BSCS_3: bscsSem3,
  BSCS_4: bscsSem4, BSCS_5: bscsSem5, BSCS_6: bscsSem6,
  BSCS_7: bscsSem7, BSCS_8: bscsSem8,
};

export function getDefaultCurriculum(branch: string, semester: number): DefaultCourse[] {
  const key = `${branch}_${semester}`;
  return DEFAULT_CURRICULUM[key] || [];
}

export function getAllDefaultCourses(branch: string, upToSemester: number = 8): DefaultCourse[] {
  const courses: DefaultCourse[] = [];
  for (let sem = 1; sem <= upToSemester; sem++) {
    courses.push(...getDefaultCurriculum(branch, sem));
  }
  return courses;
}
