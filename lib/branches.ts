// Branch configurations - Based on official IIT Mandi curriculum (PDF: Academic Discussion B.Tech & B.S. 2023)
// B.Tech: Total 160 credits = IC(60) + DC+DE(66) + FE(22) + MTP/ISTP(12)  [most branches]
// B.Tech EE: Total 161 credits = IC(60) + DC+DE(72) + FE(17) + MTP/ISTP(12)  [special case]
// B.S.-CS: Total 163 credits = IC(52) + DC+DE(82) + FE(15) + Research(14)
// DC-DE split per branch from PDF page 18 table

export interface BranchConfig {
  code: string;
  name: string;
  fullName: string;
  type: 'BTech' | 'BS';
  totalCredits: number;
  icCredits: number; // Institute Core (fixed per program type)
  dcCredits: number; // Discipline Core
  deCredits: number; // Discipline Electives
  feCredits: number; // Free Electives
  mtpIstpCredits: number; // MTP + ISTP combined (or Research for BS)
  minCreditsForMTP: number;
  minSemesterForMTP: number;
}

export const BRANCH_CONFIGS: Record<string, BranchConfig> = {
  // B.Tech Programs - All have IC=60, MTP/ISTP=12, most have FE=22 (except EE=17)

  CSE: {
    code: 'CSE',
    name: 'Computer Science & Engineering',
    fullName: 'B.Tech in Computer Science & Engineering',
    type: 'BTech',
    totalCredits: 160,
    icCredits: 60,    // IC Compulsory(39) + IC Basket(6) + HSS(12) + IKS(3)
    dcCredits: 38,    // Discipline Core
    deCredits: 28,    // Discipline Electives
    feCredits: 22,    // Free Electives
    mtpIstpCredits: 12, // MTP(8) + ISTP(4)
    minCreditsForMTP: 90,
    minSemesterForMTP: 7,  // MTP in final year (Semesters 7 & 8)
  },

  DSE: {
    code: 'DSE',
    name: 'Data Science & Engineering',
    fullName: 'B.Tech in Data Science & Engineering',
    type: 'BTech',
    totalCredits: 160,
    icCredits: 60,
    dcCredits: 33,
    deCredits: 33,
    feCredits: 22,
    mtpIstpCredits: 12,
    minCreditsForMTP: 90,
    minSemesterForMTP: 7,  // MTP in final year (Semesters 7 & 8)
  },

  MEVLSI: {
    code: 'MEVLSI',
    name: 'Microelectronics & VLSI',
    fullName: 'B.Tech in Microelectronics & VLSI',
    type: 'BTech',
    totalCredits: 160,
    icCredits: 60,
    dcCredits: 54,
    deCredits: 12,
    feCredits: 22,
    mtpIstpCredits: 12,
    minCreditsForMTP: 90,
    minSemesterForMTP: 7,  // MTP in final year (Semesters 7 & 8)
  },

  EE: {
    code: 'EE',
    name: 'Electrical Engineering',
    fullName: 'B.Tech in Electrical Engineering',
    type: 'BTech',
    totalCredits: 161, // EE is 161 credits (special case per PDF page 3)
    icCredits: 60,
    dcCredits: 52,    // DC=52
    deCredits: 20,    // DE=20, DC+DE=72 total
    feCredits: 17,    // FE=17 (SPECIAL: not 22)
    mtpIstpCredits: 12,
    minCreditsForMTP: 90,
    minSemesterForMTP: 7,  // MTP in final year (Semesters 7 & 8)
  },

  MNC: {
    code: 'MNC',
    name: 'Mathematics & Computing',
    fullName: 'B.Tech in Mathematics & Computing',
    type: 'BTech',
    totalCredits: 160,
    icCredits: 60,
    dcCredits: 51,
    deCredits: 15,
    feCredits: 22,
    mtpIstpCredits: 12,
    minCreditsForMTP: 90,
    minSemesterForMTP: 7,  // MTP in final year (Semesters 7 & 8)
  },

  CE: {
    code: 'CE',
    name: 'Civil Engineering',
    fullName: 'B.Tech in Civil Engineering',
    type: 'BTech',
    totalCredits: 160,
    icCredits: 60,
    dcCredits: 49,
    deCredits: 17,
    feCredits: 22,
    mtpIstpCredits: 12,
    minCreditsForMTP: 90,
    minSemesterForMTP: 7,  // MTP in final year (Semesters 7 & 8)
  },

  BE: {
    code: 'BE',
    name: 'Bioengineering',
    fullName: 'B.Tech in Bioengineering',
    type: 'BTech',
    totalCredits: 160,
    icCredits: 60,
    dcCredits: 42,
    deCredits: 24,
    feCredits: 22,
    mtpIstpCredits: 12,
    minCreditsForMTP: 90,
    minSemesterForMTP: 7,  // MTP in final year (Semesters 7 & 8)
  },

  EP: {
    code: 'EP',
    name: 'Engineering Physics',
    fullName: 'B.Tech in Engineering Physics',
    type: 'BTech',
    totalCredits: 160,
    icCredits: 60,
    dcCredits: 37,
    deCredits: 29,
    feCredits: 22,
    mtpIstpCredits: 12,
    minCreditsForMTP: 90,
    minSemesterForMTP: 7,  // MTP in final year (Semesters 7 & 8)
  },

  GE: {
    code: 'GE',
    name: 'General Engineering',
    fullName: 'B.Tech in General Engineering',
    type: 'BTech',
    totalCredits: 160,
    icCredits: 60,
    dcCredits: 36,
    deCredits: 30,
    feCredits: 22,
    mtpIstpCredits: 12,
    minCreditsForMTP: 90,
    minSemesterForMTP: 7,  // MTP in final year (Semesters 7 & 8)
  },

  ME: {
    code: 'ME',
    name: 'Mechanical Engineering',
    fullName: 'B.Tech in Mechanical Engineering',
    type: 'BTech',
    totalCredits: 160,
    icCredits: 60,
    dcCredits: 50,
    deCredits: 16,
    feCredits: 22,
    mtpIstpCredits: 12,
    minCreditsForMTP: 90,
    minSemesterForMTP: 7,  // MTP in final year (Semesters 7 & 8)
  },

  MSE: {
    code: 'MSE',
    name: 'Materials Science & Engineering',
    fullName: 'B.Tech in Materials Science & Engineering',
    type: 'BTech',
    totalCredits: 160,
    icCredits: 60,
    dcCredits: 45,
    deCredits: 21,
    feCredits: 22,
    mtpIstpCredits: 12,
    minCreditsForMTP: 90,
    minSemesterForMTP: 7,  // MTP in final year (Semesters 7 & 8)
  },

  // BS Program - Different structure
  BSCS: {
    code: 'BSCS',
    name: 'Chemical Sciences',
    fullName: 'B.S. in Chemical Sciences',
    type: 'BS',
    totalCredits: 163,
    icCredits: 52,    // IC Compulsory(31) + IC Basket(6) + HSS(12) + IKS(3)
    dcCredits: 59,    // Discipline Core (DC only, per PDF page 18 DC-DE split table)
    deCredits: 23,    // Discipline Electives (DC+DE=82 total per PDF)
    feCredits: 15,    // Free Electives (lowest)
    mtpIstpCredits: 14, // Research & Communication Projects (not MTP/ISTP)
    minCreditsForMTP: 0, // No MTP requirement for BS
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
