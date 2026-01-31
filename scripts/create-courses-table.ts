import prisma from '../lib/prisma';

interface CourseMapping {
  code: string;
  name: string;
  credits: number;
  branches: {
    [key: string]: 'IC' | 'IC-BASKET' | 'DC' | 'DE' | 'HSS' | 'IKS' | 'FE' | 'N/A';
  };
}

const courses: CourseMapping[] = [
  // IC Compulsory Courses - Same for all branches
  { code: 'IC112', name: 'Calculus', credits: 2, branches: {} },
  { code: 'IC114', name: 'Linear Algebra', credits: 2, branches: {} },
  { code: 'IC113', name: 'Complex Variables and Vector Calculus', credits: 2, branches: {} },
  { code: 'IC115', name: 'ODE & Integral Transforms', credits: 2, branches: {} },
  { code: 'IC140', name: 'Engineering Graphics for Design', credits: 4, branches: {} },
  { code: 'IC102P', name: 'Foundations of Design Practicum', credits: 4, branches: {} },
  { code: 'IC152', name: 'Computing and Data Science', credits: 4, branches: {} },
  { code: 'IC202P', name: 'Design Practicum', credits: 3, branches: {} },
  { code: 'IC252', name: 'Probability and Statistics', credits: 4, branches: {} },
  { code: 'IC161', name: 'Applied Electronics', credits: 3, branches: {} },
  { code: 'IC272', name: 'Machine Learning', credits: 3, branches: {} },
  { code: 'IC161P', name: 'Applied Electronics Lab', credits: 2, branches: {} },
  { code: 'IC010', name: 'Internship', credits: 2, branches: {} },
  { code: 'IC222P', name: 'Physics Practicum', credits: 2, branches: {} },

  // IC Basket I
  { code: 'IC131', name: 'Applied Chemistry for Engineers', credits: 3, branches: { 'CHEMICAL': 'IC-BASKET', 'MSE': 'IC-BASKET' } },
  { code: 'IC136', name: 'Understanding Biotechnology and its Applications', credits: 3, branches: { 'BIO-E': 'IC-BASKET', 'MNC': 'IC-BASKET' } },
  { code: 'IC230', name: 'Environmental Science', credits: 3, branches: { 'CIVIL': 'IC-BASKET', 'EP': 'IC-BASKET', 'GE': 'IC-BASKET' } },

  // IC Basket II
  { code: 'IC121', name: 'Mechanics of Particles and Waves', credits: 3, branches: { 'EP': 'IC-BASKET', 'CHEMICAL': 'IC-BASKET' } },
  { code: 'IC240', name: 'Mechanics of Rigid Bodies', credits: 3, branches: { 'BIO-E': 'IC-BASKET', 'CIVIL': 'IC-BASKET', 'ME': 'IC-BASKET', 'MSE': 'IC-BASKET', 'GE': 'IC-BASKET' } },
  { code: 'IC241', name: 'Material Science for Engineers', credits: 3, branches: {} },
  { code: 'IC253', name: 'Data Structures and Algorithms', credits: 3, branches: { 'CSE': 'IC-BASKET', 'DSE': 'IC-BASKET', 'MNC': 'IC-BASKET' } },

  // B.S. Chemical Sciences - Discipline Core
  { code: 'CY301', name: 'Principles and Theories of Physical Chemistry', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY512P', name: 'Physical Chemistry Laboratory', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY302', name: 'Principles of Organic Chemistry', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY533P', name: 'Inorganic Chemistry Laboratory', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY303', name: 'Fundamentals of Inorganic Chemistry', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY532', name: 'Photochemistry and Pericyclic Reactions', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY201P', name: 'Physical Chemistry Laboratory', credits: 2, branches: { 'BS-CS': 'DC' } },
  { code: 'CY534', name: 'Chemistry of Transition Elements', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY401', name: 'Introduction to Quantum Chemistry and Molecular Spectroscopy', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY511', name: 'Group Theory and Spectroscopy', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY304', name: 'Fundamental Analytical Chemistry', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY531P', name: 'Organic Chemistry Laboratory', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY202P', name: 'Organic Chemistry Laboratory', credits: 2, branches: { 'BS-CS': 'DC' } },
  { code: 'CY514', name: 'Chemical and Statistical Thermodynamics', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY203P', name: 'Inorganic Chemistry Laboratory', credits: 2, branches: { 'BS-CS': 'DC' } },
  { code: 'CY535', name: 'Introduction to Organometallic Chemistry', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY531', name: 'Organic Reactions and Mechanisms', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY513', name: 'Chemical Kinetics and Reaction Dynamics', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY533', name: 'Chemistry of Main Group Elements', credits: 3, branches: { 'BS-CS': 'DC' } },
  { code: 'CY504', name: 'Heterocyclic Chemistry', credits: 2, branches: { 'BS-CS': 'DC' } },
  { code: 'CY512', name: 'Advanced Quantum Chemistry', credits: 3, branches: { 'BS-CS': 'DC' } },

  // BioEngineering - Discipline Core
  { code: 'BE201', name: 'Cell Biology', credits: 4, branches: { 'BIO-E': 'DC' } },
  { code: 'BE304', name: 'Bioinformatics', credits: 4, branches: { 'BIO-E': 'DC' } },
  { code: 'BE202', name: 'Biochemistry and Molecular Biology', credits: 4, branches: { 'BIO-E': 'DC' } },
  { code: 'BE305', name: 'Bioethics and Regulatory Affairs', credits: 1, branches: { 'BIO-E': 'DC' } },
  { code: 'BE203', name: 'Enzymology and Bioprocessing', credits: 4, branches: { 'BIO-E': 'DC' } },
  { code: 'BE306', name: 'Fundamentals of Genetic Engineering', credits: 4, branches: { 'BIO-E': 'DC' } },
  { code: 'BE301', name: 'Biomechanics', credits: 4, branches: { 'BIO-E': 'DC' } },
  { code: 'BE309', name: 'Biosensing & Bioinstrumentation', credits: 4, branches: { 'BIO-E': 'DC' } },
  { code: 'BE308', name: 'Introduction to Biomanufacturing', credits: 4, branches: { 'BIO-E': 'DC' } },
  { code: 'BE310', name: 'Biomaterials', credits: 4, branches: { 'BIO-E': 'DC' } },
  { code: 'BE303', name: 'Applied Biostatistics', credits: 4, branches: { 'BIO-E': 'DC' } },

  // Civil Engineering - Discipline Core
  { code: 'CE201', name: 'Surveying Traditional and Digital', credits: 4, branches: { 'CIVIL': 'DC' } },
  { code: 'CE352', name: 'Transportation Engineering', credits: 3, branches: { 'CIVIL': 'DC' } },
  { code: 'CE251', name: 'Hydraulics Engineering', credits: 3, branches: { 'CIVIL': 'DC' } },
  { code: 'CE352P', name: 'Transportation Engineering Lab', credits: 1, branches: { 'CIVIL': 'DC' } },
  { code: 'CE252', name: 'Geology and Geomorphology', credits: 3, branches: { 'CIVIL': 'DC' } },
  { code: 'CE354P', name: 'Construction Materials Lab', credits: 1, branches: { 'CIVIL': 'DC' } },
  { code: 'CE202', name: 'Introduction to Civil Engineering Profession', credits: 1, branches: { 'CIVIL': 'DC' } },
  { code: 'CE401', name: 'Design of Steel Structures', credits: 3, branches: { 'CIVIL': 'DC' } },
  { code: 'CE203', name: 'Construction Materials', credits: 3, branches: { 'CIVIL': 'DC' } },
  { code: 'CE403', name: 'Water and Wastewater Engineering', credits: 3, branches: { 'CIVIL': 'DC' } },
  { code: 'CE301', name: 'Strength of Materials and Structures', credits: 3, branches: { 'CIVIL': 'DC' } },
  { code: 'CE404', name: 'Analysis of Structures', credits: 3, branches: { 'CIVIL': 'DC' } },
  { code: 'CE301P', name: 'Strength of Materials and Structures Lab', credits: 1, branches: { 'CIVIL': 'DC' } },
  { code: 'CE402', name: 'Geotechnical Engineering II', credits: 3, branches: { 'CIVIL': 'DC' } },
  { code: 'CE302', name: 'Geotechnical Engineering I', credits: 3, branches: { 'CIVIL': 'DC' } },
  { code: 'CE303', name: 'Water Resources Engineering', credits: 3, branches: { 'CIVIL': 'DC' } },
  { code: 'CE302P', name: 'Geotechnical Engineering Lab', credits: 1, branches: { 'CIVIL': 'DC' } },
  { code: 'CE351', name: 'Design of Reinforced Concrete Structures', credits: 3, branches: { 'CIVIL': 'DC' } },
  { code: 'CE304P', name: 'Hydraulics Engineering Lab', credits: 1, branches: { 'CIVIL': 'DC' } },
  { code: 'CE353P', name: 'Civil Engineering Drawing', credits: 1, branches: { 'CIVIL': 'DC' } },
  { code: 'CE305P', name: 'Environmental Engineering Lab', credits: 1, branches: { 'CIVIL': 'DC' } },

  // Computer Science Engineering - Discipline Core
  { code: 'CS214', name: 'Computer Organization', credits: 4, branches: { 'CSE': 'DC', 'MNC': 'DC' } },
  { code: 'CS303', name: 'Software Engineering', credits: 3, branches: { 'CSE': 'DC' } },
  { code: 'CS208', name: 'Mathematical Foundations of Computer Science', credits: 4, branches: { 'CSE': 'DC', 'MNC': 'DC' } },
  { code: 'CS305', name: 'Artificial Intelligence', credits: 3, branches: { 'CSE': 'DC', 'DSE': 'DC' } },
  { code: 'CS302', name: 'Paradigms of Programming', credits: 4, branches: { 'CSE': 'DC' } },
  { code: 'CS313', name: 'Computer Networks', credits: 4, branches: { 'CSE': 'DC' } },
  { code: 'CS304', name: 'Formal Language and Automata Theory', credits: 3, branches: { 'CSE': 'DC', 'MNC': 'DC' } },
  { code: 'CS212', name: 'Design of Algorithms', credits: 4, branches: { 'CSE': 'DC', 'MNC': 'DC' } },
  { code: 'CS309', name: 'Information Systems and Databases', credits: 4, branches: { 'CSE': 'DC' } },
  { code: 'CS312', name: 'Operating Systems', credits: 4, branches: { 'CSE': 'DC' } },

  // Data Science Engineering - Discipline Core
  { code: 'DS201', name: 'Data Handling and Vizualisation', credits: 3, branches: { 'DSE': 'DC', 'GE': 'DC' } },
  { code: 'DS411', name: 'Optimization for Data Science', credits: 4, branches: { 'DSE': 'DC' } },
  { code: 'DS301', name: 'Mathematical Foundations of Data Science', credits: 4, branches: { 'DSE': 'DC' } },
  { code: 'DS302', name: 'Computing Systems for Data Processing', credits: 3, branches: { 'DSE': 'DC' } },
  { code: 'DS412', name: 'Matrix Computations for Data Science', credits: 4, branches: { 'DSE': 'DC' } },
  { code: 'DS313', name: 'Statistical Foundations of Data Science', credits: 4, branches: { 'DSE': 'DC' } },
  { code: 'DS413', name: 'Introduction to Statistical Learning', credits: 4, branches: { 'DSE': 'DC' } },
  { code: 'DS404', name: 'Information Security and Privacy', credits: 3, branches: { 'DSE': 'DC', 'GE-COMM': 'DC' } },

  // Electrical Engineering - Discipline Core
  { code: 'EE261', name: 'Electrical Systems Around Us', credits: 5, branches: { 'EE': 'DC', 'GE': 'DC', 'GE-COMM': 'DC', 'GE-MECH': 'DC' } },
  { code: 'EE211', name: 'Analog Circuit Design', credits: 4, branches: { 'EE': 'DC', 'GE-MECH': 'DC', 'VLSI': 'DC' } },
  { code: 'EE260', name: 'Signals and Systems', credits: 3, branches: { 'EE': 'DC', 'GE-COMM': 'DC', 'GE-MECH': 'DC', 'VLSI': 'DC' } },
  { code: 'EE304', name: 'Communication Systems', credits: 4, branches: { 'EE': 'DC', 'GE-COMM': 'DC' } },
  { code: 'EE210', name: 'Digital System Design', credits: 4, branches: { 'EE': 'DC', 'VLSI': 'DC' } },
  { code: 'EE301', name: 'Control Systems', credits: 4, branches: { 'EE': 'DC', 'GE-ROBO': 'DC', 'GE-MECH': 'DC' } },
  { code: 'EE203', name: 'Network Theory', credits: 3, branches: { 'EE': 'DC', 'GE-COMM': 'DC', 'VLSI': 'DC' } },
  { code: 'EE311', name: 'Device Electronics', credits: 3, branches: { 'EE': 'DC', 'EP': 'DC', 'GE-MECH': 'DC' } },
  { code: 'EE314', name: 'Digital Signal Processing', credits: 3, branches: { 'EE': 'DC', 'GE-COMM': 'DC' } },
  { code: 'EE202', name: 'Electromagnetic Theory', credits: 3, branches: { 'EE': 'DC', 'GE-COMM': 'DC' } },
  { code: 'EE326', name: 'Computer Organization & Processor Architecture Design', credits: 4, branches: { 'EE': 'DC', 'GE-MECH': 'DC', 'VLSI': 'DC' } },
  { code: 'EE231', name: 'Measurement and Instrumentation', credits: 3, branches: { 'EE': 'DC', 'GE-COMM': 'DC' } },
  { code: 'EE201', name: 'Electro-Mechanics', credits: 4, branches: { 'EE': 'DC', 'GE-ROBO': 'DC', 'GE-COMM': 'DC', 'GE-MECH': 'DC' } },

  // Engineering Physics - Discipline Core
  { code: 'EP321', name: 'Foundations of Electrodynamics', credits: 3, branches: { 'EP': 'DC' } },
  { code: 'EP402P', name: 'Engineering Physics Practicum', credits: 4, branches: { 'EP': 'DC' } },
  { code: 'EP301', name: 'Engineering Mathematics 2', credits: 4, branches: { 'EP': 'DC' } },
  { code: 'PH502', name: 'Photonics', credits: 3, branches: { 'EP': 'DC' } },
  { code: 'PH301', name: 'Quantum Mechnanics and Applications', credits: 3, branches: { 'EP': 'DC' } },
  { code: 'EP403', name: 'Physics of Atoms and Molecules', credits: 3, branches: { 'EP': 'DC' } },
  { code: 'PH302', name: 'Introduction to Statistical Mechanics', credits: 3, branches: { 'EP': 'DC' } },
  { code: 'EP401P', name: 'Engineering of Instrumentation', credits: 4, branches: { 'EP': 'DC' } },
  { code: 'EP302', name: 'Computational Methods for Engineering', credits: 3, branches: { 'EP': 'DC' } },
  { code: 'PH501', name: 'Solid State Physics', credits: 3, branches: { 'EP': 'DC' } },

  // Materials Science - Discipline Core
  { code: 'MT-201', name: 'Physics of Solids', credits: 3, branches: { 'MSE': 'DC' } },
  { code: 'MT-206', name: 'Extraction and Materials Processing', credits: 4, branches: { 'MSE': 'DC' } },
  { code: 'MT-203', name: 'Material Synthesis and Characterisation', credits: 4, branches: { 'MSE': 'DC' } },
  { code: 'ME-206', name: 'Mechanics of Solids', credits: 3, branches: { 'MSE': 'DC', 'ME': 'DC', 'GE-MECH': 'DC' } },
  { code: 'MT-301', name: 'Phase Transformations', credits: 3, branches: { 'MSE': 'DC' } },
  { code: 'MT-302', name: 'Transport Phenomena', credits: 3, branches: { 'MSE': 'DC' } },
  { code: 'MT-204', name: 'Thermodynamics and Kinetics and Materials', credits: 3, branches: { 'MSE': 'DC' } },
  { code: 'MT-303', name: 'Computational Materials Science', credits: 4, branches: { 'MSE': 'DC' } },
  { code: 'MT-304', name: 'Mechanical Behaviour of Materials', credits: 4, branches: { 'MSE': 'DC' } },
  { code: 'ME-212', name: 'Product Realization (Manufacturing) Technology', credits: 3, branches: { 'MSE': 'DC', 'ME': 'DC' } },
  { code: 'MT-205', name: 'Functional Properties of Materials', credits: 4, branches: { 'MSE': 'DC' } },
  { code: 'MT-202', name: 'Quantum Mechanics and Applications', credits: 3, branches: { 'MSE': 'DC' } },

  // Mathematics and Computing - Discipline Core
  { code: 'MA211', name: 'Ordinary Differential Equations', credits: 4, branches: { 'MNC': 'DC' } },
  { code: 'MA310', name: 'Matrix Computation and Lab', credits: 4, branches: { 'MNC': 'DC' } },
  { code: 'MA220', name: 'Partial Differential Equations', credits: 4, branches: { 'MNC': 'DC' } },
  { code: 'MA210', name: 'Real and Complex Analysis', credits: 3, branches: { 'MNC': 'DC' } },
  { code: 'MA311', name: 'Mathematical Modelling', credits: 3, branches: { 'MNC': 'DC' } },
  { code: 'MA221', name: 'Numerical Analysis', credits: 4, branches: { 'MNC': 'DC' } },
  { code: 'MA323P', name: 'Applied Databases Practicum', credits: 2, branches: { 'MNC': 'DC' } },
  { code: 'MA222', name: 'Applied Linear Programming', credits: 4, branches: { 'MNC': 'DC' } },
  { code: 'MA321', name: 'Numerics of Differential Equation', credits: 4, branches: { 'MNC': 'DC' } },
  { code: 'MA322', name: 'Applied Graph Theory', credits: 4, branches: { 'MNC': 'DC' } },

  // Mechanical Engineering - Discipline Core
  { code: 'ME308', name: 'Manufacturing Engineering 1', credits: 3, branches: { 'ME': 'DC' } },
  { code: 'ME213', name: 'Engineering Thermodynamics', credits: 3, branches: { 'ME': 'DC' } },
  { code: 'ME309', name: 'Theory of Machines', credits: 4, branches: { 'ME': 'DC', 'GE-ROBO': 'DC', 'GE-MECH': 'DC' } },
  { code: 'ME205', name: 'Machine Drawing', credits: 3, branches: { 'ME': 'DC' } },
  { code: 'ME310', name: 'System Dynamics and Control', credits: 3, branches: { 'ME': 'DC' } },
  { code: 'ME210', name: 'Fluid Mechanics', credits: 3, branches: { 'ME': 'DC' } },
  { code: 'ME311P', name: 'Design Lab 1', credits: 1, branches: { 'ME': 'DC' } },
  { code: 'ME303', name: 'Heat Transfer', credits: 3, branches: { 'ME': 'DC' } },
  { code: 'ME312P', name: 'Design Lab 2', credits: 1, branches: { 'ME': 'DC' } },
  { code: 'ME305', name: 'Design of Machine Elements', credits: 4, branches: { 'ME': 'DC', 'GE-ROBO': 'DC', 'GE-MECH': 'DC' } },
  { code: 'ME210P', name: 'Fluid Mechanics Lab', credits: 1, branches: { 'ME': 'DC' } },
  { code: 'ME307', name: 'Energy Conversion Devices', credits: 3, branches: { 'ME': 'DC' } },
  { code: 'ME315', name: 'Manufacturing Engineering 2', credits: 3, branches: { 'ME': 'DC' } },
  { code: 'ME303P', name: 'Heat Transfer Lab', credits: 1, branches: { 'ME': 'DC' } },

  // Microelectronics and VLSI - Discipline Core
  { code: 'VL311', name: 'CMOS Processing and Practicum', credits: 4, branches: { 'VLSI': 'DC' } },
  { code: 'VL402', name: 'RF IC Design', credits: 3, branches: { 'VLSI': 'DC' } },
  { code: 'VL404', name: 'CMOS Analog IC Design', credits: 4, branches: { 'VLSI': 'DC' } },
  { code: 'VL403', name: 'CMOS Digital IC Design', credits: 4, branches: { 'VLSI': 'DC' } },
  { code: 'VL401', name: 'RTL Design and Verification', credits: 3, branches: { 'VLSI': 'DC' } },
  { code: 'VL405', name: 'Design for Testability', credits: 4, branches: { 'VLSI': 'DC' } },

  // General Engineering - Robotics
  { code: 'AR501', name: 'Robot Kinematics, Dynamics and Control', credits: 4, branches: { 'GE-ROBO': 'DC' } },
  { code: 'AR503', name: 'Mechatronics', credits: 3, branches: { 'GE-ROBO': 'DC', 'GE-MECH': 'DC' } },
  { code: 'AR504', name: 'Robot Programming', credits: 3, branches: { 'GE-ROBO': 'DC' } },
];

// Fill IC courses for all branches
const branches = ['BS-CS', 'BIO-E', 'CIVIL', 'CSE', 'DSE', 'EE', 'EP', 'GE-ROBO', 'GE-COMM', 'GE-MECH', 'MSE', 'MNC', 'ME', 'VLSI'];
const icCourses = ['IC112', 'IC114', 'IC113', 'IC115', 'IC140', 'IC102P', 'IC152', 'IC202P', 'IC252', 'IC161', 'IC272', 'IC161P', 'IC010', 'IC222P'];

courses.forEach(course => {
  if (icCourses.includes(course.code)) {
    branches.forEach(branch => {
      course.branches[branch] = 'IC';
    });
  }
});

async function createCoursesTable() {
  console.log('Creating courses table...\n');

  // Delete existing courses first
  await prisma.course.deleteMany({});
  console.log('Cleared existing courses\n');

  // Insert all courses
  for (const course of courses) {
    try {
      await prisma.course.create({
        data: {
          code: course.code,
          name: course.name,
          credits: course.credits,
          department: 'To be assigned',
          level: 100,
          description: '',
          isActive: true,
        },
      });
      console.log(`Added: ${course.code} - ${course.name}`);
    } catch (error) {
      console.error(`Error adding ${course.code}:`, error);
    }
  }

  // Create mapping table
  console.log('\n\nCourse-Branch Mapping Table:\n');
  console.log('='.repeat(150));
  
  const header = ['Code', 'Name', 'Credits', ...branches].join('\t| ');
  console.log(header);
  console.log('='.repeat(150));

  courses.forEach(course => {
    const row = [
      course.code.padEnd(8),
      course.name.substring(0, 35).padEnd(35),
      course.credits.toString().padEnd(2),
      ...branches.map(b => (course.branches[b] || 'N/A').padEnd(10))
    ].join('\t| ');
    console.log(row);
  });

  console.log('\n\nTotal courses added:', courses.length);
}

createCoursesTable()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
