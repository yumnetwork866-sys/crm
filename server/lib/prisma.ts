import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

// Ensure Prisma.Decimal fields serialize as numbers in JSON responses
// while preserving exact DECIMAL(18, 2) storage in PostgreSQL.
(Prisma.Decimal.prototype as unknown as { toNumber: () => number; toJSON: () => number }).toJSON = function () {
  return this.toNumber();
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to initialize Prisma.');
}

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg(databaseUrl),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

export const prisma =
  globalForPrisma.prisma && 'messageQuickTemplate' in globalForPrisma.prisma
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

