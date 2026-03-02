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

/** Normalizes branch aliases that share the same IC basket compulsion. */
export const normalizeBranchForIcBasket = (branch?: string): string => {
  const upper = String(branch || "").toUpperCase();
  if (upper === "BE") return "BIO";
  if (upper === "MEVLSI" || upper === "VL") return "VLSI";
  return upper;
};
