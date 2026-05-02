import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dailyDigest } from "@/lib/ai";

export const runtime = "nodejs";

export async function POST() {
  try {
    const tasks = await prisma.task.findMany({ orderBy: { createdAt: "desc" } });
    const result = await dailyDigest(tasks, new Date());
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Digest failed", headline: "", bullets: [] }, { status: 500 });
  }
}
