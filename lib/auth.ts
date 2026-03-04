import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import type { Adapter } from "next-auth/adapters";
import { DOCS_ADMIN_ENROLLMENT_ID } from "@/lib/permissions";

const SUPPORTED_BATCHES = new Set([2022, 2023, 2024]);
const B24_ALLOWED_BRANCHES = new Set(["CSE", "DSE", "EE", "MEVLSI", "MSE"]);
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

const departmentForBranch = (branch: string) => {
  switch (branch) {
    case "CSE":
    case "DSE":
    case "EE":
    case "MEVLSI":
      return "School of Computing & Electrical Engineering";
    case "MSE":
      return "School of Mechanical and Materials Engineering";
    default:
      return null;
  }
};

const inferBranchFromProgram = (program: string) => {
  const normalized = program.toLowerCase();
  if (normalized.includes("computer science")) return "CSE";
  if (normalized.includes("data science")) return "DSE";
  if (normalized.includes("electrical")) return "EE";
  if (normalized.includes("microelectronics") || normalized.includes("vlsi")) return "MEVLSI";
  if (normalized.includes("materials science")) return "MSE";
  return null;
};

let batch24IndexPromise: Promise<Map<string, Batch24Student>> | null = null;

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
              department: departmentForBranch(branch),
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
        const matches = emailPrefix.match(/^B(22|23|24)\d+$/i);
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
          } else if (/^B24\d+$/i.test(emailPrefix)) {
            approvedUser = await maybeAutoApproveBatch24(user.email, emailPrefix);
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
                  const program = await prisma.program.findUnique({ 
                    where: { code: approvedUser.branch } 
                  });
                  
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
