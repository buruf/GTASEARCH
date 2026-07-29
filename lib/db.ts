import { PrismaClient } from "@prisma/client";

// Next.js dev mode hot-reloads modules on every edit. Without caching the client
// on globalThis, each reload opens a new pool and Supabase's connection limit is
// exhausted within a few minutes of editing.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
