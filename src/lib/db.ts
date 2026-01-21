/**
 * Prisma database client singleton.
 *
 * Ensures a single PrismaClient instance is reused across hot reloads
 * in development to prevent connection exhaustion.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
