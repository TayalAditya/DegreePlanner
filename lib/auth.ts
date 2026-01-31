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
          return false;
        }
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
            batch: true,
          },
        });

        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.isApproved = dbUser.isApproved;
          session.user.role = dbUser.role;
          session.user.enrollmentId = dbUser.enrollmentId;
          session.user.department = dbUser.department;
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
