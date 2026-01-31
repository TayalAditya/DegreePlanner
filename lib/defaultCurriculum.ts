// Default curriculum for each branch (Semesters 1-6)
export interface DefaultCourse {
  code: string;
  name: string;
  credits: number;
  category: "IC" | "ICB" | "HSS" | "DC" | "DE" | "FE";
  semester: number;
}

// Common IC courses for all branches (Semesters 1-4)
const commonSem1: DefaultCourse[] = [
  { code: "IC112", name: "Calculus", credits: 2, category: "IC", semester: 1 },
  { code: "IC113", name: "Complex Variables and Vector Calculus", credits: 2, category: "IC", semester: 1 },
  { code: "IC140", name: "Engineering Graphics for Design", credits: 4, category: "IC", semester: 1 },
  { code: "IC102P", name: "Foundations of Design Practicum", credits: 4, category: "IC", semester: 1 },
];

const commonSem2: DefaultCourse[] = [
  { code: "IC114", name: "Linear Algebra", credits: 2, category: "IC", semester: 2 },
  { code: "IC115", name: "ODE & Integral Transforms", credits: 2, category: "IC", semester: 2 },
  { code: "IC152", name: "Computing and Data Science", credits: 4, category: "IC", semester: 2 },
  { code: "IC161", name: "Applied Electronics", credits: 3, category: "IC", semester: 2 },
  { code: "IC161P", name: "Applied Electronics Lab", credits: 2, category: "IC", semester: 2 },
];

const commonSem3: DefaultCourse[] = [
  { code: "IC202P", name: "Design Practicum", credits: 3, category: "IC", semester: 3 },
  { code: "IC222P", name: "Physics Practicum", credits: 2, category: "IC", semester: 3 },
  { code: "IC252", name: "Probability and Statistics", credits: 4, category: "IC", semester: 3 },
];

const commonSem4: DefaultCourse[] = [
  { code: "IC272", name: "Machine Learning", credits: 3, category: "IC", semester: 4 },
];

// CSE specific courses
const cseSem1: DefaultCourse[] = [
  ...commonSem1,
];

const cseSem2: DefaultCourse[] = [
  ...commonSem2,
];

const cseSem3: DefaultCourse[] = [
  ...commonSem3,
  { code: "CS208", name: "Mathematical Foundations of Computer Science", credits: 4, category: "DC", semester: 3 },
  { code: "CS214", name: "Computer Organization", credits: 4, category: "DC", semester: 3 },
];

const cseSem4: DefaultCourse[] = [
  ...commonSem4,
  { code: "CS212", name: "Design of Algorithms", credits: 4, category: "DC", semester: 4 },
  { code: "CS302", name: "Paradigms of Programming", credits: 4, category: "DC", semester: 4 },
];

const cseSem5: DefaultCourse[] = [
  { code: "CS304", name: "Formal Language and Automata Theory", credits: 3, category: "DC", semester: 5 },
  { code: "CS309", name: "Information Systems and Databases", credits: 4, category: "DC", semester: 5 },
  { code: "CS303", name: "Software Engineering", credits: 3, category: "DC", semester: 5 },
];

const cseSem6: DefaultCourse[] = [
  { code: "CS305", name: "Artificial Intelligence", credits: 3, category: "DC", semester: 6 },
  { code: "CS313", name: "Computer Networks", credits: 4, category: "DC", semester: 6 },
  { code: "CS312", name: "Operating Systems", credits: 4, category: "DC", semester: 6 },
];

// EE specific courses
const eeSem3: DefaultCourse[] = [
  ...commonSem3,
  { code: "EE261", name: "Electrical Systems Around Us", credits: 5, category: "DC", semester: 3 },
  { code: "EE260", name: "Signals and Systems", credits: 3, category: "DC", semester: 3 },
];

const eeSem4: DefaultCourse[] = [
  ...commonSem4,
  { code: "EE210", name: "Digital System Design", credits: 4, category: "DC", semester: 4 },
  { code: "EE203", name: "Network Theory", credits: 3, category: "DC", semester: 4 },
  { code: "EE231", name: "Measurement and Instrumentation", credits: 3, category: "DC", semester: 4 },
];

const eeSem5: DefaultCourse[] = [
  { code: "EE311", name: "Device Electronics", credits: 3, category: "DC", semester: 5 },
  { code: "EE202", name: "Electromagnetic Theory", credits: 3, category: "DC", semester: 5 },
  { code: "EE201", name: "Electro-Mechanics", credits: 4, category: "DC", semester: 5 },
];

const eeSem6: DefaultCourse[] = [
  { code: "EE211", name: "Analog Circuit Design", credits: 4, category: "DC", semester: 6 },
  { code: "EE304", name: "Communication Systems", credits: 4, category: "DC", semester: 6 },
  { code: "EE301", name: "Control Systems", credits: 4, category: "DC", semester: 6 },
];

// ME specific courses
const meSem3: DefaultCourse[] = [
  ...commonSem3,
  { code: "EE261", name: "Electrical Systems Around Us", credits: 3, category: "DC", semester: 3 },
  { code: "ME212", name: "Product Manufacturing Technologies", credits: 3, category: "DC", semester: 3 },
  { code: "ME213", name: "Engineering Thermodynamics", credits: 3, category: "DC", semester: 3 },
];

const meSem4: DefaultCourse[] = [
  ...commonSem4,
  { code: "ME205", name: "Machine Drawing", credits: 3, category: "DC", semester: 4 },
  { code: "ME206", name: "Mechanics of Solids", credits: 3, category: "DC", semester: 4 },
  { code: "IC241", name: "Material Science for Engineers", credits: 3, category: "IC", semester: 4 },
];

const meSem5: DefaultCourse[] = [
  { code: "ME210", name: "Fluid Mechanics", credits: 3, category: "DC", semester: 5 },
  { code: "ME303", name: "Heat Transfer", credits: 3, category: "DC", semester: 5 },
  { code: "ME305", name: "Design of Machine Elements", credits: 4, category: "DC", semester: 5 },
];

const meSem6: DefaultCourse[] = [
  { code: "ME307", name: "Energy Conversion Devices", credits: 3, category: "DC", semester: 6 },
  { code: "ME308", name: "Manufacturing Engineering 1", credits: 3, category: "DC", semester: 6 },
  { code: "ME309", name: "Theory of Machines", credits: 4, category: "DC", semester: 6 },
];

// Generic curriculum for other branches
const genericSem5: DefaultCourse[] = [];
const genericSem6: DefaultCourse[] = [];

export const DEFAULT_CURRICULUM: Record<string, DefaultCourse[]> = {
  // CSE
  CSE_1: cseSem1,
  CSE_2: cseSem2,
  CSE_3: cseSem3,
  CSE_4: cseSem4,
  CSE_5: cseSem5,
  CSE_6: cseSem6,

  // EE
  EE_1: commonSem1,
  EE_2: commonSem2,
  EE_3: eeSem3,
  EE_4: eeSem4,
  EE_5: eeSem5,
  EE_6: eeSem6,

  // ME
  ME_1: commonSem1,
  ME_2: commonSem2,
  ME_3: meSem3,
  ME_4: meSem4,
  ME_5: meSem5,
  ME_6: meSem6,

  // DSE
  DSE_1: commonSem1,
  DSE_2: commonSem2,
  DSE_3: [...commonSem3, { code: "DS201", name: "Data Handling and Vizualisation", credits: 3, category: "DC", semester: 3 }],
  DSE_4: [...commonSem4, { code: "DS301", name: "Mathematical Foundations of Data Science", credits: 4, category: "DC", semester: 4 }],
  DSE_5: [{ code: "DS302", name: "Computing Systems for Data Processing", credits: 3, category: "DC", semester: 5 }, { code: "DS313", name: "Statistical Foundations of Data Science", credits: 4, category: "DC", semester: 5 }],
  DSE_6: [{ code: "DS404", name: "Information Security and Privacy", credits: 3, category: "DC", semester: 6 }, { code: "DS411", name: "Optimization for Data Science", credits: 4, category: "DC", semester: 6 }],

  // CE
  CE_1: commonSem1,
  CE_2: commonSem2,
  CE_3: [...commonSem3, { code: "CE201", name: "Surveying Traditional and Digital", credits: 4, category: "DC", semester: 3 }, { code: "CE251", name: "Hydraulics Engineering", credits: 3, category: "DC", semester: 3 }],
  CE_4: [...commonSem4, { code: "CE252", name: "Geology and Geomorphology", credits: 3, category: "DC", semester: 4 }, { code: "CE203", name: "Construction Materials", credits: 3, category: "DC", semester: 4 }],
  CE_5: [{ code: "CE301", name: "Strength of Materials and Structures", credits: 3, category: "DC", semester: 5 }, { code: "CE302", name: "Geotechnical Engineering I", credits: 3, category: "DC", semester: 5 }],
  CE_6: [{ code: "CE352", name: "Transportation Engineering", credits: 3, category: "DC", semester: 6 }, { code: "CE401", name: "Design of Steel Structures", credits: 3, category: "DC", semester: 6 }],

  // BE
  BE_1: commonSem1,
  BE_2: commonSem2,
  BE_3: [...commonSem3, { code: "BE201", name: "Cell Biology", credits: 4, category: "DC", semester: 3 }, { code: "BE202", name: "Biochemistry and Molecular Biology", credits: 4, category: "DC", semester: 3 }],
  BE_4: [...commonSem4, { code: "BE203", name: "Enzymology and Bioprocessing", credits: 4, category: "DC", semester: 4 }, { code: "BE301", name: "Biomechanics", credits: 4, category: "DC", semester: 4 }],
  BE_5: [{ code: "BE308", name: "Introduction to Biomanufacturing", credits: 4, category: "DC", semester: 5 }, { code: "BE303", name: "Applied Biostatistics", credits: 4, category: "DC", semester: 5 }],
  BE_6: [{ code: "BE304", name: "Bioinformatics", credits: 4, category: "DC", semester: 6 }, { code: "BE306", name: "Fundamentals of Genetic Engineering", credits: 4, category: "DC", semester: 6 }],

  // EP
  EP_1: commonSem1,
  EP_2: commonSem2,
  EP_3: [...commonSem3, { code: "EP321", name: "Foundations of Electrodynamics", credits: 3, category: "DC", semester: 3 }, { code: "EP301", name: "Engineering Mathematics 2", credits: 4, category: "DC", semester: 3 }],
  EP_4: [...commonSem4, { code: "PH301", name: "Quantum Mechnanics and Applications", credits: 3, category: "DC", semester: 4 }, { code: "PH302", name: "Introduction to Statistical Mechanics", credits: 3, category: "DC", semester: 4 }],
  EP_5: [{ code: "EE311", name: "Device Electronics for Integrated Circuits", credits: 3, category: "DC", semester: 5 }, { code: "EP302", name: "Computational Methods for Engineering", credits: 3, category: "DC", semester: 5 }],
  EP_6: [{ code: "EP402P", name: "Engineering Physics Practicum", credits: 4, category: "DC", semester: 6 }, { code: "PH502", name: "Photonics", credits: 3, category: "DC", semester: 6 }],

  // MnC
  MnC_1: commonSem1,
  MnC_2: commonSem2,
  MnC_3: [...commonSem3, { code: "CS208", name: "Mathematical Foundations of Computer Science", credits: 4, category: "DC", semester: 3 }, { code: "MA211", name: "Ordinary Differential Equations", credits: 4, category: "DC", semester: 3 }],
  MnC_4: [...commonSem4, { code: "MA220", name: "Partial Differential Equations", credits: 4, category: "DC", semester: 4 }, { code: "CS214", name: "Computer Organisation", credits: 4, category: "DC", semester: 4 }],
  MnC_5: [{ code: "MA210", name: "Real and Complex Analysis", credits: 3, category: "DC", semester: 5 }, { code: "MA221", name: "Numerical Analysis", credits: 4, category: "DC", semester: 5 }],
  MnC_6: [{ code: "MA222", name: "Applied Linear Programming", credits: 4, category: "DC", semester: 6 }, { code: "CS312", name: "Design of Algorithms", credits: 4, category: "DC", semester: 6 }],

  // MSE
  MSE_1: commonSem1,
  MSE_2: commonSem2,
  MSE_3: [...commonSem3, { code: "MT201", name: "Physics of Solids", credits: 3, category: "DC", semester: 3 }, { code: "MT203", name: "Material Synthesis and Characterisation", credits: 4, category: "DC", semester: 3 }],
  MSE_4: [...commonSem4, { code: "MT301", name: "Phase Transformations", credits: 3, category: "DC", semester: 4 }, { code: "MT204", name: "Thermodynamics and Kinetics and Materials", credits: 3, category: "DC", semester: 4 }],
  MSE_5: [{ code: "ME206", name: "Mechanics of Solids", credits: 3, category: "DC", semester: 5 }, { code: "MT206", name: "Extraction and Materials Processing", credits: 4, category: "DC", semester: 5 }],
  MSE_6: [{ code: "MT302", name: "Transport Phenomena", credits: 3, category: "DC", semester: 6 }, { code: "MT303", name: "Computational Materials Science", credits: 4, category: "DC", semester: 6 }],

  // GE
  GE_1: commonSem1,
  GE_2: commonSem2,
  GE_3: [...commonSem3, { code: "EE201", name: "Electromechanics", credits: 3, category: "DC", semester: 3 }, { code: "EE261", name: "Electrical System Around Us", credits: 3, category: "DC", semester: 3 }],
  GE_4: [...commonSem4, { code: "IC241", name: "Material Science for Engineers", credits: 3, category: "IC", semester: 4 }, { code: "IC253", name: "Programming and Data Structures", credits: 3, category: "IC", semester: 4 }],
  GE_5: [{ code: "DS201", name: "Data Handling and Vizualization", credits: 3, category: "DC", semester: 5 }, { code: "EE301", name: "Control Systems", credits: 3, category: "DC", semester: 5 }],
  GE_6: [{ code: "ME309", name: "Theory of Machines", credits: 4, category: "DC", semester: 6 }],

  // VLSI
  VLSI_1: commonSem1,
  VLSI_2: commonSem2,
  VLSI_3: [...commonSem3, { code: "EE260", name: "Signals and Systems", credits: 3, category: "DC", semester: 3 }, { code: "EE210", name: "Digital System Design and Practicum", credits: 4, category: "DC", semester: 3 }],
  VLSI_4: [...commonSem4, { code: "EE203", name: "Network Theory", credits: 3, category: "DC", semester: 4 }],
  VLSI_5: [{ code: "EE301", name: "Control Systems", credits: 4, category: "DC", semester: 5 }, { code: "EE202", name: "Electromagnetic Theory and Transmission Lines", credits: 3, category: "DC", semester: 5 }],
  VLSI_6: [{ code: "EE326", name: "Computer Organization and Design", credits: 4, category: "DC", semester: 6 }, { code: "EE211", name: "Analog Circuit Design", credits: 4, category: "DC", semester: 6 }],

  // CS (B.S. Chemical Sciences)
  CS_1: commonSem1,
  CS_2: commonSem2,
  CS_3: [...commonSem3, { code: "CY301", name: "Principles and Theories of Physical Chemistry", credits: 3, category: "DC", semester: 3 }, { code: "CY302", name: "Principles of Organic Chemistry", credits: 3, category: "DC", semester: 3 }],
  CS_4: [...commonSem4, { code: "CY303", name: "Fundamentals of Inorganic Chemistry", credits: 3, category: "DC", semester: 4 }, { code: "CY304", name: "Fundamental Analytical Chemistry", credits: 3, category: "DC", semester: 4 }],
  CS_5: [{ code: "CY401", name: "Introduction to Quantum Chemistry and Molecular Spectroscopy", credits: 3, category: "DC", semester: 5 }, { code: "CY531", name: "Organic Reactions and Mechanisms", credits: 3, category: "DC", semester: 5 }],
  CS_6: [{ code: "CY533", name: "Chemistry of Main Group Elements", credits: 3, category: "DC", semester: 6 }, { code: "CY512", name: "Advanced Quantum Chemistry", credits: 3, category: "DC", semester: 6 }],
};

export function getDefaultCurriculum(branch: string, semester: number): DefaultCourse[] {
  const key = `${branch}_${semester}`;
  return DEFAULT_CURRICULUM[key] || [];
}

export function getAllDefaultCourses(branch: string, upToSemester: number = 6): DefaultCourse[] {
  const courses: DefaultCourse[] = [];
  for (let sem = 1; sem <= upToSemester; sem++) {
    courses.push(...getDefaultCurriculum(branch, sem));
  }
  return courses;
}
