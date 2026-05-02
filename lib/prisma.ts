import { PrismaClient } from "@prisma/client";

/** Next/редактори інколи дають BOM, пробіли або подвійні лапки в значенні — Prisma тоді падає з P1012. */
function normalizeDatabaseUrl(): string {
  let raw = process.env.DATABASE_URL ?? "";
  raw = raw.replace(/^\uFEFF/, "").trim();

  while (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1).trim();
  }

  if (!raw) {
    throw new Error("DATABASE_URL is empty — додай змінну в Vercel (Settings → Environment Variables).");
  }

  if (!raw.startsWith("postgresql://") && !raw.startsWith("postgres://")) {
    throw new Error(
      `DATABASE_URL має починатись з postgresql:// (зараз: ${JSON.stringify(raw.slice(0, 24))})`,
    );
  }

  return raw;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  const databaseUrl = normalizeDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Лінивий клієнт: підключення до БД лише при першому зверненні (не під час import).
 * Це зменшує ризик падіння `next build` на Vercel, якщо env підставляються лише в рантаймі.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client) as unknown;
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
}) as PrismaClient;
