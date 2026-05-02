import { getKyivWeekBoundsUtc } from "@/lib/kyiv-week";
import type { Task } from "@/lib/task-model";

const MOVES_KEY = "task_tracker_reschedule_moves_v1";

/** Після успішного переносу дедлайну (борд) або «До завтра». */
export function recordRescheduleMove(): void {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    const raw = window.localStorage.getItem(MOVES_KEY);
    const parsed = raw ? (JSON.parse(raw) as { t?: number[] }) : null;
    const prev = Array.isArray(parsed?.t) ? parsed.t : [];
    const trimmed = prev.filter((x) => now - x < 7 * 86_400_000);
    trimmed.push(now);
    window.localStorage.setItem(MOVES_KEY, JSON.stringify({ t: trimmed }));
  } catch {
    /* ignore */
  }
}

export function getRescheduleMovesLast7Days(): number {
  if (typeof window === "undefined") return 0;
  try {
    const now = Date.now();
    const raw = window.localStorage.getItem(MOVES_KEY);
    const parsed = raw ? (JSON.parse(raw) as { t?: number[] }) : null;
    const arr = Array.isArray(parsed?.t) ? parsed.t : [];
    return arr.filter((x) => now - x < 7 * 86_400_000).length;
  } catch {
    return 0;
  }
}

/** Активні задачі з дедлайном у поточному київському тижні: кількість і сума годин (план). */
export function thisKyivWeekLoad(tasks: Task[]): { count: number; plannedHours: number } {
  const { start, end } = getKyivWeekBoundsUtc(new Date());
  let count = 0;
  let plannedHours = 0;
  for (const t of tasks) {
    if (t.done) continue;
    if (!t.deadline) continue;
    const d = new Date(t.deadline);
    if (Number.isNaN(d.getTime()) || d < start || d > end) continue;
    count += 1;
    plannedHours += t.estimatedHours ?? 0;
  }
  return { count, plannedHours };
}

/** Чи показувати «навантажений тиждень» (багато задач або години понад ліміт). */
export function isHeavyWeekPlan(
  tasks: Task[],
  weeklyCapacityHours: number,
): { show: boolean; count: number; plannedHours: number } {
  const { count, plannedHours } = thisKyivWeekLoad(tasks);
  const cap = Math.max(1, weeklyCapacityHours);
  const overHours = plannedHours > cap;
  const manyTasks = count >= 12;
  const tightHours = plannedHours >= cap * 0.92 && plannedHours > 0;
  return {
    show: overHours || manyTasks || tightHours,
    count,
    plannedHours,
  };
}
