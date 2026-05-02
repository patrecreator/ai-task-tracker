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
    throw new Error("DATABASE_URL is empty — перевір .env.local");
  }

  if (!raw.startsWith("postgresql://") && !raw.startsWith("postgres://")) {
    throw new Error(
      `DATABASE_URL має починатись з postgresql:// (зараз починається з: ${JSON.stringify(raw.slice(0, 24))})`,
    );
  }

  return raw;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const databaseUrl = normalizeDatabaseUrl();
// Деякі версії Prisma все одно читають env зі схеми при ініціалізації — вирівнюємо значення.
process.env.DATABASE_URL = databaseUrl;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
