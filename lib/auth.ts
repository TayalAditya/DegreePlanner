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
      allowDangerousEmailAccountLinking: true, // Allow linking if user manually provides same email
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) {
        console.log("❌ No email provided");
        return false;
      }

      console.log("🔐 Login attempt with email:", user.email);
      console.log("Account provider:", account?.provider);
      console.log("Profile:", profile?.email);

      // Check if user is approved by email (direct match)
      let approvedUser = await prisma.approvedUser.findUnique({
        where: { email: user.email },
      });

      console.log("Direct email match:", approvedUser ? "✅ Found" : "❌ Not found");

      // Fallback: look up by enrollmentId extracted from email prefix
      if (!approvedUser) {
        const emailPrefix = user.email.split("@")[0].toUpperCase();
        console.log("Email prefix:", emailPrefix);
        
        const matches = emailPrefix.match(/^B23\d+$/i);
        console.log("Regex match:", matches ? "✅ Matches" : "❌ No match");
        
        if (matches) {
          console.log("Looking up enrollmentId:", emailPrefix);
          approvedUser = await prisma.approvedUser.findUnique({
            where: { enrollmentId: emailPrefix },
          });
          console.log("EnrollmentId lookup:", approvedUser ? "✅ Found" : "❌ Not found");
          
          if (approvedUser) {
            await prisma.approvedUser.update({
              where: { enrollmentId: emailPrefix },
              data: { email: user.email },
            });
            console.log("✅ Updated ApprovedUser email to:", user.email);
          }
        }
      }

      if (!approvedUser) {
        console.log("❌ Login rejected: User not in approved list");
        return false; // Return false instead of redirect - let error page handle it
      }

      console.log("Approved user batch:", approvedUser.batch);

      // Batch validation
      if (approvedUser.batch && approvedUser.batch !== 2023) {
        console.log("❌ Login rejected: Batch", approvedUser.batch, "not supported");
        return false;
      }

      console.log("✅ Batch validation passed");
      return true; // Allow the login
    },
    async jwt({ token, user, account }) {
      // This runs after PrismaAdapter creates the user
      if (user && user.email) {
        console.log("📝 JWT callback - user created/found:", user.email);
        
        // Now update the user with approval data
        let approvedUser = await prisma.approvedUser.findUnique({
          where: { email: user.email },
        });
        
        if (!approvedUser) {
          const emailPrefix = user.email.split("@")[0].toUpperCase();
          const matches = emailPrefix.match(/^B23\d+$/i);
          if (matches) {
            approvedUser = await prisma.approvedUser.findUnique({
              where: { enrollmentId: emailPrefix },
            });
          }
        }

        if (approvedUser) {
          const isDocumentsAdmin = (approvedUser.enrollmentId || "").toUpperCase() === DOCS_ADMIN_ENROLLMENT_ID;
          
          // Update the user with enrollment data
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
          console.log("✅ Updated user with enrollment data");

          // Auto-enroll in branch program
          if (approvedUser.branch) {
            const program = await prisma.program.findUnique({ where: { code: approvedUser.branch } });
            if (program) {
              const alreadyEnrolled = await prisma.userProgram.findFirst({
                where: { userId: user.id, programId: program.id },
              });
              if (!alreadyEnrolled) {
                await prisma.userProgram.create({
                  data: {
                    userId: user.id,
                    programId: program.id,
                    programType: "MAJOR",
                    isPrimary: true,
                    startSemester: 1,
                    status: "ACTIVE",
                  },
                });
                console.log("✅ Auto-enrolled in program:", approvedUser.branch);
              }
            }
          }
        }
      }
      return token;
    },
    async session({ session, user }) {
      if (session.user) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email! },
          select: {
            id: true,
            isApproved: true,
            role: true,
            enrollmentId: true,
            department: true,
            branch: true,
            batch: true,
          },
        });

        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.isApproved = dbUser.isApproved;
          session.user.role = dbUser.role;
          session.user.enrollmentId = dbUser.enrollmentId;
          session.user.department = dbUser.department;
          session.user.branch = dbUser.branch;
          session.user.batch = dbUser.batch;
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
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
