export interface FacultyAdvisor {
  name: string;
  email: string;
}

const BATCH_23_FACULTY_ADVISORS: Record<string, FacultyAdvisor> = {
  CE: { name: "Dr. Vivek Gupta", email: "vivekgupta@iitmandi.ac.in" },
  CSE: { name: "Dr. Varun Kumar Jayapaul", email: "varunkumar@iitmandi.ac.in" },
  EE: { name: "Dr. Moumita Das", email: "moumita@iitmandi.ac.in" },
  ME: { name: "Dr. Deepak Sachan", email: "dsachan@iitmandi.ac.in" },
  DSE: { name: "Dr. Dinesh Singh", email: "dineshsingh@iitmandi.ac.in" },
  EP: { name: "Dr. Nirmalya Kajuri", email: "nirmalya@iitmandi.ac.in" },
  BE: { name: "Dr. Baskar Bakthavachalu", email: "baskar@iitmandi.ac.in" },
  GE: { name: "Dr. Gajendra Singh", email: "gajendra@iitmandi.ac.in" },
  MSE: { name: "Prof. Rahul Vaish", email: "rahul@iitmandi.ac.in" },
  MEVLSI: { name: "Dr. Robin Khosla", email: "robin@iitmandi.ac.in" },
  MNC: { name: "Dr. Muslim Malik", email: "muslim@iitmandi.ac.in" },
  BSCS: { name: "Dr. Bhaskar Mondal", email: "bhaskarmondal@iitmandi.ac.in" },
};

function batch23AdvisorKey(branch: string | null | undefined): string | null {
  const normalized = String(branch ?? "").trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "CS" || normalized === "CSE") return "CSE";
  if (normalized === "DS" || normalized === "DSE" || normalized === "DSAI") return "DSE";
  if (normalized === "BIO" || normalized === "BE") return "BE";
  if (normalized === "MC" || normalized === "MNC") return "MNC";
  if (normalized === "MS" || normalized === "MSE") return "MSE";
  if (normalized === "VL" || normalized === "VLSI" || normalized === "MEVLSI") return "MEVLSI";
  if (normalized === "BS" || normalized === "BSCS") return "BSCS";
  if (normalized === "GE" || normalized.startsWith("GE-")) return "GE";
  return BATCH_23_FACULTY_ADVISORS[normalized] ? normalized : null;
}

/** Faculty Advisors supplied for the B23 branch cohorts only. */
export function getBatch23FacultyAdvisor(
  branch: string | null | undefined,
  batch: number | null | undefined
): FacultyAdvisor | null {
  if (batch !== 2023) return null;
  const key = batch23AdvisorKey(branch);
  return key ? BATCH_23_FACULTY_ADVISORS[key] ?? null : null;
}
