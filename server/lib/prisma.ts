import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { createLogger } from './logger';

const log = createLogger('database');

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

const createPrismaClient = () => {
  const client = new PrismaClient({
    adapter: new PrismaPg(databaseUrl),
    log: [{ level: 'warn', emit: 'event' }, { level: 'error', emit: 'event' }],
  });
  client.$on('warn', (event) => log.warn({ target: event.target }, event.message));
  client.$on('error', (event) => log.error({ target: event.target }, event.message));
  return client;
};

export const prisma =
  globalForPrisma.prisma && 'messageQuickTemplate' in globalForPrisma.prisma
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

