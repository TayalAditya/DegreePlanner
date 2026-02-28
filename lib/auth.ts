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
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;

      console.log("🔐 Login attempt with email:", user.email);

      // Check if user is approved by email (direct match)
      let approvedUser = await prisma.approvedUser.findUnique({
        where: { email: user.email },
      });

      console.log("Direct email match:", approvedUser ? "✅ Found" : "❌ Not found");

      // Fallback: look up by enrollmentId extracted from email prefix
      // e.g. b23243@students.iitmandi.ac.in → enrollmentId = B23243
      // Only allows emails that START with b23XXX
      if (!approvedUser) {
        const emailPrefix = user.email.split("@")[0].toUpperCase();
        console.log("Email prefix:", emailPrefix);
        
        // Only match if email starts with B23 followed by digits
        const matches = emailPrefix.match(/^B23\d+$/i);
        console.log("Regex match:", matches ? "✅ Matches" : "❌ No match");
        
        if (matches) {
          console.log("Looking up enrollmentId:", emailPrefix);
          approvedUser = await prisma.approvedUser.findUnique({
            where: { enrollmentId: emailPrefix },
          });
          console.log("EnrollmentId lookup:", approvedUser ? "✅ Found" : "❌ Not found");
          
          // If found by enrollmentId, update the ApprovedUser email to match Google email
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
        return "/auth/error?error=batch_not_supported";
      }

      console.log("Approved user batch:", approvedUser.batch);

      // Batch validation: Only Batch 2023 students allowed
      if (approvedUser.batch && approvedUser.batch !== 2023) {
        console.log("❌ Login rejected: Batch", approvedUser.batch, "not supported");
        return "/auth/error?error=batch_not_supported";
      }

      console.log("✅ Batch validation passed");

      const isDocumentsAdmin = (approvedUser.enrollmentId || "").toUpperCase() === DOCS_ADMIN_ENROLLMENT_ID;

      // Let PrismaAdapter handle account linking - just ensure user data is updated
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (existingUser) {
        const updates: any = {};

        if (!existingUser.isApproved) {
          updates.isApproved = true;
          updates.enrollmentId = approvedUser.enrollmentId;
          updates.department = approvedUser.department;
          updates.branch = approvedUser.branch;
          updates.batch = approvedUser.batch;
        }

        if (isDocumentsAdmin && existingUser.role !== "ADMIN") {
          updates.role = "ADMIN";
        }

        if (Object.keys(updates).length > 0) {
          await prisma.user.update({
            where: { email: user.email },
            data: updates,
          });
        }
      } else {
        // Create user (PrismaAdapter will link the account automatically)
        await prisma.user.create({
          data: {
            email: user.email,
            name: user.name || approvedUser.enrollmentId,
            image: user.image,
            isApproved: true,
            role: isDocumentsAdmin ? "ADMIN" : "STUDENT",
            enrollmentId: approvedUser.enrollmentId,
            department: approvedUser.department,
            branch: approvedUser.branch,
            batch: approvedUser.batch,
          },
        });
        console.log("✅ Created new user:", user.email);
      }

      // Auto-enroll user in their branch program if not already enrolled
      if (approvedUser.branch) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email }, select: { id: true } });
        if (dbUser) {
          const program = await prisma.program.findUnique({ where: { code: approvedUser.branch } });
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
      }

      return true;
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
