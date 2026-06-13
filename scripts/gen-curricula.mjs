/**
 * gen-curricula.mjs
 * Generates LaTeX curriculum PDFs for all IIT Mandi B.Tech branches × B23/B24/B25 batches.
 * Self-contained: re-implements curriculum logic from defaultCurriculum.ts inline.
 */

import { execSync } from "child_process";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(__dirname, "..");
const CURRICULA_DIR = join(PROJECT, "docs", "curricula");
const PDFLATEX = "C:\\Users\\AdityaTayal\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe";

// ─── Curriculum data (inline from defaultCurriculum.ts) ─────────────────────

// IC courses common to all BTech
const icCompSem1 = [
  { code: "IC112",  name: "Calculus",                              credits: 2, category: "IC",  semester: 1 },
  { code: "IC113",  name: "Complex Variables and Vector Calculus", credits: 2, category: "IC",  semester: 1 },
  { code: "IC152",  name: "Computing and Data Science",            credits: 4, category: "IC",  semester: 1 },
];
const icMixedSem1 = [
  { code: "IC140",  name: "Engineering Graphics for Design",  credits: 4, category: "IC",  semester: 1 },
  { code: "IC102P", name: "Foundations of Design Practicum",  credits: 4, category: "IC",  semester: 1 },
  { code: "IC181",  name: "Indian Knowledge Systems",         credits: 3, category: "IKS", semester: 1 },
];
const icCompSem2 = [
  { code: "IC161",  name: "Applied Electronics",        credits: 3, category: "IC", semester: 2 },
  { code: "IC114",  name: "Linear Algebra",             credits: 2, category: "IC", semester: 2 },
  { code: "IC115",  name: "ODE and Integral Transforms", credits: 2, category: "IC", semester: 2 },
  { code: "IC161P", name: "Applied Electronics Lab",    credits: 2, category: "IC", semester: 2 },
  { code: "IC222P", name: "Physics Practicum",          credits: 2, category: "IC", semester: 2 },
  { code: "IC252",  name: "Probability and Statistics", credits: 4, category: "IC", semester: 2 },
];
const icMixedSem2 = [
  { code: "IC140",  name: "Engineering Graphics for Design",  credits: 4, category: "IC",  semester: 2 },
  { code: "IC102P", name: "Foundations of Design Practicum",  credits: 4, category: "IC",  semester: 2 },
  { code: "IC181",  name: "Indian Knowledge Systems",         credits: 3, category: "IKS", semester: 2 },
];

// ICB
const ICB1_IC131 = { code: "IC131", name: "Applied Chemistry for Engineers",                  credits: 3, category: "ICB", semester: 1 };
const ICB1_IC136 = { code: "IC136", name: "Understanding Biotechnology and its Applications", credits: 3, category: "ICB", semester: 1 };
const ICB1_IC230 = { code: "IC230", name: "Environmental Science",                            credits: 3, category: "ICB", semester: 1 };
const allICB1 = [ICB1_IC131, ICB1_IC136, ICB1_IC230];

const ICB2_IC121 = { code: "IC121", name: "Mechanics of Particles and Waves",  credits: 3, category: "ICB", semester: 2 };
const ICB2_IC240 = { code: "IC240", name: "Mechanics of Rigid Bodies",          credits: 3, category: "ICB", semester: 2 };
const ICB2_IC241 = { code: "IC241", name: "Material Science for Engineers",     credits: 3, category: "ICB", semester: 2 };
const ICB2_IC253 = { code: "IC253", name: "Data Structures and Algorithms",     credits: 3, category: "ICB", semester: 2 };
const allICB2 = [ICB2_IC121, ICB2_IC240, ICB2_IC241, ICB2_IC253];

// IC Sem3/4
const icSem3 = [
  { code: "IC202P", name: "Design Practicum", credits: 3, category: "IC", semester: 3 },
  { code: "IC272",  name: "Machine Learning", credits: 3, category: "IC", semester: 3 },
];
const icSem3WithoutIC202P = [
  { code: "IC272", name: "Machine Learning", credits: 3, category: "IC", semester: 3 },
];
const ic202pSem4 = [
  { code: "IC202P", name: "Design Practicum", credits: 3, category: "IC", semester: 4 },
];

// ISTP/MTP
const istpSem6 = [
  { code: "DP 301P", name: "Interdisciplinary Socio-Technical Practicum", credits: 4, category: "ISTP", semester: 6 },
];
const mtpSem7 = [
  { code: "DP 498P", name: "Major Technical Project - I",  credits: 4, category: "MTP", semester: 7 },
];
const mtpSem8 = [
  { code: "DP 499P", name: "Major Technical Project - II", credits: 4, category: "MTP", semester: 8 },
];

// ─── Base curriculum per branch ──────────────────────────────────────────────

const BASE_CURRICULUM = {
  CSE: [
    [...icCompSem1, ...icMixedSem1, ...allICB1],
    [...icCompSem2, ...icMixedSem2, ...allICB2],
    [...icSem3,
      { code: "CS208", name: "Mathematical Foundations of Computer Science", credits: 4, category: "DC", semester: 3 },
      { code: "CS214", name: "Computer Organization",                        credits: 4, category: "DC", semester: 3 },
      { code: "CS212", name: "Design of Algorithms",                         credits: 4, category: "DC", semester: 3 },
      { code: "CS213", name: "Reverse Engineering",                          credits: 1, category: "DC", semester: 3 },
    ],
    [
      { code: "CS304", name: "Formal Language and Automata Theory", credits: 3, category: "DC", semester: 4 },
      { code: "CS309", name: "Information Systems and Databases",   credits: 4, category: "DC", semester: 4 },
    ],
    [
      { code: "CS313", name: "Computer Networks",       credits: 4, category: "DC", semester: 5 },
      { code: "CS312", name: "Operating Systems",       credits: 4, category: "DC", semester: 5 },
      { code: "CS305", name: "Artificial Intelligence", credits: 3, category: "DC", semester: 5 },
    ],
    [
      { code: "CS302", name: "Paradigms of Programming", credits: 4, category: "DC", semester: 6 },
      { code: "CS303", name: "Software Engineering",     credits: 3, category: "DC", semester: 6 },
      ...istpSem6,
    ],
    [...mtpSem7],
    [
      { code: "CS010", name: "Internship", credits: 2, category: "IC", semester: 8 },
      ...mtpSem8,
    ],
  ],

  DSE: [
    [...icCompSem1, ...icMixedSem1, ...allICB1],
    [...icCompSem2, ...icMixedSem2, ...allICB2],
    [...icSem3WithoutIC202P,
      { code: "DS201", name: "Data Handling and Visualisation",          credits: 3, category: "DC", semester: 3 },
      { code: "DS301", name: "Mathematical Foundations of Data Science", credits: 4, category: "DC", semester: 3 },
      { code: "CS213", name: "Reverse Engineering",                      credits: 1, category: "DC", semester: 3 },
    ],
    [...ic202pSem4,
      { code: "DS302", name: "Computing Systems for Data Processing",   credits: 3, category: "DC", semester: 4 },
      { code: "DS313", name: "Statistical Foundations of Data Science", credits: 4, category: "DC", semester: 4 },
      { code: "DS404", name: "Information Security and Privacy",        credits: 3, category: "DC", semester: 4 },
      { code: "DS412", name: "Matrix Computations for Data Science",    credits: 4, category: "DC", semester: 4 },
    ],
    [
      { code: "CS305", name: "Artificial Intelligence",              credits: 3, category: "DC", semester: 5 },
      { code: "DS413", name: "Introduction to Statistical Learning", credits: 4, category: "DC", semester: 5 },
    ],
    [
      { code: "DS411", name: "Optimization for Data Science", credits: 4, category: "DC", semester: 6 },
      ...istpSem6,
    ],
    [...mtpSem7],
    [
      { code: "DS010", name: "Internship", credits: 2, category: "IC", semester: 8 },
      ...mtpSem8,
    ],
  ],

  DSAI: [
    [...icCompSem1, ...icMixedSem1, ...allICB1],
    [...icCompSem2, ...icMixedSem2, ...allICB2],
    [...icSem3WithoutIC202P,
      { code: "CS213", name: "Reverse Engineering",                  credits: 1, category: "DC", semester: 3 },
      { code: "DS313", name: "Probability Theory and Statistics",    credits: 4, category: "DC", semester: 3 },
      { code: "DS412", name: "Matrix Computations for Data Science", credits: 4, category: "DC", semester: 3 },
    ],
    [
      { code: "IC202P", name: "Design Practicum",                      credits: 3, category: "IC", semester: 4 },
      { code: "DS411",  name: "Optimization for Machine Learning",     credits: 4, category: "DC", semester: 4 },
      { code: "DS302",  name: "Computing Systems for Data Processing", credits: 3, category: "DC", semester: 4 },
    ],
    [
      { code: "DS413", name: "Fundamentals of Machine Learning", credits: 4, category: "DC", semester: 5 },
      { code: "CS305", name: "Artificial Intelligence",          credits: 3, category: "DC", semester: 5 },
    ],
    [
      { code: "DS417", name: "Deep Learning",                 credits: 4, category: "DC", semester: 6 },
      { code: "DS418", name: "Introduction to Generative AI", credits: 4, category: "DC", semester: 6 },
      { code: "DP 301P", name: "Interdisciplinary Socio-Technical Practicum", credits: 4, category: "ISTP", semester: 6, optional: true },
    ],
    [...mtpSem7],
    [
      { code: "DS010", name: "Internship", credits: 2, category: "IC", semester: 8 },
      ...mtpSem8,
    ],
  ],

  EE: [
    [...icCompSem1, ...icMixedSem1, ...allICB1],
    [...icCompSem2, ...icMixedSem2, ...allICB2],
    [...icSem3WithoutIC202P,
      { code: "EE203", name: "Network Theory",              credits: 3, category: "DC", semester: 3 },
      { code: "EE210", name: "Digital System Design",       credits: 4, category: "DC", semester: 3 },
      { code: "EE260", name: "Signals and Systems",         credits: 3, category: "DC", semester: 3 },
      { code: "EE261", name: "Electrical Systems Around Us", credits: 5, category: "DC", semester: 3 },
      { code: "EE311", name: "Device Electronics",          credits: 3, category: "DC", semester: 3 },
    ],
    [...ic202pSem4,
      { code: "EE201",  name: "Electro-Mechanics",      credits: 4, category: "DC", semester: 4 },
      { code: "EE202",  name: "Electromagnetic Theory", credits: 3, category: "DC", semester: 4 },
      { code: "EE211",  name: "Analog Circuit Design",  credits: 4, category: "DC", semester: 4 },
      { code: "EE304",  name: "Communication Systems",  credits: 4, category: "DC", semester: 4 },
      { code: "EE223P", name: "Reverse Engineering",    credits: 1, category: "DC", semester: 4 },
    ],
    [
      { code: "EE231",  name: "Measurement and Instrumentation",                         credits: 3, category: "DC", semester: 5 },
      { code: "EE301",  name: "Control Systems",                                         credits: 4, category: "DC", semester: 5 },
      { code: "EE314",  name: "Digital Signal Processing",                               credits: 3, category: "DC", semester: 5 },
      { code: "EE326",  name: "Computer Organization and Processor Architecture Design", credits: 4, category: "DC", semester: 5 },
      { code: "EEXXX",  name: "Power and Energy Systems",                                credits: 4, category: "DC", semester: 5 },
    ],
    [...istpSem6],
    [...mtpSem7],
    [
      { code: "EE010", name: "Internship", credits: 2, category: "IC", semester: 8 },
      ...mtpSem8,
    ],
  ],

  ME: [
    [...icCompSem1, ...icMixedSem1, ...allICB1],
    [...icCompSem2, ...icMixedSem2, ICB2_IC121, ICB2_IC240, ICB2_IC253],
    [...icSem3WithoutIC202P,
      { code: "EE261", name: "Electrical Systems Around Us",       credits: 3, category: "DC", semester: 3 },
      { code: "IC241", name: "Material Science for Engineers",     credits: 3, category: "DC", semester: 3 },
      { code: "ME100", name: "Reverse Engineering",                credits: 1, category: "DC", semester: 3 },
      { code: "ME205", name: "Machine Drawing",                    credits: 3, category: "DC", semester: 3 },
      { code: "ME210", name: "Fluid Mechanics",                    credits: 3, category: "DC", semester: 3 },
      { code: "ME212", name: "Product Manufacturing Technologies", credits: 3, category: "DC", semester: 3 },
      { code: "ME213", name: "Engineering Thermodynamics",         credits: 4, category: "DC", semester: 3 },
      { code: "ME308", name: "Manufacturing Engineering 1",        credits: 3, category: "DC", semester: 3 },
      { code: "ME310", name: "System Dynamics and Control",        credits: 3, category: "DC", semester: 3 },
    ],
    [...ic202pSem4,
      { code: "ME206",  name: "Mechanics of Solids",       credits: 3, category: "DC", semester: 4 },
      { code: "ME210P", name: "Fluid Mechanics Lab",       credits: 1, category: "DC", semester: 4 },
      { code: "ME303",  name: "Heat Transfer",             credits: 3, category: "DC", semester: 4 },
      { code: "ME307",  name: "Energy Conversion Devices", credits: 3, category: "DC", semester: 4 },
      { code: "ME309",  name: "Theory of Machines",        credits: 4, category: "DC", semester: 4 },
    ],
    [
      { code: "ME303P", name: "Heat Transfer Lab",          credits: 1, category: "DC", semester: 5 },
      { code: "ME305",  name: "Design of Machine Elements", credits: 4, category: "DC", semester: 5 },
      { code: "ME311P", name: "Design Lab 1",               credits: 1, category: "DC", semester: 5 },
      { code: "ME315",  name: "Manufacturing Engineering 2", credits: 3, category: "DC", semester: 5 },
    ],
    [
      { code: "ME312P", name: "Design Lab 2", credits: 1, category: "DC", semester: 6 },
      ...istpSem6,
    ],
    [...mtpSem7],
    [
      { code: "ME010", name: "Internship", credits: 2, category: "IC", semester: 8 },
      ...mtpSem8,
    ],
  ],

  CE: [
    [...icCompSem1, ...icMixedSem1, ...allICB1],
    [...icCompSem2, ...icMixedSem2, ...allICB2],
    [...icSem3,
      { code: "CE202",  name: "Introduction to Civil Engineering Profession",  credits: 1, category: "DC", semester: 3 },
      { code: "CE203",  name: "Construction Materials",                        credits: 3, category: "DC", semester: 3 },
      { code: "CE252",  name: "Geology and Geomorphology",                     credits: 3, category: "DC", semester: 3 },
      { code: "CE301",  name: "Strength of Materials and Structures",          credits: 3, category: "DC", semester: 3 },
      { code: "CE301P", name: "Strength of Materials and Structures Lab",      credits: 1, category: "DC", semester: 3 },
      { code: "CE354P", name: "Construction Materials Lab",                    credits: 1, category: "DC", semester: 3 },
    ],
    [
      { code: "CE201",  name: "Surveying Traditional and Digital",  credits: 4, category: "DC", semester: 4 },
      { code: "CE251",  name: "Hydraulics Engineering",             credits: 3, category: "DC", semester: 4 },
      { code: "CE302",  name: "Geotechnical Engineering I",         credits: 3, category: "DC", semester: 4 },
      { code: "CE302P", name: "Geotechnical Engineering Lab",       credits: 1, category: "DC", semester: 4 },
      { code: "CE304P", name: "Hydraulics Engineering Lab",         credits: 1, category: "DC", semester: 4 },
      { code: "CE404",  name: "Analysis of Structures",             credits: 3, category: "DC", semester: 4 },
    ],
    [
      { code: "CE303",  name: "Water Resources Engineering",              credits: 3, category: "DC", semester: 5 },
      { code: "CE351",  name: "Design of Reinforced Concrete Structures", credits: 3, category: "DC", semester: 5 },
      { code: "CE352",  name: "Transportation Engineering",               credits: 3, category: "DC", semester: 5 },
      { code: "CE352P", name: "Transportation Engineering Lab",           credits: 1, category: "DC", semester: 5 },
      { code: "CE353P", name: "Civil Engineering Drawing",                credits: 1, category: "DC", semester: 5 },
      { code: "CE402",  name: "Geotechnical Engineering II",              credits: 3, category: "DC", semester: 5 },
    ],
    [
      { code: "CE305P", name: "Environmental Engineering Lab",    credits: 1, category: "DC", semester: 6 },
      { code: "CE401",  name: "Design of Steel Structures",       credits: 3, category: "DC", semester: 6 },
      { code: "CE403",  name: "Water and Wastewater Engineering", credits: 3, category: "DC", semester: 6 },
      { code: "CEXXX",  name: "Reverse Engineering",              credits: 1, category: "DC", semester: 6 },
      ...istpSem6,
    ],
    [...mtpSem7],
    [
      { code: "CE010", name: "Internship", credits: 2, category: "IC", semester: 8 },
      ...mtpSem8,
    ],
  ],

  BE: [
    [...icCompSem1, ...icMixedSem1, ...allICB1],
    [...icCompSem2, ...icMixedSem2, ...allICB2],
    [...icSem3WithoutIC202P,
      { code: "BE201", name: "Cell Biology",                       credits: 4, category: "DC", semester: 3 },
      { code: "BE202", name: "Biochemistry and Molecular Biology", credits: 4, category: "DC", semester: 3 },
      { code: "BE308", name: "Introduction to Biomanufacturing",   credits: 4, category: "DC", semester: 3 },
      { code: "BE309", name: "Biosensing and Bioinstrumentation",  credits: 4, category: "DC", semester: 3 },
    ],
    [...ic202pSem4,
      { code: "BE203", name: "Enzymology and Bioprocessing", credits: 4, category: "DC", semester: 4 },
      { code: "BE301", name: "Biomechanics",                 credits: 4, category: "DC", semester: 4 },
      { code: "BE304", name: "Bioinformatics",               credits: 4, category: "DC", semester: 4 },
    ],
    [
      { code: "BE303", name: "Applied Biostatistics",              credits: 4, category: "DC", semester: 5 },
      { code: "BE305", name: "Bioethics and Regulatory Affairs",   credits: 1, category: "DC", semester: 5 },
      { code: "BE306", name: "Fundamentals of Genetic Engineering", credits: 4, category: "DC", semester: 5 },
      { code: "BE310", name: "Biomaterials",                        credits: 4, category: "DC", semester: 5 },
      { code: "BEXXX", name: "Reverse Engineering",                 credits: 1, category: "DC", semester: 5 },
    ],
    [...istpSem6],
    [...mtpSem7],
    [
      { code: "BE010", name: "Internship", credits: 2, category: "IC", semester: 8 },
      ...mtpSem8,
    ],
  ],

  EP: [
    [...icCompSem1, ...icMixedSem1, ...allICB1],
    [...icCompSem2, ...icMixedSem2, ...allICB2],
    [...icSem3WithoutIC202P,
      { code: "EP301",  name: "Engineering Mathematics 2",          credits: 4, category: "DC", semester: 3 },
      { code: "EP321",  name: "Foundations of Electrodynamics",     credits: 3, category: "DC", semester: 3 },
      { code: "PH301",  name: "Quantum Mechanics and Applications", credits: 3, category: "DC", semester: 3 },
    ],
    [...ic202pSem4,
      { code: "EP403",  name: "Physics of Atoms and Molecules",        credits: 3, category: "DC", semester: 4 },
      { code: "EE223P", name: "Reverse Engineering",                   credits: 1, category: "DC", semester: 4 },
      { code: "PH302",  name: "Introduction to Statistical Mechanics", credits: 3, category: "DC", semester: 4 },
      { code: "PH501",  name: "Solid State Physics",                   credits: 3, category: "DC", semester: 4 },
    ],
    [
      { code: "EE311",  name: "Device Electronics for Integrated Circuits", credits: 3, category: "DC", semester: 5 },
      { code: "EP302",  name: "Computational Methods for Engineering",       credits: 3, category: "DC", semester: 5 },
      { code: "EP402P", name: "Engineering Physics Practicum",               credits: 4, category: "DC", semester: 5 },
    ],
    [
      { code: "EP401P", name: "Engineering of Instrumentation", credits: 4, category: "DC", semester: 6 },
      { code: "PH502",  name: "Photonics",                      credits: 3, category: "DC", semester: 6 },
      ...istpSem6,
    ],
    [...mtpSem7],
    [
      { code: "EP010", name: "Internship", credits: 2, category: "IC", semester: 8 },
      ...mtpSem8,
    ],
  ],

  MNC: [
    [...icCompSem1, ...icMixedSem1, ...allICB1],
    [...icCompSem2, ...icMixedSem2, ...allICB2],
    [...icSem3,
      { code: "CS208", name: "Mathematical Foundations of Computer Science", credits: 4, category: "DC", semester: 3 },
      { code: "CS214", name: "Computer Organisation",                        credits: 4, category: "DC", semester: 3 },
      { code: "MA210", name: "Real and Complex Analysis",                    credits: 3, category: "DC", semester: 3 },
      { code: "MA211", name: "Ordinary Differential Equations",              credits: 4, category: "DC", semester: 3 },
      { code: "MA312", name: "Design of Algorithms",                         credits: 4, category: "DC", semester: 3 },
    ],
    [
      { code: "CS304", name: "Formal Language and Automata Theory", credits: 3, category: "DC", semester: 4 },
      { code: "MA220", name: "Partial Differential Equations",      credits: 4, category: "DC", semester: 4 },
      { code: "MA221", name: "Numerical Analysis",                  credits: 4, category: "DC", semester: 4 },
      { code: "MA222", name: "Applied Linear Programming",          credits: 4, category: "DC", semester: 4 },
    ],
    [
      { code: "MA312", name: "Design of Algorithms",         credits: 4, category: "DC", semester: 5 },
      { code: "MA310", name: "Matrix Computation and Lab",   credits: 4, category: "DC", semester: 5 },
      { code: "MA311", name: "Mathematical Modelling",       credits: 3, category: "DC", semester: 5 },
      { code: "MA322", name: "Applied Graph Theory",         credits: 4, category: "DC", semester: 5 },
    ],
    [
      { code: "MA321",  name: "Numerics of Differential Equation", credits: 4, category: "DC", semester: 6 },
      { code: "MA323P", name: "Applied Databases Practicum",       credits: 2, category: "DC", semester: 6 },
      ...istpSem6,
    ],
    [...mtpSem7],
    [
      { code: "MC010", name: "Internship", credits: 2, category: "IC", semester: 8 },
      ...mtpSem8,
    ],
  ],

  MSE: [
    [...icCompSem1, ...icMixedSem1, ...allICB1],
    [...icCompSem2, ...icMixedSem2, ICB2_IC121, ICB2_IC241, ICB2_IC253],
    [...icSem3,
      { code: "MT201", name: "Physics of Solids",                        credits: 3, category: "DC", semester: 3 },
      { code: "MT202", name: "Quantum Mechanics and Applications",       credits: 3, category: "DC", semester: 3 },
      { code: "MT203", name: "Material Synthesis and Characterisation",  credits: 4, category: "DC", semester: 3 },
      { code: "ME206", name: "Mechanics of Solids",                      credits: 3, category: "DC", semester: 3 },
      { code: "ME212", name: "Product Realization Technology",           credits: 3, category: "DC", semester: 3 },
    ],
    [
      { code: "IC240", name: "Mechanics of Rigid Bodies",                 credits: 3, category: "DC", semester: 4 },
      { code: "ME100", name: "Reverse Engineering",                       credits: 1, category: "DC", semester: 4 },
      { code: "MT204", name: "Thermodynamics and Kinetics of Materials",  credits: 3, category: "DC", semester: 4 },
      { code: "MT205", name: "Functional Properties of Materials",        credits: 4, category: "DC", semester: 4 },
      { code: "MT206", name: "Extraction and Materials Processing",       credits: 4, category: "DC", semester: 4 },
    ],
    [
      { code: "ME212", name: "Product Realization Technology",               credits: 3, category: "DC", semester: 5 },
      { code: "MT301", name: "Phase Transformations",                        credits: 3, category: "DC", semester: 5 },
      { code: "MT302", name: "Transport Phenomena",                          credits: 3, category: "DC", semester: 5 },
      { code: "MT303", name: "Computational Materials Science",              credits: 4, category: "DC", semester: 5 },
      { code: "MT304", name: "Mechanical Behaviour of Materials",            credits: 4, category: "DC", semester: 5 },
    ],
    [...istpSem6],
    [...mtpSem7],
    [
      { code: "MS010", name: "Internship", credits: 2, category: "IC", semester: 8 },
      ...mtpSem8,
    ],
  ],

  "GE-ROBO": [
    [...icCompSem1, ...icMixedSem1, ...allICB1],
    [...icCompSem2, ...icMixedSem2, ICB2_IC121, ICB2_IC240],
    [...icSem3,
      { code: "EE261", name: "Electrical System Around Us",     credits: 3, category: "DC", semester: 3 },
      { code: "ME206", name: "Mechanics of Solids",             credits: 3, category: "DC", semester: 3 },
      { code: "DS201", name: "Data Handling and Visualisation", credits: 3, category: "DC", semester: 3 },
    ],
    [
      { code: "IC253", name: "Programming and Data Structures", credits: 3, category: "DC", semester: 4 },
      { code: "EE201", name: "Electromechanics",                credits: 3, category: "DC", semester: 4 },
      { code: "ME100", name: "Reverse Engineering",             credits: 1, category: "DC", semester: 4 },
    ],
    [
      { code: "ME309", name: "Theory of Machines",                      credits: 4, category: "DC", semester: 5 },
      { code: "ME305", name: "Design of Machine Elements",              credits: 4, category: "DC", semester: 5 },
      { code: "AR523", name: "Robot Manipulators",                      credits: 3, category: "DC", semester: 5 },
      { code: "AR521", name: "Control of Robotic Systems",              credits: 3, category: "DC", semester: 5 },
      { code: "AR520", name: "Design Practicum of Mechatronic Systems", credits: 3, category: "DC", semester: 5 },
      { code: "EE301", name: "Control Systems",                         credits: 3, category: "DC", semester: 5 },
    ],
    [...istpSem6],
    [...mtpSem7],
    [
      { code: "IC010", name: "Internship", credits: 2, category: "IC", semester: 8 },
      ...mtpSem8,
    ],
  ],

  "GE-COMM": [
    [...icCompSem1, ...icMixedSem1, ...allICB1],
    [...icCompSem2, ...icMixedSem2, ICB2_IC121, ICB2_IC240, ICB2_IC241],
    [...icSem3,
      { code: "EE261", name: "Electrical System Around Us", credits: 3, category: "DC", semester: 3 },
      { code: "EE203", name: "Network Theory",              credits: 3, category: "DC", semester: 3 },
      { code: "EE260", name: "Signals and Systems",         credits: 3, category: "DC", semester: 3 },
      { code: "CS313", name: "Computer Networks",           credits: 4, category: "DC", semester: 3 },
    ],
    [
      { code: "EE201", name: "Electromechanics",                 credits: 3, category: "DC", semester: 4 },
      { code: "EE316", name: "Communication Systems",            credits: 3, category: "DC", semester: 4 },
      { code: "ME100", name: "Reverse Engineering",              credits: 1, category: "DC", semester: 4 },
      { code: "IC253", name: "Programming and Data Structures",  credits: 3, category: "DC", semester: 4 },
      { code: "DS404", name: "Information Security and Privacy", credits: 3, category: "DC", semester: 4 },
      { code: "EE202", name: "Electromagnetic Theory",           credits: 3, category: "DC", semester: 4 },
    ],
    [
      { code: "EE231", name: "Measurement and Instrumentation", credits: 3, category: "DC", semester: 5 },
      { code: "EE314", name: "Digital Signal Processing",       credits: 4, category: "DC", semester: 5 },
    ],
    [...istpSem6],
    [...mtpSem7],
    [
      { code: "IC010", name: "Internship", credits: 2, category: "IC", semester: 8 },
      ...mtpSem8,
    ],
  ],

  "GE-MECH": [
    [...icCompSem1, ...icMixedSem1, ...allICB1],
    [...icCompSem2, ...icMixedSem2, ...allICB2],
    [...icSem3,
      { code: "EE261", name: "Electrical System Around Us", credits: 3, category: "DC", semester: 3 },
      { code: "ME206", name: "Mechanics of Solids",         credits: 3, category: "DC", semester: 3 },
      { code: "EE203", name: "Network Theory",              credits: 3, category: "DC", semester: 3 },
      { code: "EE260", name: "Signals and Systems",         credits: 3, category: "DC", semester: 3 },
    ],
    [
      { code: "EE201", name: "Electromechanics",      credits: 3, category: "DC", semester: 4 },
      { code: "EE211", name: "Analog Circuit Design", credits: 3, category: "DC", semester: 4 },
      { code: "ME100", name: "Reverse Engineering",   credits: 1, category: "DC", semester: 4 },
    ],
    [
      { code: "AR520", name: "Design Practicum of Mechatronic Systems", credits: 3, category: "DC", semester: 5 },
      { code: "ME305", name: "Design of Machine Elements",              credits: 4, category: "DC", semester: 5 },
      { code: "ME309", name: "Theory of Machines",                      credits: 4, category: "DC", semester: 5 },
      { code: "EE301", name: "Control Systems",                         credits: 3, category: "DC", semester: 5 },
      { code: "EE231", name: "Measurement and Instrumentation",         credits: 3, category: "DC", semester: 5 },
    ],
    [...istpSem6],
    [...mtpSem7],
    [
      { code: "IC010", name: "Internship", credits: 2, category: "IC", semester: 8 },
      ...mtpSem8,
    ],
  ],

  MEVLSI: [
    [...icCompSem1, ...icMixedSem1, ...allICB1],
    [...icCompSem2, ...icMixedSem2, ...allICB2],
    [...icSem3,
      { code: "EE203",  name: "Network Theory",                        credits: 3, category: "DC", semester: 3 },
      { code: "EE210",  name: "Digital System Design and Practicum",   credits: 4, category: "DC", semester: 3 },
      { code: "EE260",  name: "Signals and Systems",                   credits: 3, category: "DC", semester: 3 },
      { code: "EE301",  name: "Control Systems",                       credits: 4, category: "DC", semester: 3 },
      { code: "EE311",  name: "Device Electronics",                    credits: 3, category: "DC", semester: 3 },
    ],
    [
      { code: "EE202",   name: "Electromagnetic Theory and Transmission Lines", credits: 3, category: "DC", semester: 4 },
      { code: "EE211",   name: "Analog Circuit Design",                         credits: 4, category: "DC", semester: 4 },
      { code: "VL-326",  name: "Computer Organization",                         credits: 4, category: "DC", semester: 4 },
      { code: "VL-311",  name: "CMOS Processing and Practicum",                 credits: 4, category: "DC", semester: 4 },
      { code: "VL-312",  name: "Electronic System Packaging",                   credits: 3, category: "DC", semester: 4 },
      { code: "VL-300",  name: "Reverse Engineering -- E-waste management",     credits: 1, category: "DC", semester: 4 },
    ],
    [
      { code: "VL-401", name: "RTL Design and Verification", credits: 3, category: "DC", semester: 5 },
      { code: "VL-402", name: "RF IC Design",                credits: 3, category: "DC", semester: 5 },
      { code: "VL-403", name: "CMOS Digital IC Design",      credits: 4, category: "DC", semester: 5 },
      { code: "VL-404", name: "CMOS Analog IC Design",       credits: 4, category: "DC", semester: 5 },
      { code: "VL-405", name: "Design for Testability",      credits: 4, category: "DC", semester: 5 },
    ],
    [...istpSem6],
    [...mtpSem7],
    [
      { code: "VL010", name: "Internship", credits: 2, category: "IC", semester: 8 },
      ...mtpSem8,
    ],
  ],

  BSCS: [
    [...icCompSem1, ...icMixedSem1, ICB1_IC131],
    [...icCompSem2, ...icMixedSem2, ICB2_IC121],
    [
      { code: "IC136",  name: "Understanding Biotechnology and its Applications",   credits: 3, category: "DC", semester: 3 },
      { code: "CY301",  name: "Principles and Theories of Physical Chemistry",      credits: 3, category: "DC", semester: 3 },
      { code: "CY302",  name: "Principles of Organic Chemistry",                    credits: 3, category: "DC", semester: 3 },
      { code: "CY303",  name: "Fundamentals of Inorganic Chemistry",               credits: 3, category: "DC", semester: 3 },
      { code: "CY201P", name: "Physical Chemistry Laboratory",                      credits: 2, category: "DC", semester: 3 },
    ],
    [
      { code: "IC202P", name: "Design Practicum",                                               credits: 3, category: "FE", semester: 4 },
      { code: "CY304",  name: "Fundamental Analytical Chemistry",                               credits: 3, category: "DC", semester: 4 },
      { code: "CY202P", name: "Organic Chemistry Laboratory",                                   credits: 2, category: "DC", semester: 4 },
      { code: "CY203P", name: "Inorganic Chemistry Laboratory",                                 credits: 2, category: "DC", semester: 4 },
      { code: "CY401",  name: "Introduction to Quantum Chemistry and Molecular Spectroscopy",   credits: 3, category: "DC", semester: 4 },
    ],
    [
      { code: "CY512",  name: "Advanced Quantum Chemistry",         credits: 3, category: "DC", semester: 5 },
      { code: "CY512P", name: "Physical Chemistry Laboratory",      credits: 3, category: "DC", semester: 5 },
      { code: "CY531",  name: "Organic Reactions and Mechanisms",   credits: 3, category: "DC", semester: 5 },
      { code: "CY533P", name: "Inorganic Chemistry Laboratory",     credits: 3, category: "DC", semester: 5 },
    ],
    [
      { code: "CY511",  name: "Group Theory and Spectroscopy",           credits: 3, category: "DC", semester: 6 },
      { code: "CY531P", name: "Organic Chemistry Laboratory",            credits: 3, category: "DC", semester: 6 },
      { code: "CY532",  name: "Photochemistry and Pericyclic Reactions", credits: 3, category: "DC", semester: 6 },
      { code: "CY533",  name: "Chemistry of Main Group Elements",        credits: 3, category: "DC", semester: 6 },
      { code: "CY534",  name: "Chemistry of Transition Elements",        credits: 3, category: "DC", semester: 6 },
    ],
    [
      { code: "CY514", name: "Chemical and Statistical Thermodynamics",  credits: 3, category: "DC", semester: 7 },
      { code: "CY535", name: "Introduction to Organometallic Chemistry", credits: 3, category: "DC", semester: 7 },
      ...mtpSem7,
    ],
    [
      { code: "CY513", name: "Chemical Kinetics and Reaction Dynamics", credits: 3, category: "DC", semester: 8 },
      { code: "CY504", name: "Heterocyclic Chemistry",                  credits: 2, category: "DC", semester: 8 },
      ...mtpSem8,
    ],
  ],
};

// ─── Batch overrides ─────────────────────────────────────────────────────────

function norm(code) {
  return (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function addIfMissing(courses, course) {
  if (courses.some(c => norm(c.code) === norm(course.code))) return courses;
  return [...courses, course];
}

function applyBatchOverrides(branch, semIdx, courses, batch) {
  const sem = semIdx + 1; // 1-indexed semester

  // ── B24 overrides ───────────────────────────────────────────────────────────
  if (batch === 2024) {

    // Branches with standard B24 IC202P/IC222P shuffle
    const b24Standard = new Set(["CSE","DSE","EE","MEVLSI","MSE","CE"]);

    if (b24Standard.has(branch)) {
      if (sem === 1) {
        let upd = courses.filter(c => norm(c.code) !== "IC102P");
        if (branch === "CE") {
          upd = upd.filter(c => !["IC140","IC131","IC136"].includes(norm(c.code)));
        }
        return upd;
      }
      if (sem === 2) {
        if (branch === "CE") {
          let f = courses.filter(c => !["IC222P","IC102P","IC181","IC121","IC241","IC253"].includes(norm(c.code)));
          f = addIfMissing(f, { code: "IC182", name: "Indian Knowledge Systems (Alt)", credits: 3, category: "IKS", semester: 2 });
          return addIfMissing(f, { code: "CE202", name: "Introduction to Civil Engineering", credits: 1, category: "DC", semester: 2 });
        }
        const f = courses.filter(c => !["IC181","IC222P"].includes(norm(c.code)));
        return addIfMissing(f, { code: "IC182", name: "Indian Knowledge Systems (Alt)", credits: 3, category: "IKS", semester: 2 });
      }
      if (sem === 3) {
        if (branch === "CE") {
          let upd = courses.filter(c => !["CE202","CE301","CE301P","CE354P","IC202P"].includes(norm(c.code)));
          upd = upd.map(c => norm(c.code) === "CE203" ? { ...c, name: "Civil Engineering Materials" } : c);
          upd = addIfMissing(upd, { code: "CE310",  name: "Strength of Materials and Structures",     credits: 3, category: "DC", semester: 3 });
          upd = addIfMissing(upd, { code: "CE310P", name: "Strength of Materials and Structures Lab", credits: 1, category: "DC", semester: 3 });
          upd = addIfMissing(upd, { code: "CE203P", name: "Building Materials Lab",                   credits: 1, category: "DC", semester: 3 });
          return upd;
        }
        let upd = courses;
        if (branch === "EE") {
          upd = upd.filter(c => !["EE210","EE210P"].includes(norm(c.code)));
          upd = upd.map(c => norm(c.code) === "EE261" ? { ...c, credits: 3 } : c);
          upd = addIfMissing(upd, { code: "EE-212",  name: "Digital System Design",             credits: 4, category: "DC", semester: 3 });
          upd = addIfMissing(upd, { code: "EE261P",  name: "Electrical Systems Around Us Lab",  credits: 2, category: "DC", semester: 3 });
        }
        if (branch === "MEVLSI") {
          upd = upd.filter(c => !["EE210","EE301"].includes(norm(c.code)));
          upd = addIfMissing(upd, { code: "EE-212", name: "Digital System Design", credits: 4, category: "DC", semester: 3 });
          upd = addIfMissing(upd, { code: "EE-302", name: "Control Systems",       credits: 4, category: "DC", semester: 3 });
        }
        const hasIC202P = upd.some(c => norm(c.code) === "IC202P");
        return hasIC202P ? upd : [{ code: "IC202P", name: "Design Practicum", credits: 3, category: "IC", semester: 3 }, ...upd];
      }
      if (sem === 4) {
        let upd = courses;
        if (branch === "DSE" || branch === "EE") upd = upd.filter(c => norm(c.code) !== "IC202P");
        if (branch === "DSE") upd = upd.filter(c => norm(c.code) !== "DS404");
        if (branch === "EE") {
          upd = upd.map(c => {
            const code = norm(c.code);
            if (code === "EE202") return { ...c, code: "EE205", name: "Electromagnetics and Wave Propagation" };
            if (code === "EE304") return { ...c, code: "EE316" };
            return c;
          });
        }
        if (branch === "CE") {
          upd = upd.filter(c => !["CE302","CE302P"].includes(norm(c.code)));
          upd = addIfMissing(upd, { code: "CE311",  name: "Geotechnical Engineering I",         credits: 3, category: "DC", semester: 4 });
          upd = addIfMissing(upd, { code: "CE311P", name: "Geotechnical Engineering Laboratory", credits: 1, category: "DC", semester: 4 });
        }
        return addIfMissing(upd, { code: "IC222P", name: "Physics Practicum", credits: 2, category: "IC", semester: 4 });
      }
      if (sem === 5) {
        if (branch === "DSE") return addIfMissing(courses, { code: "DS404", name: "Information Security and Privacy", credits: 3, category: "DC", semester: 5 });
        if (branch === "EE") {
          const upd = courses.filter(c => norm(c.code) !== "EE301");
          return addIfMissing(upd, { code: "EE-302", name: "Control Systems", credits: 4, category: "DC", semester: 5 });
        }
        return courses;
      }
      return courses;
    }

    if (branch === "EP") {
      if (sem === 1) return courses.filter(c => !["IC102P","IC140","IC131","IC136"].includes(norm(c.code)));
      if (sem === 2) {
        const upd = courses.filter(c => !["IC102P","IC222P","IC181","IC240","IC241","IC253"].includes(norm(c.code)));
        return addIfMissing(upd, { code: "IC182", name: "Indian Knowledge Systems (Alt)", credits: 3, category: "IKS", semester: 2 });
      }
      if (sem === 4) {
        const upd = courses
          .filter(c => norm(c.code) !== "IC202P")
          .map(c => norm(c.code) === "EPXXX" ? { ...c, code: "EP201" } : c);
        return addIfMissing(upd, { code: "IC222P", name: "Physics Practicum", credits: 2, category: "IC", semester: 4 });
      }
      return courses;
    }

    if (branch === "MNC") {
      if (sem === 1) return courses.filter(c => !["IC102P","IC140","IC131","IC230"].includes(norm(c.code)));
      if (sem === 2) {
        let upd = courses.filter(c => !["IC102P","IC222P","IC181","IC121","IC240","IC241"].includes(norm(c.code)));
        return addIfMissing(upd, { code: "MA120", name: "Introduction to Computing Systems and Databases", credits: 4, category: "DC", semester: 2 });
      }
      if (sem === 3) return courses.filter(c => norm(c.code) !== "CS214");
      if (sem === 4) {
        let upd = courses.filter(c => norm(c.code) !== "CS304");
        upd = addIfMissing(upd, { code: "CS201",  name: "Computer Organization",            credits: 3, category: "DC", semester: 4 });
        upd = addIfMissing(upd, { code: "CS201P", name: "Computer Organization Laboratory", credits: 1, category: "DC", semester: 4 });
        return addIfMissing(upd, { code: "IC222P", name: "Physics Practicum", credits: 2, category: "IC", semester: 4 });
      }
      if (sem === 5) return addIfMissing(courses, { code: "MA313", name: "Formal Language and Automata Theory", credits: 3, category: "DC", semester: 5 });
      return courses;
    }

    if (branch === "ME") {
      if (sem === 1) return courses.filter(c => !["IC102P","IC181"].includes(norm(c.code)));
      if (sem === 2) {
        const upd = courses.filter(c => !["IC222P","IC140","IC181","IC121","IC253"].includes(norm(c.code)));
        return addIfMissing(upd, { code: "IC182", name: "Indian Knowledge Systems (Alt)", credits: 3, category: "IKS", semester: 2 });
      }
      if (sem === 3) {
        let upd = courses.filter(c => !["ME100","ME205","ME308","ME310"].includes(norm(c.code)));
        upd = addIfMissing(upd, { code: "ME206", name: "Mechanics of Solids", credits: 3, category: "DC", semester: 3 });
        upd = addIfMissing(upd, { code: "IC202P", name: "Design Practicum",   credits: 3, category: "IC", semester: 3 });
        return upd;
      }
      if (sem === 4) {
        let upd = courses.filter(c => !["ME206","ME309","IC202P"].includes(norm(c.code)));
        upd = addIfMissing(upd, { code: "ME100", name: "Reverse Engineering",         credits: 1, category: "DC", semester: 4 });
        upd = addIfMissing(upd, { code: "ME205", name: "Machine Drawing",             credits: 3, category: "DC", semester: 4 });
        upd = addIfMissing(upd, { code: "ME215", name: "Manufacturing Engineering 1", credits: 3, category: "DC", semester: 4 });
        return addIfMissing(upd, { code: "IC222P", name: "Physics Practicum", credits: 2, category: "IC", semester: 4 });
      }
      if (sem === 5) {
        const w = addIfMissing(courses, { code: "ME310", name: "System Dynamics and Control", credits: 3, category: "DC", semester: 5 });
        return addIfMissing(w, { code: "ME309", name: "Theory of Machines", credits: 4, category: "DC", semester: 5 });
      }
      return courses;
    }

    if (branch === "BE") {
      if (sem === 1) return courses.filter(c => norm(c.code) !== "IC102P");
      if (sem === 2) {
        const upd = courses.filter(c => !["IC102P","IC222P","IC181"].includes(norm(c.code)));
        return addIfMissing(upd, { code: "IC182", name: "Indian Knowledge Systems (Alt)", credits: 3, category: "IKS", semester: 2 });
      }
      if (sem === 4) {
        const upd = courses.filter(c => norm(c.code) !== "IC202P");
        return addIfMissing(upd, { code: "IC222P", name: "Physics Practicum", credits: 2, category: "IC", semester: 4 });
      }
      return courses;
    }

    // GE sub-branches B24
    const geB24 = new Set(["GE-ROBO","GE-MECH","GE-COMM","GE-FIN","GE-OPEN"]);
    if (geB24.has(branch)) {
      if (sem === 1) return courses.filter(c => !["IC102P","IC181","IC131","IC136"].includes(norm(c.code)));
      if (sem === 2) {
        let upd = courses.filter(c => !["IC222P","IC140","IC181","IC121","IC241","IC253"].includes(norm(c.code)));
        return addIfMissing(upd, { code: "IC182", name: "Indian Knowledge Systems (Alt)", credits: 3, category: "IKS", semester: 2 });
      }
      if (sem === 4 && (branch === "GE-ROBO" || branch === "GE-MECH" || branch === "GE-COMM")) {
        return addIfMissing(courses, { code: "IC222P", name: "Physics Practicum", credits: 2, category: "IC", semester: 4 });
      }
      if (sem === 5) {
        const upd = courses.filter(c => norm(c.code) !== "EE301");
        return addIfMissing(upd, { code: "EE-302", name: "Control Systems", credits: 4, category: "DC", semester: 5 });
      }
      return courses;
    }

    if (branch === "BSCS") {
      if (sem === 1) return courses.filter(c => norm(c.code) !== "IC102P");
      if (sem === 2) {
        const upd = courses.filter(c => !["IC102P","IC181","IC222P"].includes(norm(c.code)));
        return addIfMissing(upd, { code: "CY200", name: "Foundations and Applications of Chemistry", credits: 3, category: "DC", semester: 2 });
      }
      if (sem === 4) {
        const upd = courses.map(c => norm(c.code) === "IC202P" ? { ...c, category: "FE" } : c);
        return addIfMissing(upd, { code: "IC222P", name: "Physics Practicum", credits: 2, category: "IC", semester: 4 });
      }
      return courses;
    }
  }

  // ── B25 overrides ───────────────────────────────────────────────────────────
  if (batch === 2025) {
    if (branch === "DSAI") {
      if (sem === 1) {
        let upd = courses.filter(c => norm(c.code) !== "IC181");
        return addIfMissing(upd, { code: "IC182", name: "History of Science and Technology", credits: 3, category: "IKS", semester: 1 });
      }
      if (sem === 2) {
        let upd = courses.filter(c => !["IC140","IC181","IC182","IC222P"].includes(norm(c.code)));
        return addIfMissing(upd, { code: "IC253", name: "Programming and Data Structures", credits: 3, category: "IC", semester: 2 });
      }
      if (sem === 3) {
        let upd = addIfMissing(courses, { code: "IC202P", name: "Design Practicum",   credits: 3, category: "IC", semester: 3 });
        return addIfMissing(upd,        { code: "IC222P", name: "Physics Practicum",  credits: 2, category: "IC", semester: 3 });
      }
      if (sem === 4) return courses.filter(c => norm(c.code) !== "IC202P");
      return courses;
    }

    // Generic B25: IC114 to Sem1, IC113 to Sem2, IC222P to Sem3
    if (sem === 1) {
      let upd = courses.filter(c => !["IC113","IC140","IC102P","IC181"].includes(norm(c.code)));
      upd = addIfMissing(upd, { code: "IC114", name: "Linear Algebra",                   credits: 2, category: "IC",  semester: 1 });
      upd = addIfMissing(upd, { code: "IC182", name: "History of Science and Technology", credits: 3, category: "IKS", semester: 1 });
      return upd;
    }
    if (sem === 2) {
      let upd = courses.filter(c => !["IC114","IC181","IC182","IC222P"].includes(norm(c.code)));
      upd = addIfMissing(upd, { code: "IC113", name: "Complex Variables and Vector Calculus", credits: 2, category: "IC", semester: 2 });
      if (branch === "CE") upd = addIfMissing(upd, { code: "CE202", name: "Introduction to Civil Engineering", credits: 1, category: "DC", semester: 2 });
      return upd;
    }
    if (sem === 3) {
      let upd = courses;
      if (branch === "EE") {
        upd = upd.filter(c => !["EE210","EE210P"].includes(norm(c.code)));
        upd = upd.map(c => norm(c.code) === "EE261" ? { ...c, credits: 3 } : c);
        upd = addIfMissing(upd, { code: "EE-212",  name: "Digital System Design",            credits: 4, category: "DC", semester: 3 });
        upd = addIfMissing(upd, { code: "EE261P",  name: "Electrical Systems Around Us Lab", credits: 2, category: "DC", semester: 3 });
      }
      if (branch === "MEVLSI") {
        upd = upd.filter(c => !["EE210","EE301"].includes(norm(c.code)));
        upd = addIfMissing(upd, { code: "EE-212", name: "Digital System Design", credits: 4, category: "DC", semester: 3 });
        upd = addIfMissing(upd, { code: "EE-302", name: "Control Systems",       credits: 4, category: "DC", semester: 3 });
      }
      if (branch === "MNC") upd = upd.filter(c => norm(c.code) !== "CS214");
      if (branch === "CE") {
        upd = upd.filter(c => !["CE202","CE301","CE301P","CE354P","IC202P"].includes(norm(c.code)));
        upd = upd.map(c => norm(c.code) === "CE203" ? { ...c, name: "Civil Engineering Materials" } : c);
        upd = addIfMissing(upd, { code: "CE310",  name: "Strength of Materials and Structures",     credits: 3, category: "DC", semester: 3 });
        upd = addIfMissing(upd, { code: "CE310P", name: "Strength of Materials and Structures Lab", credits: 1, category: "DC", semester: 3 });
        upd = addIfMissing(upd, { code: "CE203P", name: "Building Materials Lab",                   credits: 1, category: "DC", semester: 3 });
      }
      if (branch === "ME") {
        upd = upd.filter(c => !["ME100","ME205","ME308","ME310"].includes(norm(c.code)));
        upd = addIfMissing(upd, { code: "ME206", name: "Mechanics of Solids", credits: 3, category: "DC", semester: 3 });
      }
      if (branch === "DSE" || branch === "EE" || branch === "ME") {
        upd = addIfMissing(upd, { code: "IC202P", name: "Design Practicum", credits: 3, category: "IC", semester: 3 });
      }
      // IC222P moves to Sem 3 for all B25
      upd = addIfMissing(upd, { code: "IC222P", name: "Physics Practicum", credits: 2, category: "IC", semester: 3 });
      return upd;
    }
    if (sem === 4) {
      let upd = courses;
      if (["DSE","EE","ME"].includes(branch)) upd = upd.filter(c => norm(c.code) !== "IC202P");
      if (branch === "DSE") upd = upd.filter(c => norm(c.code) !== "DS404");
      if (branch === "EE") {
        upd = upd.map(c => {
          const code = norm(c.code);
          if (code === "EE202") return { ...c, code: "EE205", name: "Electromagnetics and Wave Propagation" };
          if (code === "EE304") return { ...c, code: "EE316" };
          return c;
        });
      }
      if (branch === "EP") {
        upd = upd.map(c => norm(c.code) === "EPXXX" ? { ...c, code: "EP201" } : c);
        upd = upd.filter(c => norm(c.code) !== "IC202P");
      }
      if (branch === "CE") {
        upd = upd.filter(c => !["CE302","CE302P"].includes(norm(c.code)));
        upd = addIfMissing(upd, { code: "CE311",  name: "Geotechnical Engineering I",         credits: 3, category: "DC", semester: 4 });
        upd = addIfMissing(upd, { code: "CE311P", name: "Geotechnical Engineering Laboratory", credits: 1, category: "DC", semester: 4 });
      }
      if (branch === "MNC") {
        upd = upd.filter(c => norm(c.code) !== "CS304");
        upd = addIfMissing(upd, { code: "CS201",  name: "Computer Organization",            credits: 3, category: "DC", semester: 4 });
        upd = addIfMissing(upd, { code: "CS201P", name: "Computer Organization Laboratory", credits: 1, category: "DC", semester: 4 });
      }
      if (branch === "ME") {
        upd = upd.filter(c => !["ME206","ME309"].includes(norm(c.code)));
        upd = addIfMissing(upd, { code: "ME100", name: "Reverse Engineering",         credits: 1, category: "DC", semester: 4 });
        upd = addIfMissing(upd, { code: "ME205", name: "Machine Drawing",             credits: 3, category: "DC", semester: 4 });
        upd = addIfMissing(upd, { code: "ME215", name: "Manufacturing Engineering 1", credits: 3, category: "DC", semester: 4 });
      }
      if (["BE","EP","BSCS"].includes(branch)) upd = upd.filter(c => norm(c.code) !== "IC202P");
      return upd;
    }
    if (sem === 5) {
      if (branch === "ME") {
        const w = addIfMissing(courses, { code: "ME310", name: "System Dynamics and Control", credits: 3, category: "DC", semester: 5 });
        return addIfMissing(w, { code: "ME309", name: "Theory of Machines", credits: 4, category: "DC", semester: 5 });
      }
      if (branch === "MNC") return addIfMissing(courses, { code: "MA313", name: "Formal Language and Automata Theory", credits: 3, category: "DC", semester: 5 });
      if (branch === "DSE") return addIfMissing(courses, { code: "DS404", name: "Information Security and Privacy", credits: 3, category: "DC", semester: 5 });
      if (branch === "EE" || branch.startsWith("GE-")) {
        const upd = courses.filter(c => norm(c.code) !== "EE301");
        return addIfMissing(upd, { code: "EE-302", name: "Control Systems", credits: 4, category: "DC", semester: 5 });
      }
      return courses;
    }
    return courses;
  }

  return courses;
}

function getCurriculum(branch, numSems, batch) {
  const base = BASE_CURRICULUM[branch];
  if (!base) return [];
  const result = [];
  for (let i = 0; i < numSems; i++) {
    const baseSem = base[i] || [];
    const sem = i + 1;
    const overridden = applyBatchOverrides(branch, i, baseSem.map(c => ({...c})), batch);
    result.push(...overridden.map(c => ({ ...c, semester: sem })));
  }
  return result;
}

// ─── Credit structures ───────────────────────────────────────────────────────

const CREDIT_STRUCTURES = {
  B23: {
    CSE:      { ic: 60, dc: 38, de: 28, fe: 22, mtp: 12, total: 160 },
    DSE:      { ic: 60, dc: 33, de: 33, fe: 22, mtp: 12, total: 160 },
    DSAI:     { ic: 60, dc: 33, de: 33, fe: 22, mtp: 12, total: 160 },
    EE:       { ic: 60, dc: 52, de: 20, fe: 17, mtp: 12, total: 161 },
    ME:       { ic: 60, dc: 50, de: 16, fe: 22, mtp: 12, total: 160 },
    CE:       { ic: 60, dc: 49, de: 17, fe: 22, mtp: 12, total: 160 },
    BE:       { ic: 60, dc: 42, de: 24, fe: 22, mtp: 12, total: 160 },
    EP:       { ic: 60, dc: 37, de: 29, fe: 22, mtp: 12, total: 160 },
    MNC:      { ic: 60, dc: 51, de: 15, fe: 22, mtp: 12, total: 160 },
    MSE:      { ic: 60, dc: 45, de: 21, fe: 22, mtp: 12, total: 160 },
    "GE-ROBO":{ ic: 60, dc: 36, de: 30, fe: 22, mtp: 12, total: 160 },
    "GE-COMM":{ ic: 60, dc: 36, de: 30, fe: 22, mtp: 12, total: 160 },
    "GE-MECH":{ ic: 60, dc: 36, de: 30, fe: 22, mtp: 12, total: 160 },
    MEVLSI:   { ic: 60, dc: 54, de: 12, fe: 22, mtp: 12, total: 160 },
    BSCS:     { ic: 49, dc: 62, de: 23, fe: 15, mtp: 14, total: 163 },
  },
  B24: {
    CSE:      { ic: 60, dc: 38, de: 28, fe: 22, mtp: 12, total: 160 },
    DSE:      { ic: 60, dc: 33, de: 33, fe: 22, mtp: 12, total: 160 },
    DSAI:     { ic: 60, dc: 33, de: 33, fe: 22, mtp: 12, total: 160 },
    EE:       { ic: 60, dc: 52, de: 20, fe: 17, mtp: 12, total: 161 },
    ME:       { ic: 60, dc: 50, de: 16, fe: 22, mtp: 12, total: 160 },
    CE:       { ic: 53, dc: 49, de: 21, fe: 25, mtp: 12, total: 160 },
    BE:       { ic: 53, dc: 42, de: 28, fe: 25, mtp: 12, total: 160 },
    EP:       { ic: 53, dc: 37, de: 33, fe: 25, mtp: 12, total: 160 },
    MNC:      { ic: 56, dc: 55, de: 15, fe: 22, mtp: 12, total: 160 },
    MSE:      { ic: 60, dc: 45, de: 21, fe: 22, mtp: 12, total: 160 },
    "GE-ROBO":{ ic: 60, dc: 36, de: 30, fe: 22, mtp: 12, total: 160 },
    "GE-COMM":{ ic: 60, dc: 36, de: 30, fe: 22, mtp: 12, total: 160 },
    "GE-MECH":{ ic: 60, dc: 36, de: 30, fe: 22, mtp: 12, total: 160 },
    MEVLSI:   { ic: 60, dc: 54, de: 12, fe: 22, mtp: 12, total: 160 },
    BSCS:     { ic: 45, dc: 65, de: 24, fe: 15, mtp: 14, total: 163 },
  },
  B25: {
    CSE:      { ic: 60, dc: 38, de: 28, fe: 22, mtp: 12, total: 160 },
    DSE:      { ic: 60, dc: 33, de: 33, fe: 22, mtp: 12, total: 160 },
    DSAI:     { ic: 60, dc: 31, de: 35, fe: 22, mtp: 12, total: 160 },
    EE:       { ic: 60, dc: 52, de: 20, fe: 17, mtp: 12, total: 161 },
    ME:       { ic: 60, dc: 50, de: 16, fe: 22, mtp: 12, total: 160 },
    CE:       { ic: 57, dc: 49, de: 17, fe: 25, mtp: 12, total: 160 },
    BE:       { ic: 57, dc: 42, de: 24, fe: 25, mtp: 12, total: 160 },
    EP:       { ic: 57, dc: 37, de: 29, fe: 25, mtp: 12, total: 160 },
    MNC:      { ic: 56, dc: 55, de: 15, fe: 22, mtp: 12, total: 160 },
    MSE:      { ic: 60, dc: 45, de: 21, fe: 22, mtp: 12, total: 160 },
    "GE-ROBO":{ ic: 60, dc: 36, de: 30, fe: 22, mtp: 12, total: 160 },
    "GE-COMM":{ ic: 60, dc: 36, de: 30, fe: 22, mtp: 12, total: 160 },
    "GE-MECH":{ ic: 60, dc: 36, de: 30, fe: 22, mtp: 12, total: 160 },
    MEVLSI:   { ic: 60, dc: 54, de: 12, fe: 22, mtp: 12, total: 160 },
    BSCS:     { ic: 45, dc: 65, de: 24, fe: 15, mtp: 14, total: 163 },
  },
};

// ─── Branch metadata ─────────────────────────────────────────────────────────

const BRANCH_META = {
  CSE:      { fullName: "Computer Science and Engineering",   dept: "School of Computing \\& Electrical Engineering" },
  DSE:      { fullName: "Data Science and Engineering",       dept: "School of Computing \\& Electrical Engineering" },
  DSAI:     { fullName: "Data Science and Artificial Intelligence", dept: "School of Computing \\& Electrical Engineering" },
  EE:       { fullName: "Electrical Engineering",             dept: "School of Computing \\& Electrical Engineering" },
  ME:       { fullName: "Mechanical Engineering",             dept: "School of Mechanical and Materials Engineering" },
  CE:       { fullName: "Civil Engineering",                  dept: "School of Environmental and Natural Sciences" },
  BE:       { fullName: "Bioengineering",                     dept: "School of Bioengineering" },
  EP:       { fullName: "Engineering Physics",                dept: "School of Physical Sciences" },
  MNC:      { fullName: "Mathematics and Computing",          dept: "School of Mathematics \\& Statistical Science" },
  MSE:      { fullName: "Materials Science and Engineering",  dept: "School of Mechanical and Materials Engineering" },
  "GE-ROBO":{ fullName: "General Engineering (Robotics \\& AI)", dept: "School of Mechanical and Materials Engineering" },
  "GE-COMM":{ fullName: "General Engineering (Communication Engineering)", dept: "School of Mechanical and Materials Engineering" },
  "GE-MECH":{ fullName: "General Engineering (Mechatronics)",dept: "School of Mechanical and Materials Engineering" },
  MEVLSI:   { fullName: "Microelectronics and VLSI",          dept: "School of Computing \\& Electrical Engineering" },
  BSCS:     { fullName: "Chemical Sciences (B.S.)",           dept: "School of Chemical Sciences" },
};

// ─── LaTeX escaping ──────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/</g, "\\textless{}")
    .replace(/>/g, "\\textgreater{}");
}

// ─── LaTeX generation ────────────────────────────────────────────────────────
function catLabel(cat) {
  const m = { IC: "IC", ICB: "IC-Basket", IKS: "IKS", HSS: "HSS", DC: "DC", DE: "DE", FE: "FE", ISTP: "ISTP", MTP: "MTP" };
  return m[cat] || cat;
}

function generateTeX(branch, batchLabel, batch) {
  const meta = BRANCH_META[branch] || { fullName: branch, dept: "IIT Mandi" };
  const numSems = branch === "BSCS" ? 8 : 8;
  const courses = getCurriculum(branch, numSems, batch);
  const credits = CREDIT_STRUCTURES[batchLabel]?.[branch] || CREDIT_STRUCTURES.B23[branch] || { ic: 60, dc: 0, de: 0, fe: 22, mtp: 12, total: 160 };

  // Group by semester
  const bySem = {};
  for (let s = 1; s <= numSems; s++) bySem[s] = [];
  for (const c of courses) {
    if (bySem[c.semester]) bySem[c.semester].push(c);
    else bySem[8] = [...(bySem[8] || []), c];
  }

  // Build course table rows grouped by category within each semester
  const catOrder = ["IC", "ICB", "IKS", "HSS", "DC", "DE", "FE", "ISTP", "MTP"];
  const catColors = {
    IC: "\\rowcolor[RGB]{235,245,255}",
    ICB: "\\rowcolor[RGB]{235,245,255}",
    IKS: "\\rowcolor[RGB]{235,245,255}",
    HSS: "\\rowcolor[RGB]{235,245,255}",
    DC: "\\rowcolor[RGB]{255,250,235}",
    DE: "\\rowcolor[RGB]{240,255,240}",
    FE: "\\rowcolor[RGB]{255,240,255}",
    ISTP: "\\rowcolor[RGB]{255,235,235}",
    MTP: "\\rowcolor[RGB]{255,235,235}",
  };

  let semTable = "";
  // Semester-wise summary table
  semTable += `\\begin{longtable}{>{\\bfseries}p{1.2cm} p{4.5cm} >{\\ttfamily}p{2.2cm} p{4cm} c}\n`;
  semTable += `\\toprule\n`;
  semTable += `\\textbf{Sem} & \\textbf{Category} & \\textbf{Code} & \\textbf{Course Name} & \\textbf{Cr} \\\\\n`;
  semTable += `\\midrule\n`;
  semTable += `\\endfirsthead\n`;
  semTable += `\\multicolumn{5}{c}{\\small\\textit{(continued from previous page)}}\\\\\n`;
  semTable += `\\toprule\n`;
  semTable += `\\textbf{Sem} & \\textbf{Category} & \\textbf{Code} & \\textbf{Course Name} & \\textbf{Cr} \\\\\n`;
  semTable += `\\midrule\n`;
  semTable += `\\endhead\n`;
  semTable += `\\midrule\n`;
  semTable += `\\multicolumn{5}{r}{\\small\\textit{continued on next page}}\\\\\n`;
  semTable += `\\endfoot\n`;
  semTable += `\\bottomrule\n`;
  semTable += `\\endlastfoot\n`;

  for (let s = 1; s <= numSems; s++) {
    const semCourses = bySem[s] || [];
    if (semCourses.length === 0) continue;
    // Sort by category order
    semCourses.sort((a, b) => (catOrder.indexOf(a.category) - catOrder.indexOf(b.category)));
    // Row color for semester header
    semTable += `\\rowcolor[RGB]{230,230,245}\n`;
    semTable += `\\multicolumn{5}{l}{\\textbf{Semester ${s}}} \\\\\n`;
    for (const c of semCourses) {
      const optMark = c.optional ? "\\textsuperscript{*}" : "";
      semTable += `${catColors[c.category] || ""}\n`;
      semTable += ` & ${catLabel(c.category)} & ${esc(c.code)} & ${esc(c.name)}${optMark} & ${c.credits} \\\\\n`;
    }
    const semTotal = semCourses.filter(c => !c.optional).reduce((acc, c) => acc + c.credits, 0);
    semTable += `\\rowcolor[RGB]{245,245,245}\n`;
    semTable += ` & & & \\textit{Semester ${s} Total} & \\textbf{${semTotal}} \\\\\n`;
    semTable += `\\midrule\n`;
  }
  semTable += `\\end{longtable}\n`;

  // DC courses (separate list)
  const dcCourses = courses.filter(c => c.category === "DC" && !c.optional);
  const dcTotal = dcCourses.reduce((a, c) => a + c.credits, 0);

  let dcTable = "";
  if (dcCourses.length > 0) {
    dcTable += `\\begin{longtable}{>{\\ttfamily}p{2.2cm} p{9cm} c c}\n`;
    dcTable += `\\toprule\n`;
    dcTable += `\\textbf{Code} & \\textbf{Course Name} & \\textbf{Cr} & \\textbf{Sem} \\\\\n`;
    dcTable += `\\midrule\n`;
    dcTable += `\\endfirsthead\n`;
    dcTable += `\\multicolumn{4}{c}{\\small\\textit{(continued)}}\\\\\n`;
    dcTable += `\\toprule \\textbf{Code} & \\textbf{Course Name} & \\textbf{Cr} & \\textbf{Sem} \\\\ \\midrule\n`;
    dcTable += `\\endhead\n`;
    dcTable += `\\bottomrule\n`;
    dcTable += `\\endlastfoot\n`;
    for (const c of dcCourses) {
      dcTable += `${esc(c.code)} & ${esc(c.name)} & ${c.credits} & ${c.semester} \\\\\n`;
    }
    dcTable += `\\midrule\n`;
    dcTable += `\\multicolumn{2}{r}{\\textbf{Total DC Credits}} & \\textbf{${dcTotal}} & \\\\\n`;
    dcTable += `\\end{longtable}\n`;
  }

  // Semester-wise credit summary
  let semSummary = "";
  semSummary += `\\begin{tabular}{c c c c c c c c}\n`;
  semSummary += `\\toprule\n`;
  semSummary += `\\textbf{Sem} & \\textbf{IC} & \\textbf{ICB/IKS} & \\textbf{DC} & \\textbf{DE} & \\textbf{FE} & \\textbf{ISTP/MTP} & \\textbf{Total} \\\\\n`;
  semSummary += `\\midrule\n`;
  for (let s = 1; s <= numSems; s++) {
    const sc = bySem[s] || [];
    const icCr   = sc.filter(c => c.category === "IC" && !c.optional).reduce((a,c)=>a+c.credits,0);
    const icbCr  = sc.filter(c => (c.category === "ICB" || c.category === "IKS" || c.category === "HSS") && !c.optional).reduce((a,c)=>a+c.credits,0);
    const dcCr   = sc.filter(c => c.category === "DC" && !c.optional).reduce((a,c)=>a+c.credits,0);
    const deCr   = sc.filter(c => c.category === "DE" && !c.optional).reduce((a,c)=>a+c.credits,0);
    const feCr   = sc.filter(c => c.category === "FE" && !c.optional).reduce((a,c)=>a+c.credits,0);
    const mtpCr  = sc.filter(c => (c.category === "ISTP" || c.category === "MTP") && !c.optional).reduce((a,c)=>a+c.credits,0);
    const tot    = icCr + icbCr + dcCr + deCr + feCr + mtpCr;
    const fmt = v => v > 0 ? String(v) : "--";
    semSummary += `${s} & ${fmt(icCr)} & ${fmt(icbCr)} & ${fmt(dcCr)} & ${fmt(deCr)} & ${fmt(feCr)} & ${fmt(mtpCr)} & ${tot} \\\\\n`;
  }
  semSummary += `\\bottomrule\n`;
  semSummary += `\\end{tabular}\n`;

  const isBSCS = branch === "BSCS";
  const degreeLabel = isBSCS ? "B.S." : "B.Tech";
  const batchYear = batchLabel === "B23" ? 2023 : batchLabel === "B24" ? 2024 : 2025;

  return `\\documentclass[a4paper,11pt]{article}
\\usepackage[margin=2cm]{geometry}
\\usepackage{booktabs}
\\usepackage{longtable}
\\usepackage{array}
\\usepackage{xcolor}
\\usepackage{colortbl}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{fancyhdr}
\\usepackage{titlesec}

\\definecolor{iitmblue}{RGB}{0,70,127}
\\definecolor{lightgray}{RGB}{245,245,245}

\\hypersetup{colorlinks=true, linkcolor=iitmblue, urlcolor=iitmblue}

\\pagestyle{fancy}
\\fancyhf{}
\\rhead{\\textcolor{iitmblue}{\\textbf{IIT Mandi}}}
\\lhead{\\textcolor{iitmblue}{${esc(branch)} ${batchLabel} Curriculum}}
\\cfoot{\\thepage}

\\titleformat{\\section}{\\large\\bfseries\\color{iitmblue}}{}{0em}{}[\\titlerule]

\\begin{document}

\\begin{center}
  {\\LARGE\\bfseries\\color{iitmblue} ${degreeLabel} in ${meta.fullName}}\\\\[0.5em]
  {\\large Curriculum --- Batch ${batchYear} (${batchLabel})}\\\\[0.3em]
  {\\normalsize Indian Institute of Technology Mandi}\\\\[0.2em]
  {\\small ${meta.dept}}
\\end{center}

\\vspace{0.5em}

\\section{Credit Structure Summary}

\\begin{center}
\\begin{tabular}{l c}
\\toprule
\\textbf{Category} & \\textbf{Credits Required} \\\\
\\midrule
Institute Core (IC) & ${credits.ic} \\\\
Discipline Core (DC) & ${credits.dc} \\\\
Discipline Elective (DE) & ${credits.de} \\\\
Free Elective (FE) & ${credits.fe} \\\\
MTP / ISTP & ${credits.mtp} \\\\
\\midrule
\\textbf{Total} & \\textbf{${credits.total}} \\\\
\\bottomrule
\\end{tabular}
\\end{center}

\\vspace{0.5em}
\\noindent\\small\\textit{* Optional courses shown with asterisk --- student must explicitly opt in.}

\\section{Semester-wise Credit Breakdown}

${semSummary}

\\section{Discipline Core (DC) Course List}

${dcTable || "\\textit{No DC courses defined for this branch/batch.}"}

\\section{Full Curriculum (Semester-wise)}

${semTable}

\\vspace{1em}
\\noindent\\small\\textit{Categories: IC = Institute Core, ICB = IC Basket, IKS = Indian Knowledge Systems, HSS = Humanities \\& Social Sciences, DC = Discipline Core, DE = Discipline Elective, FE = Free Elective, ISTP = Interdisciplinary Socio-Technical Practicum, MTP = Major Technical Project}

\\vspace{2em}
\\hrule
\\vspace{0.5em}
\\noindent{\\small Generated by PlanMyDegree $\\cdot$ IIT Mandi $\\cdot$ \\today}

\\end{document}
`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const BATCHES = [
  { label: "B23", year: 2023 },
  { label: "B24", year: 2024 },
  { label: "B25", year: 2025 },
];

const BRANCHES = [
  "CSE", "DSE", "DSAI", "EE", "ME", "CE", "BE", "EP", "MNC", "MSE",
  "GE-ROBO", "GE-COMM", "GE-MECH", "MEVLSI", "BSCS",
];

// DSAI is only for B25 (B23 and B24 use DSE)
const BATCH_BRANCHES = {
  B23: ["CSE","DSE","EE","ME","CE","BE","EP","MNC","MSE","GE-ROBO","GE-COMM","GE-MECH","MEVLSI","BSCS"],
  B24: ["CSE","DSE","EE","ME","CE","BE","EP","MNC","MSE","GE-ROBO","GE-COMM","GE-MECH","MEVLSI","BSCS"],
  B25: ["CSE","DSE","DSAI","EE","ME","CE","BE","EP","MNC","MSE","GE-ROBO","GE-COMM","GE-MECH","MEVLSI","BSCS"],
};

// File name safe versions
function safeName(branch) {
  return branch.replace(/[^A-Za-z0-9]/g, "_");
}

const generated = [];

for (const { label, year } of BATCHES) {
  const batchDir = join(CURRICULA_DIR, label);
  mkdirSync(batchDir, { recursive: true });

  for (const branch of BATCH_BRANCHES[label]) {
    const fname = `${safeName(branch)}_${label}.tex`;
    const fpath = join(batchDir, fname);

    console.log(`Generating ${label}/${fname} ...`);
    const tex = generateTeX(branch, label, year);
    writeFileSync(fpath, tex, "utf8");
    generated.push({ batchDir, fname, branch, label });
  }
}

console.log(`\nGenerated ${generated.length} .tex files.\n`);
console.log("Compiling PDFs...\n");

let success = 0, failed = 0;
for (const { batchDir, fname, branch, label } of generated) {
  const texPath = join(batchDir, fname);
  const cmd = `"${PDFLATEX}" -interaction=nonstopmode -output-directory "${batchDir}" "${texPath}"`;
  process.stdout.write(`  Compiling ${label}/${fname} ... `);
  try {
    execSync(cmd, { stdio: "pipe", cwd: batchDir, timeout: 60000 });
    // Run twice for longtable references
    execSync(cmd, { stdio: "pipe", cwd: batchDir, timeout: 60000 });
    console.log("OK");
    success++;
  } catch (err) {
    console.log("FAILED");
    console.error(`    Error: ${err.message?.substring(0, 200)}`);
    failed++;
  }
}

console.log(`\nDone: ${success} PDF(s) compiled, ${failed} failed.`);
