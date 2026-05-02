import OpenAI from "openai";
import { z } from "zod";
import { normalizeCategory, type TaskCategory } from "./category";
import { normalizeEstimatedHours } from "./estimate";
import { normalizePriority, type Priority } from "./priority";

function getClient() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  if (key.includes("REPLACE") || key === "sk-replace-me") {
    throw new Error("OPENAI_API_KEY placeholder");
  }
  return new OpenAI({ apiKey: key });
}

/** Чи є валідний ключ для викликів OpenAI (не заглушка). */
export function isOpenAiConfigured(): boolean {
  try {
    getClient();
    return true;
  } catch {
    return false;
  }
}

const parsedTaskSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(["high", "medium", "low"]),
  deadline: z.union([z.string(), z.null()]).optional(),
  category: z.enum(["work", "personal", "learning"]).optional(),
  estimatedHours: z.union([z.number(), z.string(), z.null()]).optional(),
});

export type ParsedTask = {
  title: string;
  priority: Priority;
  deadline: Date | null;
  category: TaskCategory;
  estimatedHours: number | null;
};

export async function parseTaskFromText(rawInput: string, now: Date): Promise<ParsedTask> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      title: "Без назви",
      priority: "medium",
      deadline: null,
      category: "personal",
      estimatedHours: null,
    };
  }

  let openai: OpenAI;
  try {
    openai = getClient();
  } catch {
    return {
      title: trimmed.slice(0, 200),
      priority: "medium",
      deadline: null,
      category: "personal",
      estimatedHours: null,
    };
  }

  const today = now.toISOString().slice(0, 10);

  const system = `You extract ONE task from the user's message. Respond ONLY with valid JSON — no markdown, no code fences, no explanation.

Today's date (UTC) is: ${today}. Interpret relative phrases (today, tomorrow, next week, "до обіду" ≈ noon local, "ввечері" ≈ 18:00 local) using the user's language (often Ukrainian). Output deadline as ISO 8601 in UTC. If only a date is known, use that date at 09:00 UTC. If you cannot infer a time, use null for deadline.

JSON shape exactly:
{"title":"string","priority":"high"|"medium"|"low","deadline":"2026-05-02T12:00:00.000Z"|null,"category":"work"|"personal"|"learning","estimatedHours":2.5|null}

Rules: priority high for urgent / ASAP / терміново; medium default; low for someday / колись / optional.

Category: "work" — робота, колеги, зустрічі, клієнти, офіс; "personal" — дім, сімʼя, здоровʼя, побут; "learning" — курси, воркшоп, навчання, мови. Якщо неочевидно — "personal".

estimatedHours: realistic hours to complete the task (0.25–80), number or null if impossible to guess. Quick email ~0.5h; deep research ~4h; "навесь день" ~8h.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: trimmed },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    return {
      title: trimmed.slice(0, 200),
      priority: "medium",
      deadline: null,
      category: "personal",
      estimatedHours: null,
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      title: trimmed.slice(0, 200),
      priority: "medium",
      deadline: null,
      category: "personal",
      estimatedHours: null,
    };
  }

  const parsed = parsedTaskSchema.safeParse(json);
  if (!parsed.success) {
    return {
      title: trimmed.slice(0, 200),
      priority: "medium",
      deadline: null,
      category: "personal",
      estimatedHours: null,
    };
  }

  let deadline: Date | null = null;
  if (parsed.data.deadline && typeof parsed.data.deadline === "string") {
    const d = new Date(parsed.data.deadline);
    deadline = Number.isNaN(d.getTime()) ? null : d;
  }

  return {
    title: parsed.data.title.trim().slice(0, 500),
    priority: normalizePriority(parsed.data.priority),
    deadline,
    category: normalizeCategory(parsed.data.category ?? "personal"),
    estimatedHours: normalizeEstimatedHours(parsed.data.estimatedHours ?? null),
  };
}

const suggestSchema = z.object({
  intro: z.string(),
  items: z.array(
    z.object({
      taskId: z.string(),
      reason: z.string(),
    }),
  ),
});

export type SuggestionItem = { taskId: string; reason: string };

export async function suggestTopTasks(
  tasks: Array<{
    id: string;
    title: string;
    priority: string;
    category: string;
    estimatedHours: number | null;
    deadline: Date | null;
    rawInput: string;
    done: boolean;
  }>,
  now: Date,
): Promise<{ intro: string; items: SuggestionItem[] }> {
  const open = tasks.filter((t) => !t.done);
  if (open.length === 0) {
    return { intro: "Немає активних задач — можна відпочити.", items: [] };
  }

  const openai = getClient();
  const lines = open.map(
    (t) =>
      `id=${t.id} | title=${JSON.stringify(t.title)} | priority=${t.priority} | category=${t.category} | hours=${t.estimatedHours ?? "none"} | deadline=${t.deadline?.toISOString() ?? "none"} | raw=${JSON.stringify(t.rawInput)}`,
  );

  const system = `You prioritize tasks. Active tasks are listed below (one per line). Pick up to 3 tasks that are best to focus on in the NEXT ~2 HOURS from now (${now.toISOString()} UTC). Prefer urgent deadlines and high priority.

Respond ONLY with valid JSON, no markdown:
{"intro":"one short sentence in Ukrainian","items":[{"taskId":"<exact id>","reason":"short Ukrainian reason"}]}

taskId must match exactly from the input. At most 3 items.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: lines.join("\n") },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    return { intro: "Не вдалося отримати рекомендацію.", items: [] };
  }

  try {
    const json = JSON.parse(text);
    const parsed = suggestSchema.safeParse(json);
    if (!parsed.success) {
      return { intro: "Не вдалося розібрати відповідь моделі.", items: [] };
    }
    const validIds = new Set(open.map((t) => t.id));
    const items = parsed.data.items
      .filter((i) => validIds.has(i.taskId))
      .slice(0, 3);
    return { intro: parsed.data.intro, items };
  } catch {
    return { intro: "Помилка парсингу відповіді.", items: [] };
  }
}

const digestSchema = z.object({
  headline: z.string(),
  bullets: z.array(z.string()).max(12),
});

export async function dailyDigest(
  tasks: Array<{
    title: string;
    priority: string;
    category: string;
    estimatedHours: number | null;
    deadline: Date | null;
    done: boolean;
  }>,
  now: Date,
): Promise<{ headline: string; bullets: string[] }> {
  const open = tasks.filter((t) => !t.done);
  if (open.length === 0) {
    return { headline: "Сьогодні вільний день 🎉", bullets: ["Активних задач немає."] };
  }

  if (!isOpenAiConfigured()) {
    return {
      headline: "План на сьогодні",
      bullets: open.map((t) => t.title).slice(0, 7),
    };
  }

  let openai: OpenAI;
  try {
    openai = getClient();
  } catch {
    return {
      headline: "План на сьогодні",
      bullets: open.map((t) => t.title).slice(0, 7),
    };
  }
  const body = open
    .map(
      (t) =>
        `- ${JSON.stringify(t.title)} [${t.priority}] [${t.category}]${t.estimatedHours != null ? ` ~${t.estimatedHours}h` : ""} deadline=${t.deadline?.toISOString().slice(0, 10) ?? "none"}`,
    )
    .join("\n");

  const system = `You are a concise planner. Today is ${now.toISOString().slice(0, 10)} (UTC). Given the user's OPEN tasks, write a short Ukrainian plan for TODAY.

Respond ONLY valid JSON:
{"headline":"one motivating line","bullets":["...","..."]}

3–7 bullets, actionable, Ukrainian.`;

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: body },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });
  } catch {
    return { headline: "План на сьогодні", bullets: open.map((t) => t.title).slice(0, 7) };
  }

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    return { headline: "План на сьогодні", bullets: open.map((t) => t.title).slice(0, 5) };
  }

  try {
    const json = JSON.parse(text);
    const parsed = digestSchema.safeParse(json);
    if (!parsed.success) {
      return { headline: "План на сьогодні", bullets: open.map((t) => t.title).slice(0, 5) };
    }
    return { headline: parsed.data.headline, bullets: parsed.data.bullets };
  } catch {
    return { headline: "План на сьогодні", bullets: open.map((t) => t.title).slice(0, 5) };
  }
}
