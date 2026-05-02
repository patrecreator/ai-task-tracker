import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTaskFromText } from "@/lib/ai";
import { describeDbError } from "@/lib/db-errors";
import { priorityRank } from "@/lib/priority";

export const runtime = "nodejs";

type Filter = "all" | "active" | "done";
type Sort = "deadline" | "priority" | "created";

function parseFilter(v: string | null): Filter {
  if (v === "active" || v === "done" || v === "all") return v;
  return "all";
}

function parseSort(v: string | null): Sort {
  if (v === "deadline" || v === "priority" || v === "created") return v;
  return "created";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = parseFilter(searchParams.get("filter"));
    const sort = parseSort(searchParams.get("sort"));

    const where =
      filter === "active" ? { done: false } : filter === "done" ? { done: true } : {};

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
      };
    }

    const task = await prisma.task.create({
      data: {
        rawInput: rawInput.trim(),
        title: parsed.title,
        priority: parsed.priority,
        deadline: parsed.deadline,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    console.error(e);
    const { status, error, hint, detail } = describeDbError(e);
    return NextResponse.json({ error, hint, detail }, { status });
  }
}
