import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import type { Adapter } from "next-auth/adapters";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      // Check if user is approved by email (direct match)
      let approvedUser = await prisma.approvedUser.findUnique({
        where: { email: user.email },
      });

      // Fallback: look up by enrollmentId extracted from email prefix
      // e.g. b23243@students.iitmandi.ac.in → enrollmentId = B23243
      if (!approvedUser) {
        const emailPrefix = user.email.split("@")[0].toUpperCase();
        if (emailPrefix.match(/^B23\d+/i)) {
          approvedUser = await prisma.approvedUser.findUnique({
            where: { enrollmentId: emailPrefix },
          });
          // If found by enrollmentId, update the ApprovedUser email to match Google email
          if (approvedUser) {
            await prisma.approvedUser.update({
              where: { enrollmentId: emailPrefix },
              data: { email: user.email },
            });
          }
        }
      }

      if (!approvedUser) {
        return "/auth/error?error=batch_not_supported";
      }

      // Batch validation: Only Batch 2023 students allowed
      if (approvedUser.batch && approvedUser.batch !== 2023) {
        return "/auth/error?error=batch_not_supported";
      }

      // Update or create user with approval status
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (existingUser && !existingUser.isApproved) {
        await prisma.user.update({
          where: { email: user.email },
          data: {
            isApproved: true,
            enrollmentId: approvedUser.enrollmentId,
            department: approvedUser.department,
            branch: approvedUser.branch,
            batch: approvedUser.batch,
          },
        });
      }

      // Auto-create user if approved
      if (!existingUser) {
        await prisma.user.create({
          data: {
            email: user.email,
            name: user.name,
            image: user.image,
            isApproved: true,
            enrollmentId: approvedUser.enrollmentId,
            department: approvedUser.department,
            branch: approvedUser.branch,
            batch: approvedUser.batch,
          },
        });
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
