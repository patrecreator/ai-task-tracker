import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeCategory } from "@/lib/category";
import { normalizeEstimatedHours, normalizeSpentHours } from "@/lib/estimate";
import { getKyivTomorrowNineAmUtc } from "@/lib/kyiv-time";
import { normalizePriority } from "@/lib/priority";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();

    const data: {
      done?: boolean;
      title?: string;
      priority?: string;
      category?: string;
      estimatedHours?: number | null;
      spentHours?: number | null;
      deadline?: Date | null;
      description?: string | null;
    } = {};

    if (typeof body.done === "boolean") data.done = body.done;
    if (typeof body.title === "string" && body.title.trim()) {
      data.title = body.title.trim().slice(0, 500);
    }
    if (typeof body.priority === "string") {
      data.priority = normalizePriority(body.priority);
    }
    if (typeof body.category === "string") {
      data.category = normalizeCategory(body.category);
    }
    if (body.estimatedHours === null) {
      data.estimatedHours = null;
    } else if (typeof body.estimatedHours === "number") {
      data.estimatedHours = normalizeEstimatedHours(body.estimatedHours);
    }
    if (body.spentHours === null) {
      data.spentHours = null;
    } else if (typeof body.spentHours === "number") {
      data.spentHours = normalizeSpentHours(body.spentHours);
    }
    if (body.description === null) {
      data.description = null;
    } else if (typeof body.description === "string") {
      const t = body.description.trim();
      data.description = t.length === 0 ? null : t.slice(0, 8000);
    }
    if (body.deadline === null) {
      data.deadline = null;
    } else if (typeof body.deadline === "string") {
      const d = new Date(body.deadline);
      data.deadline = Number.isNaN(d.getTime()) ? null : d;
    }

    if (body.snoozeTomorrow === true) {
      data.deadline = getKyivTomorrowNineAmUtc();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const task = await prisma.task.update({
      where: { id },
      data,
    });

    return NextResponse.json(task);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
