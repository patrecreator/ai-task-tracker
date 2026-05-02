import { Prisma } from "@prisma/client";

/** Людяні повідомлення для воркшопу (українською). */
export function describeDbError(e: unknown): {
  status: number;
  error: string;
  hint?: string;
  detail?: string;
} {
  const detail = e instanceof Error ? e.message : String(e);

  if (detail.includes("URL must start with the protocol")) {
    return {
      status: 503,
      error: "Невірний DATABASE_URL.",
      hint: "У .env.local має бути повний рядок з Neon, що починається з postgresql:// (не заглушка REPLACE_...).",
    };
  }

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2021") {
      return {
        status: 503,
        error: "У базі ще немає таблиці для задач.",
        hint: "У терміналі в папці task-tracker виконай: npm run db:migrate",
      };
    }
    if (e.code === "P2002") {
      return { status: 409, error: "Конфлікт запису (дублікат).", detail };
    }
  }

  if (e instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      error: "Не вдалося підключитися до бази даних.",
      hint: "Перевір DATABASE_URL у .env.local і інтернет-з'єднання.",
      detail,
    };
  }

  if (
    detail.includes("Can't reach database") ||
    detail.includes("P1001") ||
    detail.toLowerCase().includes("econnrefused")
  ) {
    return {
      status: 503,
      error: "Сервер бази не відповідає.",
      hint: "Перевір DATABASE_URL (Neon → Connect) і що база не «заснула» (Neon free інколи гасить compute).",
      detail,
    };
  }

  return { status: 500, error: "Помилка бази даних.", detail };
}
