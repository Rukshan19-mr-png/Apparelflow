import { PrismaClient } from './generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./dev.db' });

const globalForPrisma = globalThis as unknown as { apparelFlowPrisma?: PrismaClient };

export const prisma = globalForPrisma.apparelFlowPrisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.apparelFlowPrisma = prisma;
