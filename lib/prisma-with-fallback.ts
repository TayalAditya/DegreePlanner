import { PrismaClient } from "@prisma/client";

/**
 * Prisma client that prefers the primary database, plus a helper to run
 * operations against a fallback database when needed.
 *
 * This module exports a synchronous Prisma client (required for Next.js + TS strict),
 * and keeps the fallback behavior explicit via `withFallback`.
 */

const PRIMARY_DB = process.env.DATABASE_URL;
const FALLBACK_DB = process.env.FALLBACK_DATABASE_URL;

function createPrismaClient(dbUrl?: string) {
  return new PrismaClient({
    datasources: {
      db: {
        url: dbUrl || PRIMARY_DB,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

declare global {
  // eslint-disable-next-line no-var
  var prismaWithFallbackGlobal: PrismaClient | undefined;
}

const prisma = globalThis.prismaWithFallbackGlobal ?? createPrismaClient(PRIMARY_DB);

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaWithFallbackGlobal = prisma;
}

export default prisma;

export async function withFallback<T>(operation: (client: PrismaClient) => Promise<T>): Promise<T> {
  if (!FALLBACK_DB) {
    throw new Error("FALLBACK_DATABASE_URL is not set");
  }

  const fallbackClient = createPrismaClient(FALLBACK_DB);
  try {
    return await operation(fallbackClient);
  } finally {
    await fallbackClient.$disconnect();
  }
}
