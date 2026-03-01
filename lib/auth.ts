import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import type { Adapter } from "next-auth/adapters";
import { DOCS_ADMIN_ENROLLMENT_ID } from "@/lib/permissions";

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

      // Check if user is approved by email (direct match)
      let approvedUser = await prisma.approvedUser.findUnique({
        where: { email: user.email },
      });

      // Fallback: look up by enrollmentId extracted from email prefix
      if (!approvedUser) {
        const emailPrefix = user.email.split("@")[0].toUpperCase();
        const matches = emailPrefix.match(/^B23\d+$/i);
        
        if (matches) {
          approvedUser = await prisma.approvedUser.findUnique({
            where: { enrollmentId: emailPrefix },
          });
          
          // Update email in ApprovedUser to match Google account
          if (approvedUser) {
            await prisma.approvedUser.update({
              where: { enrollmentId: emailPrefix },
              data: { email: user.email },
            });
          }
        }
      }

      if (!approvedUser) {
        console.log("❌ Login rejected: User not in approved list");
        return false;
      }

      // Batch validation
      if (approvedUser.batch && approvedUser.batch !== 2023) {
        console.log("❌ Login rejected: Batch", approvedUser.batch, "not supported");
        return false;
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
