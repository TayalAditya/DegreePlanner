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
    async signIn({ user, account, profile }) {
      if (!user.email) return false;

      // Check if user is approved
      const approvedUser = await prisma.approvedUser.findUnique({
        where: { email: user.email },
      });

      if (!approvedUser) {
        // Check for email domain restriction (if configured)
        const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
        if (allowedDomain && !user.email.endsWith(allowedDomain)) {
          return "/auth/error?error=domain_not_allowed";
        }

        // Check for Batch 2023 requirement
        const enrollmentId = profile?.email?.split("@")[0] || ""; // Try to extract from email
        if (enrollmentId && !enrollmentId.match(/^B23/i)) {
          // Not Batch 2023
          return "/auth/error?error=batch_not_supported";
        }

        // User not in approved list and not auto-approvable
        return "/auth/error?error=user_not_approved";
      }

      // Batch validation: Only Batch 2023 students allowed
      if (approvedUser.batch && approvedUser.batch !== 2023) {
        return "/auth/error?error=batch_not_supported";
      }

      // Update or create user with approval status
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (existingUser && !existingUser.isApproved && approvedUser) {
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
      if (!existingUser && approvedUser) {
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
