"use client";

import { useEffect, useMemo, useState } from "react";
import { IconPencil, IconTrash } from "@/components/icons";
import { deleteIconButtonClass, editIconButtonClass, snoozeTomorrowButtonClass } from "@/components/task-ui-styles";
import { categoryLabel, categoryShort } from "@/lib/category";
import {
  deadlineKyivYmd,
  formatDeadlineTimeKyiv,
  getKyivWeekDayMetas,
} from "@/lib/week-columns";
import { priorityEmoji } from "@/lib/priority";
import type { Task } from "@/lib/task-model";

const DRAG_TASK_ID = "application/x-task-tracker-id";

export type BoardDropTarget = { type: "day"; ymd: string } | { type: "undated" };

type WeekBoardProps = {
  tasks: Task[];
  weekOffset: number;
  onWeekOffset: (delta: number) => void;
  onToggleDone: (task: Task) => void;
  onRemove: (id: string) => void;
  onSnooze: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onBoardDrop: (taskId: string, target: BoardDropTarget) => void | Promise<void>;
};

function sortByDeadlineTime(a: Task, b: Task): number {
  const ta = a.deadline ? new Date(a.deadline).getTime() : 0;
  const tb = b.deadline ? new Date(b.deadline).getTime() : 0;
  return ta - tb;
}

export default function WeekBoard({
  tasks,
  weekOffset,
  onWeekOffset,
  onToggleDone,
  onRemove,
  onSnooze,
  onEditTask,
  onBoardDrop,
}: WeekBoardProps) {
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => {
    const end = () => setDragOver(null);
    window.addEventListener("dragend", end);
    return () => window.removeEventListener("dragend", end);
  }, []);

  const dayMetas = useMemo(
    () => getKyivWeekDayMetas(new Date(), weekOffset),
    [weekOffset],
  );
  const ymdSet = useMemo(() => new Set(dayMetas.map((d) => d.ymd)), [dayMetas]);

  const { byYmd, undated, otherWeek } = useMemo(() => {
    const byYmd = new Map<string, Task[]>();
    for (const m of dayMetas) byYmd.set(m.ymd, []);
    const undated: Task[] = [];
    const otherWeek: Task[] = [];
    for (const t of tasks) {
      const ymd = deadlineKyivYmd(t.deadline);
      if (!ymd) {
        undated.push(t);
        continue;
      }
      if (!ymdSet.has(ymd)) {
        otherWeek.push(t);
        continue;
      }
      byYmd.get(ymd)!.push(t);
    }
    for (const [, arr] of byYmd) arr.sort(sortByDeadlineTime);
    undated.sort((a, b) => a.title.localeCompare(b.title, "uk"));
    otherWeek.sort(sortByDeadlineTime);
    return { byYmd, undated, otherWeek };
  }, [tasks, dayMetas, ymdSet]);

  const rangeLabel = `${dayMetas[0]?.dayMonth ?? ""} — ${dayMetas[6]?.dayMonth ?? ""}`;

  const dropHighlight =
    "bg-emerald-50/90 ring-2 ring-emerald-400/60 dark:bg-emerald-950/25 dark:ring-emerald-500/50";

  function TaskMini({ task }: { task: Task }) {
    const overdue = task.deadline && !task.done && new Date(task.deadline).getTime() < Date.now();
    const cat = task.category ?? "personal";
    return (
      <div
        draggable={!task.done}
        onDragStart={(e) => {
          if (task.done) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData(DRAG_TASK_ID, task.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        title={
          task.done
            ? undefined
            : "Тягни картку на інший день (час у Києві збережеться) або в зону «Без дедлайну»"
        }
        className={`rounded-lg border px-2 py-1.5 text-xs transition-shadow ${
          overdue
            ? "border-red-300 bg-red-50/90 dark:border-red-800 dark:bg-red-950/40"
            : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900/80"
        } ${!task.done ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        <div className="flex items-start gap-1.5">
          <input
            type="checkbox"
            draggable={false}
            checked={task.done}
            onChange={() => onToggleDone(task)}
            className="mt-0.5 size-3.5 shrink-0 rounded border-zinc-400"
            aria-label="Виконано"
          />
          <div className="min-w-0 flex-1">
            <p
              className={`font-medium leading-snug ${
                task.done ? "text-zinc-400 line-through" : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {task.title}
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              {priorityEmoji(task.priority)} {task.deadline ? formatDeadlineTimeKyiv(task.deadline) : ""}
              {task.estimatedHours != null ? ` · ~${task.estimatedHours} год` : ""}
              {task.spentHours != null ? ` · ✓ ${task.spentHours} год` : ""}
            </p>
            <p className="text-[10px] text-zinc-400">
              {categoryShort(cat)} {categoryLabel(cat)}
            </p>
            {task.description ? (
              <p className="mt-0.5 line-clamp-2 text-[10px] text-zinc-500">{task.description}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            draggable={false}
            onClick={() => onEditTask(task)}
            className={editIconButtonClass}
            aria-label="Редагувати задачу"
            title="Редагувати"
          >
            <IconPencil className="size-[1.05rem]" />
          </button>
          {!task.done && (
            <button
              type="button"
              draggable={false}
              onClick={() => onSnooze(task)}
              className={snoozeTomorrowButtonClass}
            >
              До завтра
            </button>
          )}
          <button
            type="button"
            draggable={false}
            onClick={() => onRemove(task.id)}
            className={deleteIconButtonClass}
            aria-label="Видалити задачу"
            title="Видалити"
          >
            <IconTrash className="size-[1.05rem]" />
          </button>
        </div>
      </div>
    );
  }

  function handleColumnDragOver(e: React.DragEvent, key: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(key);
  }

  function handleDrop(e: React.DragEvent, target: BoardDropTarget) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData(DRAG_TASK_ID);
    if (id) void onBoardDrop(id, target);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Борд тижня (7 днів, Київ): <span className="text-zinc-900 dark:text-zinc-100">{rangeLabel}</span>
          </p>
          <p className="mt-1 max-w-xl text-xs text-zinc-500 dark:text-zinc-400">
            Перетягни задачу на інший день — дедлайн оновиться (година в Києві лишається тією ж; якщо дедлайну не було —
            буде 09:00). У зону «Без дедлайну» — прибрати дату.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onWeekOffset(weekOffset - 1)}
            className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            ← Попередній
          </button>
          <button
            type="button"
            onClick={() => onWeekOffset(0)}
            className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Цей тиждень
          </button>
          <button
            type="button"
            onClick={() => onWeekOffset(weekOffset + 1)}
            className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Наступний →
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[720px] gap-2">
          {dayMetas.map((day) => (
            <div
              key={day.ymd}
              className="flex min-w-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/30"
            >
              <div className="border-b border-zinc-200 px-2 py-2 text-center dark:border-zinc-700">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {day.weekdayShort}
                </p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{day.dayMonth}</p>
              </div>
              <div
                className={`flex min-h-[7rem] flex-col gap-1.5 p-1.5 transition-colors ${
                  dragOver === day.ymd ? dropHighlight : ""
                }`}
                onDragOver={(e) => handleColumnDragOver(e, day.ymd)}
                onDrop={(e) => handleDrop(e, { type: "day", ymd: day.ymd })}
              >
                {(byYmd.get(day.ymd) ?? []).map((task) => (
                  <TaskMini key={task.id} task={task} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className={`rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-3 dark:border-zinc-600 dark:bg-zinc-900/40 ${
          dragOver === "undated" ? dropHighlight : ""
        }`}
        onDragOver={(e) => handleColumnDragOver(e, "undated")}
        onDrop={(e) => handleDrop(e, { type: "undated" })}
      >
        <p className="mb-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Без дедлайну</p>
        <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          Перетягни сюди, щоб прибрати дату виконання.
        </p>
        <div className="flex min-h-[3rem] flex-col gap-1.5">
          {undated.length === 0 ? (
            <p className="text-[11px] italic text-zinc-400">Поки немає задач без дедлайну</p>
          ) : (
            undated.map((task) => <TaskMini key={task.id} task={task} />)
          )}
        </div>
      </div>

      {otherWeek.length > 0 && (
        <div className="rounded-xl border border-dashed border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
          <p className="mb-2 text-xs font-semibold text-sky-800 dark:text-sky-200">
            Не в цьому тижні ({otherWeek.length})
          </p>
          <p className="mb-2 text-[11px] text-sky-800/80 dark:text-sky-200/80">
            Перетягни задачу на день у сітці вище, щоб перенести її в поточний тиждень.
          </p>
          <div className="flex flex-col gap-1.5">
            {otherWeek.map((task) => (
              <TaskMini key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
