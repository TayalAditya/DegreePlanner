import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import type { Adapter } from "next-auth/adapters";
import { getDepartmentForBranch, getProgramLookupBranchCode, inferBranchFromProgram } from "@/lib/branchInfo";
import { DOCS_ADMIN_ENROLLMENT_ID } from "@/lib/permissions";

const SUPPORTED_BATCHES = new Set([2022, 2023, 2024, 2025]);
const B22_ALLOWED_BRANCHES = new Set(["CSE"]);
const B24_ALLOWED_BRANCHES = new Set(["CSE", "DSE", "EE", "MEVLSI", "MSE", "BioE"]);
const ENROLLMENT_FALLBACK_ALLOWED_DOMAINS = new Set([
  "students.iitmandi.ac.in",
  "iitmandi.ac.in",
]);

type Batch24Student = {
  enrollmentId: string;
  name: string;
  branch: string;
  department: string | null;
};

type Batch22Student = {
  enrollmentId: string;
  name: string;
  branch: "CSE";
  department: string | null;
};

type Batch25Student = {
  enrollmentId: string;
  name: string;
  branch: string;
  department: string | null;
};

let batch24IndexPromise: Promise<Map<string, Batch24Student>> | null = null;
let batch22IndexPromise: Promise<Map<string, Batch22Student>> | null = null;
let batch25IndexPromise: Promise<Map<string, Batch25Student>> | null = null;

const parseNameFromBatch22Segment = (segment: string) => {
  let s = String(segment || "").replace(/\s+/g, " ").trim();
  if (!s) return null;

  // Common PDF extraction artifacts (row numbers / punctuation)
  s = s.replace(/^\d+\s+/, "");
  s = s.replace(/^[|,.;:-]+\s*/, "");

  // Remove common suffixes/headers if present
  s = s.replace(/\b(B\.?\s*TECH|B\.?\s*S\.?)\b.*$/i, "").trim();
  s = s.replace(/\b(COMPUTER\s+SCIENCE|CSE)\b.*$/i, "").trim();
  s = s.replace(/\bIIT\b.*$/i, "").trim();
  s = s.replace(/\bMANDI\b.*$/i, "").trim();

  // Trim trailing punctuation/digits
  s = s.replace(/[|,.;:-]+$/, "").trim();
  s = s.replace(/\d+$/, "").trim();

  // If any extra tokens leak in (page markers / footer text), keep the first clean chunk.
  const cut = s.search(/[0-9(]/);
  if (cut >= 0) s = s.slice(0, cut).trim();

  if (s.length < 2) return null;
  return s;
};

const loadBatch22Index = async () => {
  if (!batch22IndexPromise) {
    batch22IndexPromise = (async () => {
      try {
        const fs = await import("fs/promises");
        const path = await import("path");
        const pdfParse = (await import("pdf-parse")).default as any;

        const pdfPath = path.join(process.cwd(), "docs", "batch22cse.pdf");
        const buffer = await fs.readFile(pdfPath);
        const data = await pdfParse(buffer);
        const text = String(data?.text ?? "");

        const matches: Array<{ enrollmentId: string; index: number }> = [];
        const rollRe = /B22\d{3,}/gi;
        let m: RegExpExecArray | null;
        while ((m = rollRe.exec(text)) !== null) {
          matches.push({ enrollmentId: m[0].toUpperCase(), index: m.index });
        }

        const index = new Map<string, Batch22Student>();
        for (let i = 0; i < matches.length; i++) {
          const { enrollmentId, index: start } = matches[i];
          const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
          const raw = text.slice(start + enrollmentId.length, end);
          const name = parseNameFromBatch22Segment(raw);
          if (!name) continue;

          if (!index.has(enrollmentId)) {
            index.set(enrollmentId, {
              enrollmentId,
              name,
              branch: "CSE",
              department: getDepartmentForBranch("CSE"),
            });
          }
        }

        return index;
      } catch (err) {
        console.warn("Failed to load batch22 index:", err);
        return new Map<string, Batch22Student>();
      }
    })();
  }

  return batch22IndexPromise;
};

const loadBatch24Index = async () => {
  if (!batch24IndexPromise) {
    batch24IndexPromise = (async () => {
      try {
        const fs = await import("fs/promises");
        const path = await import("path");
        const pdfParse = (await import("pdf-parse")).default as any;

        const pdfPath = path.join(process.cwd(), "docs", "batch24.pdf");
        const buffer = await fs.readFile(pdfPath);
        const data = await pdfParse(buffer);
        const text = String(data?.text ?? "");

        const matches: Array<{ enrollmentId: string; index: number }> = [];
        const rollRe = /B24\d{3,}/gi;
        let m: RegExpExecArray | null;
        while ((m = rollRe.exec(text)) !== null) {
          matches.push({ enrollmentId: m[0].toUpperCase(), index: m.index });
        }

        const index = new Map<string, Batch24Student>();
        for (let i = 0; i < matches.length; i++) {
          const { enrollmentId, index: start } = matches[i];
          const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
          const raw = text.slice(start + enrollmentId.length, end);
          const normalized = raw.replace(/\s+/g, " ").trim();

          const programStart = normalized.search(/B\.?\s*Tech|B\.S\./i);
          if (programStart < 0) continue;

          const name = normalized.slice(0, programStart).trim();
          const programAndAfter = normalized.slice(programStart).trim();
          const closingParen = programAndAfter.indexOf(")");
          const program = closingParen >= 0 ? programAndAfter.slice(0, closingParen + 1).trim() : programAndAfter;

          const branch = inferBranchFromProgram(program);
          if (!branch || !B24_ALLOWED_BRANCHES.has(branch)) continue;

          if (!index.has(enrollmentId)) {
            index.set(enrollmentId, {
              enrollmentId,
              name,
              branch,
              department: getDepartmentForBranch(branch),
            });
          }
        }

        return index;
      } catch (err) {
        console.warn("Failed to load batch24 index:", err);
        return new Map<string, Batch24Student>();
      }
    })();
  }
  return batch24IndexPromise;
};

const loadBatch25Index = async () => {
  if (!batch25IndexPromise) {
    batch25IndexPromise = (async () => {
      try {
        const path = await import("path");
        const XLSX = await import("xlsx");

        const xlsxPath = path.join(process.cwd(), "public", "data", "b25-students.xlsx");
        const workbook = XLSX.readFile(xlsxPath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][];

        const index = new Map<string, Batch25Student>();
        for (const row of rows.slice(1)) {
          const enrollmentId = String(row[0] || "").trim().toUpperCase();
          const name = String(row[1] || "").trim();
          const program = String(row[2] || "").trim();
          if (!/^B25\d+$/i.test(enrollmentId)) continue;

          const branch = inferBranchFromProgram(program);
          if (!branch) continue;

          if (!index.has(enrollmentId)) {
            index.set(enrollmentId, {
              enrollmentId,
              name,
              branch,
              department: getDepartmentForBranch(branch),
            });
          }
        }

        return index;
      } catch (err) {
        console.warn("Failed to load batch25 index:", err);
        return new Map<string, Batch25Student>();
      }
    })();
  }

  return batch25IndexPromise;
};

const maybeAutoApproveBatch24 = async (email: string, enrollmentId: string) => {
  const index = await loadBatch24Index();
  const student = index.get(enrollmentId.toUpperCase());
  if (!student) return null;

  return prisma.approvedUser.upsert({
    where: { enrollmentId: student.enrollmentId },
    update: {
      email,
      name: student.name,
      department: student.department,
      branch: student.branch,
      batch: 2024,
      allowedPrograms: [student.branch],
    },
    create: {
      email,
      enrollmentId: student.enrollmentId,
      name: student.name,
      department: student.department,
      branch: student.branch,
      batch: 2024,
      allowedPrograms: [student.branch],
    },
  });
};

const maybeAutoApproveBatch22Cse = async (email: string, enrollmentId: string) => {
  const index = await loadBatch22Index();
  const student = index.get(enrollmentId.toUpperCase());
  if (!student) return null;

  return prisma.approvedUser.upsert({
    where: { enrollmentId: student.enrollmentId },
    update: {
      email,
      name: student.name,
      department: student.department,
      branch: student.branch,
      batch: 2022,
      allowedPrograms: [student.branch],
    },
    create: {
      email,
      enrollmentId: student.enrollmentId,
      name: student.name,
      department: student.department,
      branch: student.branch,
      batch: 2022,
      allowedPrograms: [student.branch],
    },
  });
};

const maybeAutoApproveBatch25 = async (email: string, enrollmentId: string) => {
  const normalizedEnrollmentId = enrollmentId.toUpperCase();
  const index = await loadBatch25Index();
  const student = index.get(normalizedEnrollmentId);
  const branch = student?.branch || null;
  const department = student?.department || null;
  const name = student?.name || null;
  const allowedPrograms = branch ? [getProgramLookupBranchCode(branch)] : [];

  return prisma.approvedUser.upsert({
    where: { enrollmentId: normalizedEnrollmentId },
    update: {
      email,
      name,
      department,
      branch,
      batch: 2025,
      allowedPrograms,
    },
    create: {
      email,
      enrollmentId: normalizedEnrollmentId,
      name,
      department,
      branch,
      batch: 2025,
      allowedPrograms,
    },
  });
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: "openid email profile https://www.googleapis.com/auth/calendar.events",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) {
        console.log("❌ No email provided");
        return false;
      }

      console.log("🔐 signIn callback - email:", user.email);

      // Always persist the latest OAuth tokens to the Account row.
      // linkAccount() is only called on first login; on re-login the adapter
      // skips it (unique constraint), so refresh_token would stay stale/null.
      if (account?.provider === "google") {
        try {
          await prisma.account.update({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
            data: {
              access_token: account.access_token,
              ...(account.refresh_token ? { refresh_token: account.refresh_token } : {}),
              expires_at: account.expires_at,
              id_token: account.id_token ?? undefined,
              scope: account.scope ?? undefined,
            },
          });
          console.log("✅ Account tokens refreshed in DB");
        } catch {
          // Account row doesn't exist yet (first login) — linkAccount will create it
        }
      }

      // Check if user is approved by email (direct match)
      let approvedUser = await prisma.approvedUser.findUnique({
        where: { email: user.email },
      });

      // Fallback: look up by enrollmentId extracted from email prefix
      if (!approvedUser) {
        const [rawPrefix, rawDomain] = user.email.split("@");
        const emailPrefix = (rawPrefix || "").toUpperCase();
        const emailDomain = (rawDomain || "").toLowerCase();
        const matches = emailPrefix.match(/^B(22|23|24|25)\d+$/i);
        const canUseEnrollmentFallback =
          Boolean(matches) && ENROLLMENT_FALLBACK_ALLOWED_DOMAINS.has(emailDomain);

        if (canUseEnrollmentFallback) {
          approvedUser = await prisma.approvedUser.findUnique({
            where: { enrollmentId: emailPrefix },
          });
          
          // Update email in ApprovedUser to match Google account
          if (approvedUser) {
            await prisma.approvedUser.update({
              where: { enrollmentId: emailPrefix },
              data: { email: user.email },
            });
          } else if (/^B25\d+$/i.test(emailPrefix)) {
            approvedUser = await maybeAutoApproveBatch25(user.email, emailPrefix);
          } else if (/^B24\d+$/i.test(emailPrefix)) {
            approvedUser = await maybeAutoApproveBatch24(user.email, emailPrefix);
          } else if (/^B22\d+$/i.test(emailPrefix)) {
            approvedUser = await maybeAutoApproveBatch22Cse(user.email, emailPrefix);
          }
        }
      }

      if (!approvedUser) {
        console.log("❌ Login rejected: User not in approved list");
        return "/auth/error?error=user_not_approved";
      }

      // Batch validation
      if (approvedUser.batch && !SUPPORTED_BATCHES.has(approvedUser.batch)) {
        console.log("❌ Login rejected: Batch", approvedUser.batch, "not supported");
        return "/auth/error?error=batch_not_supported";
      }

      // Branch validation (batch-specific): allow only selected branches for B24
      const enrollmentId = (approvedUser.enrollmentId || "").toUpperCase();
      const isB24 = approvedUser.batch === 2024 || /^B24\d+$/i.test(enrollmentId);
      if (isB24 && !B24_ALLOWED_BRANCHES.has(approvedUser.branch || "")) {
        console.log("❌ Login rejected: Branch", approvedUser.branch, "not allowed for B24");
        return "/auth/error?error=branch_not_allowed";
      }

      const isB22 = approvedUser.batch === 2022 || /^B22\d+$/i.test(enrollmentId);
      if (isB22 && !B22_ALLOWED_BRANCHES.has(approvedUser.branch || "")) {
        console.log("Login rejected: Branch", approvedUser.branch, "not allowed for B22");
        return "/auth/error?error=branch_not_allowed";
      }

      console.log("✅ signIn: User approved, allowing login");
      return true;
    },
    async jwt({ token, user, account }) {
      // On first sign in (user object exists)
      if (user && user.email) {
        console.log("📝 jwt callback - new user:", user.email);
        
        try {
          // Get approved user data
          let approvedUser = await prisma.approvedUser.findUnique({
            where: { email: user.email },
          });
          
          if (!approvedUser) {
            const emailPrefix = user.email.split("@")[0].toUpperCase();
            approvedUser = await prisma.approvedUser.findUnique({
              where: { enrollmentId: emailPrefix },
            });
          }

          if (approvedUser) {
            const isDocumentsAdmin = (approvedUser.enrollmentId || "").toUpperCase() === DOCS_ADMIN_ENROLLMENT_ID;
            
            // Store in token
            token.isApproved = true;
            token.role = isDocumentsAdmin ? "ADMIN" : "STUDENT";
            token.enrollmentId = approvedUser.enrollmentId;
            token.department = approvedUser.department;
            token.branch = approvedUser.branch;
            token.batch = approvedUser.batch;

            // Ensure user in database (PrismaAdapter should have created it)
            try {
              await prisma.user.update({
                where: { email: user.email },
                data: {
                  isApproved: true,
                  role: isDocumentsAdmin ? "ADMIN" : "STUDENT",
                  enrollmentId: approvedUser.enrollmentId,
                  department: approvedUser.department,
                  branch: approvedUser.branch,
                  batch: approvedUser.batch,
                },
              });
            } catch (err) {
              // User might not exist yet if PrismaAdapter hasn't run
              console.log("User update failed (expected on first login)");
            }
            
            // Auto-enroll in program
            if (approvedUser.branch) {
              try {
                const dbUser = await prisma.user.findUnique({
                  where: { email: user.email },
                  select: { id: true },
                });
                
                if (dbUser) {
                  let program = await prisma.program.findUnique({
                    where: { code: approvedUser.branch || "" },
                  });
                  if (!program) {
                    program = await prisma.program.findUnique({
                      where: { code: getProgramLookupBranchCode(approvedUser.branch) },
                    });
                  }
                  
                  if (program) {
                    const alreadyEnrolled = await prisma.userProgram.findFirst({
                      where: { userId: dbUser.id, programId: program.id },
                    });
                    
                    if (!alreadyEnrolled) {
                      await prisma.userProgram.create({
                        data: {
                          userId: dbUser.id,
                          programId: program.id,
                          programType: "MAJOR",
                          isPrimary: true,
                          startSemester: 1,
                          status: "ACTIVE",
                        },
                      });
                    }
                  }
                }
              } catch (err) {
                console.log("Program enrollment failed (expected on first login)");
              }
            }
          }
        } catch (error: any) {
          console.log("JWT callback error:", error.message);
        }
      }
      
      return token;
    },
    async session({ session, user, token }) {
      if (session.user) {
        // In JWT strategy, user data comes from token
        if (token) {
          session.user.id = token.sub || user?.id || "";
          session.user.isApproved = (token as any).isApproved || false;
          session.user.role = (token as any).role || "STUDENT";
          session.user.enrollmentId = (token as any).enrollmentId;
          session.user.department = (token as any).department;
          session.user.branch = (token as any).branch;
          session.user.batch = (token as any).batch;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 365 * 24 * 60 * 60, // 1 year
    updateAge: 7 * 24 * 60 * 60, // refresh token every 7 days (not on every request)
  },
};
