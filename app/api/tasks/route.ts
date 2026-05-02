import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTaskFromText } from "@/lib/ai";
import { describeDbError } from "@/lib/db-errors";
import { getKyivWeekBoundsUtc } from "@/lib/kyiv-week";
import { priorityRank } from "@/lib/priority";

export const runtime = "nodejs";

type Filter = "all" | "active" | "done";
type Sort = "deadline" | "priority" | "created";
type CategoryFilter = "all" | "work" | "personal" | "learning";

function parseFilter(v: string | null): Filter {
  if (v === "active" || v === "done" || v === "all") return v;
  return "all";
}

function parseSort(v: string | null): Sort {
  if (v === "deadline" || v === "priority" || v === "created") return v;
  return "created";
}

function parseCategoryFilter(v: string | null): CategoryFilter {
  if (v === "work" || v === "personal" || v === "learning") return v;
  return "all";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = parseFilter(searchParams.get("filter"));
    const sort = parseSort(searchParams.get("sort"));
    const category = parseCategoryFilter(searchParams.get("category"));

    const where: Prisma.TaskWhereInput = {};
    if (filter === "active") where.done = false;
    else if (filter === "done") where.done = true;
    if (category !== "all") where.category = category;

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const sorted = [...tasks].sort((a, b) => {
      if (sort === "created") {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      if (sort === "priority") {
        const rp = priorityRank(a.priority) - priorityRank(b.priority);
        if (rp !== 0) return rp;
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      // deadline: sooner first, nulls last
      const ad = a.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
      const bd = b.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      return priorityRank(a.priority) - priorityRank(b.priority);
    });

    return NextResponse.json(sorted);
  } catch (e) {
    console.error(e);
    const { status, error, hint, detail } = describeDbError(e);
    return NextResponse.json({ error, hint, detail }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawInput = typeof body?.rawInput === "string" ? body.rawInput : "";
    if (!rawInput.trim()) {
      return NextResponse.json({ error: "rawInput is required" }, { status: 400 });
    }

    const force = body?.force === true;
    let weeklyCapacity = 40;
    if (typeof body?.weeklyCapacityHours === "number" && Number.isFinite(body.weeklyCapacityHours)) {
      weeklyCapacity = Math.min(168, Math.max(1, body.weeklyCapacityHours));
    }

    const now = new Date();
    let parsed;
    try {
      parsed = await parseTaskFromText(rawInput, now);
    } catch (err) {
      console.error(err);
      parsed = {
        title: rawInput.trim().slice(0, 500),
        priority: "medium" as const,
        deadline: null as Date | null,
        category: "personal" as const,
        estimatedHours: null as null,
      };
    }

    const newHours = parsed.estimatedHours;
    if (!force && newHours != null && newHours > 0) {
      const ref = parsed.deadline ?? now;
      const { start, end } = getKyivWeekBoundsUtc(ref);
      const weekTasks = await prisma.task.findMany({
        where: {
          done: false,
          deadline: { gte: start, lte: end },
          estimatedHours: { not: null },
        },
        select: { estimatedHours: true },
      });
      const used = weekTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
      if (used + newHours > weeklyCapacity) {
        return NextResponse.json(
          {
            error: "Перевантаження тижня",
            hint: `За тижнем (пн–нд, Київ) у задач з дедлайном у цьому тижні вже ~${used.toFixed(1)} год з ${weeklyCapacity} год. Нова задача ~${newHours} год. Можеш додати все одно.`,
            code: "WEEK_OVERLOAD",
            usedHours: used,
            capacity: weeklyCapacity,
            newHours,
          },
          { status: 409 },
        );
      }
    }

    const task = await prisma.task.create({
      data: {
        rawInput: rawInput.trim(),
        title: parsed.title,
        priority: parsed.priority,
        category: parsed.category,
        deadline: parsed.deadline,
        estimatedHours: newHours,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    console.error(e);
    const { status, error, hint, detail } = describeDbError(e);
    return NextResponse.json({ error, hint, detail }, { status });
  }
}
