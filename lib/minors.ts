export type MinorRequirementGroup = {
  id: string;
  title: string;
  requiredCount: number;
  courseCodes: string[];
  countsTowardMinor: boolean;
  note?: string;
};

export type MinorDefinition = {
  code: string;
  name: string;
  totalCreditsRequired?: number;
  groups: MinorRequirementGroup[];
};

export const MINORS: MinorDefinition[] = [
  {
    code: "MGMT",
    name: "Minor in Management",
    totalCreditsRequired: 12,
    groups: [
      {
        id: "prereq-ic252",
        title: "Prerequisite: IC-252",
        requiredCount: 1,
        courseCodes: ["IC-252"],
        countsTowardMinor: false,
      },
      {
        id: "prereq-comm",
        title: "Prerequisite: Communicative Competence",
        requiredCount: 1,
        courseCodes: [],
        countsTowardMinor: false,
        note: "Add the approved Communicative Competence course codes here.",
      },
      {
        id: "core",
        title: "Core",
        requiredCount: 2,
        courseCodes: ["HS-202", "HS-304"],
        countsTowardMinor: true,
      },
      {
        id: "electives",
        title: "Electives",
        requiredCount: 2,
        courseCodes: [],
        countsTowardMinor: true,
        note: "Add Management minor elective course codes here (you need any 2).",
      },
    ],
  },
];

