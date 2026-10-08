import { PrismaClient } from './generated/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
const adapter = databaseUrl.startsWith('file:')
  ? new PrismaLibSql({ url: databaseUrl })
  : new PrismaPg({ connectionString: databaseUrl });

const globalForPrisma = globalThis as unknown as { apparelFlowPrisma?: PrismaClient };

export const prisma = globalForPrisma.apparelFlowPrisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.apparelFlowPrisma = prisma;
