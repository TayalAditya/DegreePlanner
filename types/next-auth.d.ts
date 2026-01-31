import { DefaultSession, DefaultUser } from "next-auth";
import { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isApproved: boolean;
      role: UserRole;
      enrollmentId?: string | null;
      department?: string | null;
      batch?: number | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    isApproved: boolean;
    role: UserRole;
    enrollmentId?: string | null;
    department?: string | null;
    batch?: number | null;
  }
}
