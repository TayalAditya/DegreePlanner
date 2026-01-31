// Branch configurations for different engineering departments
export interface BranchConfig {
  code: string;
  name: string;
  fullName: string;
  type: 'BTech' | 'BS';
  totalCredits: number;
  coreCredits: number;
  dcCredits: number; // Departmental Core
  deCredits: number; // Discipline Electives
  feCredits: number; // Free Electives
  peCredits?: number; // Program Electives
  mtpCredits: number;
  istpCredits?: number;
  minCreditsForMTP: number;
  minSemesterForMTP: number;
}

export const BRANCH_CONFIGS: Record<string, BranchConfig> = {
  CSE: {
    code: 'CSE',
    name: 'Computer Science',
    fullName: 'Computer Science and Engineering',
    type: 'BTech',
    totalCredits: 160,
    coreCredits: 80,
    dcCredits: 24,
    deCredits: 24,
    feCredits: 16,
    peCredits: 10,
    mtpCredits: 6,
    istpCredits: 6,
    minCreditsForMTP: 120,
    minSemesterForMTP: 7,
  },
  ECE: {
    code: 'ECE',
    name: 'Electronics & Communication',
    fullName: 'Electronics and Communication Engineering',
    type: 'BTech',
    totalCredits: 160,
    coreCredits: 82,
    dcCredits: 22,
    deCredits: 24,
    feCredits: 16,
    peCredits: 10,
    mtpCredits: 6,
    minCreditsForMTP: 120,
    minSemesterForMTP: 7,
  },
  EEE: {
    code: 'EEE',
    name: 'Electrical & Electronics',
    fullName: 'Electrical and Electronics Engineering',
    type: 'BTech',
    totalCredits: 160,
    coreCredits: 80,
    dcCredits: 24,
    deCredits: 24,
    feCredits: 16,
    peCredits: 10,
    mtpCredits: 6,
    minCreditsForMTP: 120,
    minSemesterForMTP: 7,
  },
  MECH: {
    code: 'MECH',
    name: 'Mechanical',
    fullName: 'Mechanical Engineering',
    type: 'BTech',
    totalCredits: 160,
    coreCredits: 84,
    dcCredits: 20,
    deCredits: 24,
    feCredits: 16,
    peCredits: 10,
    mtpCredits: 6,
    minCreditsForMTP: 120,
    minSemesterForMTP: 7,
  },
  CIVIL: {
    code: 'CIVIL',
    name: 'Civil',
    fullName: 'Civil Engineering',
    type: 'BTech',
    totalCredits: 160,
    coreCredits: 82,
    dcCredits: 22,
    deCredits: 24,
    feCredits: 16,
    peCredits: 10,
    mtpCredits: 6,
    minCreditsForMTP: 120,
    minSemesterForMTP: 7,
  },
  CHE: {
    code: 'CHE',
    name: 'Chemical',
    fullName: 'Chemical Engineering',
    type: 'BTech',
    totalCredits: 160,
    coreCredits: 86,
    dcCredits: 20,
    deCredits: 22,
    feCredits: 16,
    peCredits: 10,
    mtpCredits: 6,
    minCreditsForMTP: 120,
    minSemesterForMTP: 7,
  },
  BIO: {
    code: 'BIO',
    name: 'Biotechnology',
    fullName: 'Biotechnology',
    type: 'BTech',
    totalCredits: 160,
    coreCredits: 80,
    dcCredits: 24,
    deCredits: 24,
    feCredits: 16,
    peCredits: 10,
    mtpCredits: 6,
    minCreditsForMTP: 120,
    minSemesterForMTP: 7,
  },
  PHARMA: {
    code: 'PHARMA',
    name: 'Pharmacy',
    fullName: 'Pharmacy',
    type: 'BTech',
    totalCredits: 160,
    coreCredits: 88,
    dcCredits: 20,
    deCredits: 20,
    feCredits: 16,
    peCredits: 10,
    mtpCredits: 6,
    minCreditsForMTP: 120,
    minSemesterForMTP: 7,
  },
  ENI: {
    code: 'ENI',
    name: 'Electronics & Instrumentation',
    fullName: 'Electronics and Instrumentation Engineering',
    type: 'BTech',
    totalCredits: 160,
    coreCredits: 80,
    dcCredits: 24,
    deCredits: 24,
    feCredits: 16,
    peCredits: 10,
    mtpCredits: 6,
    minCreditsForMTP: 120,
    minSemesterForMTP: 7,
  },
  CHEM: {
    code: 'CHEM',
    name: 'Chemistry',
    fullName: 'Chemistry',
    type: 'BTech',
    totalCredits: 160,
    coreCredits: 82,
    dcCredits: 22,
    deCredits: 24,
    feCredits: 16,
    peCredits: 10,
    mtpCredits: 6,
    minCreditsForMTP: 120,
    minSemesterForMTP: 7,
  },
  MATH: {
    code: 'MATH',
    name: 'Mathematics',
    fullName: 'Mathematics',
    type: 'BTech',
    totalCredits: 160,
    coreCredits: 78,
    dcCredits: 26,
    deCredits: 24,
    feCredits: 16,
    peCredits: 10,
    mtpCredits: 6,
    minCreditsForMTP: 120,
    minSemesterForMTP: 7,
  },
  // BS Branch (standalone with different structure)
  BS: {
    code: 'BS',
    name: 'General Sciences',
    fullName: 'Bachelor of Science',
    type: 'BS',
    totalCredits: 128,
    coreCredits: 60,
    dcCredits: 20,
    deCredits: 20,
    feCredits: 20,
    peCredits: 8,
    mtpCredits: 0,
    istpCredits: 0,
    minCreditsForMTP: 0,
    minSemesterForMTP: 0,
  },
};

export const getAllBranches = () => Object.values(BRANCH_CONFIGS);

export const getBranchByCode = (code: string): BranchConfig | undefined => {
  return BRANCH_CONFIGS[code];
};

export const getBranchTypes = () => {
  return Array.from(new Set(Object.values(BRANCH_CONFIGS).map(b => b.type)));
};
