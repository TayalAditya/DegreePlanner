import { normalizeBranchForIcBasket } from "@/lib/branchInfo";

// Shared IC Basket configuration — single source of truth for
// both the server-side credit calculator and the client-side ProgressChart.

export const ICB1_CODES = new Set(["IC131", "IC136", "IC230"]);

export const ICB2_CODES = new Set(["IC121", "IC240", "IC241", "IC253"]);

export const IC_BASKET_COMPULSIONS: Record<string, { ic1?: string; ic2?: string }> = {
  BIO: { ic1: "IC136", ic2: "IC240" },
  CE:  { ic1: "IC230", ic2: "IC240" },
  CS:  { ic2: "IC253" },
  CSE: { ic2: "IC253" },
  DSE: { ic2: "IC253" },
  EP:  { ic1: "IC230", ic2: "IC121" },
  ME:  { ic2: "IC240" },
  CH:  { ic1: "IC131", ic2: "IC121" },
  MNC: { ic1: "IC136", ic2: "IC253" },
  MS:  { ic1: "IC131", ic2: "IC241" },
  MSE: { ic1: "IC131", ic2: "IC241" },
  GE:  { ic1: "IC230", ic2: "IC240" },
  EE:  {},
  VLSI: {},
};

export { normalizeBranchForIcBasket };

// ---------------------------------------------------------------------------
// DE Basket configuration — branches that have named DE sub-baskets
// (e.g. MNC requires 1 course from Basket I + 1 course from Basket II)
// ---------------------------------------------------------------------------

export interface DEBasket {
  name: string;
  courses: { code: string; name: string; credits: number }[];
}

export const DE_BASKET_CONFIG: Record<string, DEBasket[]> = {
  MNC: [
    {
      name: "DE Basket I – Foundation",
      courses: [
        { code: "MA-251", name: "Abstract Algebra", credits: 3 },
        { code: "MA-252", name: "Functional Analysis", credits: 3 },
        { code: "MA-253", name: "Measure Theory", credits: 3 },
        { code: "MA-254", name: "Topology", credits: 3 },
        { code: "MA-255", name: "Number Theory", credits: 3 },
      ],
    },
    {
      name: "DE Basket II – Advance Modelling",
      courses: [
        { code: "MA-351", name: "Climate Modelling", credits: 3 },
        { code: "MA-352", name: "Computational Financial Modelling & Lab", credits: 3 },
        { code: "MA-353", name: "Modelling of Infectious Disease", credits: 3 },
        { code: "MA-354", name: "Mathematical Image Processing", credits: 3 },
        { code: "MA-355", name: "Mathematical Control Theory", credits: 3 },
        { code: "MA-356", name: "Modelling and Simulation", credits: 3 },
        { code: "MA-357", name: "Modelling Population Dynamics", credits: 3 },
      ],
    },
  ],
  // Add more branches here as needed
};
