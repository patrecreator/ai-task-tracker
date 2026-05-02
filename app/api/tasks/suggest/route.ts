import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { suggestTopTasks } from "@/lib/ai";

export const runtime = "nodejs";

export async function POST() {
  try {
    const tasks = await prisma.task.findMany({ orderBy: { createdAt: "desc" } });
    const result = await suggestTopTasks(tasks, new Date());
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Suggest failed", intro: "", items: [] }, { status: 500 });
  }
}
