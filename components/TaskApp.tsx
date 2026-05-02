"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { IconHugOutline, IconPencil, IconTrash } from "@/components/icons";
import SupportHugModal from "@/components/SupportHugModal";
import TaskEditorModal from "@/components/TaskEditorModal";
import { deleteIconButtonClass, editIconButtonClass, snoozeTomorrowButtonClass } from "@/components/task-ui-styles";
import WeekBoard, { type BoardDropTarget } from "@/components/WeekBoard";
import { categoryLabel, categoryShort } from "@/lib/category";
import { shiftDeadlineToKyivYmd } from "@/lib/kyiv-deadline-shift";
import { priorityEmoji } from "@/lib/priority";
import {
  getRescheduleMovesLast7Days,
  isHeavyWeekPlan,
  recordRescheduleMove,
} from "@/lib/wellness";
import { deadlineKyivYmd } from "@/lib/week-columns";
import type { Task } from "@/lib/task-model";

export type { Task } from "@/lib/task-model";

type Filter = "all" | "active" | "done";
type Sort = "created" | "deadline" | "priority";
type CategoryFilter = "all" | "work" | "personal" | "learning";
type ViewMode = "list" | "week";

function formatDeadline(iso: string | null): string {
  if (!iso) return "без дедлайну";
  try {
    return new Date(iso).toLocaleString("uk-UA", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function isOverdue(deadline: string | null, done: boolean): boolean {
  if (!deadline || done) return false;
  return new Date(deadline).getTime() < Date.now();
}

function messageFromApiBodyText(text: string, statusText: string, status: number): string {
  try {
    const j = JSON.parse(text) as {
      error?: string;
      hint?: string;
      detail?: string;
    };
    const parts = [j.error, j.hint].filter(Boolean);
    if (parts.length) return parts.join(" ");
  } catch {
    /* ignore */
  }
  return text.trim() || statusText || `Помилка ${status}`;
}

async function readApiErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  return messageFromApiBodyText(text, res.statusText, res.status);
}

export default function TaskApp() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sort, setSort] = useState<Sort>("created");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [suggest, setSuggest] = useState<{
    intro: string;
    items: { taskId: string; reason: string }[];
  } | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [digest, setDigest] = useState<{ headline: string; bullets: string[] } | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [weeklyCapacity, setWeeklyCapacity] = useState(40);
  const [overload, setOverload] = useState<{
    used: number;
    capacity: number;
    newHours: number;
  } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [supportOpen, setSupportOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [wellnessMounted, setWellnessMounted] = useState(false);
  const [rescheduleMoveCount7d, setRescheduleMoveCount7d] = useState(0);

  useEffect(() => {
    startTransition(() => {
      setWellnessMounted(true);
      setRescheduleMoveCount7d(getRescheduleMovesLast7Days());
    });
  }, []);

  useEffect(() => {
    startTransition(() => {
      try {
        const raw = localStorage.getItem("task_tracker_weekly_hours");
        const v = parseFloat(raw ?? "");
        if (Number.isFinite(v) && v > 0) setWeeklyCapacity(Math.min(168, v));
      } catch {
        /* ignore */
      }
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("task_tracker_weekly_hours", String(weeklyCapacity));
    } catch {
      /* ignore */
    }
  }, [weeklyCapacity]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tasks?filter=${filter}&sort=${sort}&category=${categoryFilter}`,
      );
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = (await res.json()) as Task[];
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося завантажити задачі");
    } finally {
      setLoading(false);
    }
  }, [filter, sort, categoryFilter]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!editorTask) return;
    if (!tasks.some((t) => t.id === editorTask.id)) {
      startTransition(() => setEditorTask(null));
    }
  }, [tasks, editorTask]);

  const activeCount = useMemo(
    () => tasks.filter((t) => !t.done).length,
    [tasks],
  );

  const wellnessHints = useMemo(() => {
    const heavy = isHeavyWeekPlan(tasks, weeklyCapacity);
    const showRescheduleNudge = rescheduleMoveCount7d >= 3 && !heavy.show;
    return { heavy, showRescheduleNudge };
  }, [tasks, weeklyCapacity, rescheduleMoveCount7d]);

  async function addTask(force = false) {
    const raw = input.trim();
    if (!raw) return;
    setSaving(true);
    setError(null);
    setOverload(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInput: raw,
          weeklyCapacityHours: weeklyCapacity,
          ...(force ? { force: true } : {}),
        }),
      });
      const text = await res.text();
      if (res.status === 409 && !force) {
        try {
          const data = JSON.parse(text) as { code?: string; usedHours?: number; capacity?: number; newHours?: number };
          if (data.code === "WEEK_OVERLOAD") {
            setOverload({
              used: data.usedHours ?? 0,
              capacity: data.capacity ?? weeklyCapacity,
              newHours: data.newHours ?? 0,
            });
            return;
          }
        } catch {
          /* fall through */
        }
      }
      if (!res.ok) {
        throw new Error(messageFromApiBodyText(text, res.statusText, res.status));
      }
      setInput("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося додати задачу");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(task: Task) {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !task.done }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося оновити статус");
    }
  }

  async function snoozeTomorrow(task: Task) {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snoozeTomorrow: true }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      recordRescheduleMove();
      setRescheduleMoveCount7d(getRescheduleMovesLast7Days());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося відкласти задачу");
    }
  }

  async function removeTask(id: string) {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося видалити задачу");
    }
  }

  async function applyBoardDrop(taskId: string, target: BoardDropTarget) {
    setError(null);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.done) return;
    try {
      if (target.type === "undated") {
        if (!task.deadline) return;
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deadline: null }),
        });
        if (!res.ok) throw new Error(await readApiErrorMessage(res));
      } else {
        if (deadlineKyivYmd(task.deadline) === target.ymd) return;
        const next = shiftDeadlineToKyivYmd(task.deadline, target.ymd);
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deadline: next.toISOString() }),
        });
        if (!res.ok) throw new Error(await readApiErrorMessage(res));
      }
      if (target.type === "day") {
        recordRescheduleMove();
        setRescheduleMoveCount7d(getRescheduleMovesLast7Days());
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося перенести задачу на борді");
    }
  }

  async function runSuggest() {
    setSuggestLoading(true);
    setSuggest(null);
    setError(null);
    try {
      const res = await fetch("/api/tasks/suggest", { method: "POST" });
      const data = (await res.json()) as {
        intro?: string;
        items?: { taskId: string; reason: string }[];
      };
      setSuggest({
        intro: data.intro ?? "",
        items: data.items ?? [],
      });
    } catch {
      setError("Не вдалося отримати рекомендації");
    } finally {
      setSuggestLoading(false);
    }
  }

  async function runDigest() {
    setDigestLoading(true);
    setDigest(null);
    setError(null);
    try {
      const res = await fetch("/api/tasks/digest", { method: "POST" });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = (await res.json()) as {
        headline?: string;
        bullets?: string[];
        error?: string;
      };
      if (data.error && !data.headline) {
        throw new Error(data.error);
      }
      setDigest({
        headline: data.headline ?? "План на сьогодні",
        bullets: Array.isArray(data.bullets) ? data.bullets : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося зібрати дайджест");
    } finally {
      setDigestLoading(false);
    }
  }

  return (
    <div
      className={`mx-auto flex w-full flex-col gap-6 px-4 py-10 ${
        viewMode === "week" ? "max-w-6xl" : "max-w-2xl"
      }`}
    >
      <TaskEditorModal
        key={editorTask?.id ?? "closed"}
        task={editorTask}
        open={editorTask !== null}
        onClose={() => setEditorTask(null)}
        onSaved={load}
        onError={setError}
      />
      <SupportHugModal open={supportOpen} onClose={() => setSupportOpen(false)} />
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          TaskBasket
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Кинь задачі в «кошик» звичайною мовою — AI розкладе назву, пріоритет і дедлайн. Тижневий борд і
          переноси — поруч.
        </p>
      </header>

      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-zinc-500">Вигляд:</span>
            {(
              [
                ["list", "Список"],
                ["week", "Борд: 7 днів"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                title={
                  key === "week"
                    ? "Сітка тижня: 7 стовпців (пн–нд), дедлайни за часом Києва"
                    : "Звичайний список задач"
                }
                onClick={() => setViewMode(key)}
                className={`rounded-full px-3 py-1 ${
                  viewMode === key
                    ? "bg-violet-700 text-white shadow-sm dark:bg-violet-400 dark:text-violet-950"
                    : "bg-violet-100 text-violet-900 hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-100 dark:hover:bg-violet-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            title="Отримати підтримку"
            aria-label="Отримати підтримку"
            onClick={() => setSupportOpen(true)}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-violet-500 bg-violet-50 text-violet-600 shadow-sm transition hover:border-violet-600 hover:bg-violet-100 hover:text-violet-800 dark:border-violet-400 dark:bg-violet-950/60 dark:text-violet-300 dark:hover:border-violet-300 dark:hover:bg-violet-900/70 dark:hover:text-violet-100"
          >
            <IconHugOutline className="size-[1.35rem]" />
          </button>
        </div>
        {viewMode === "list" && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Обери «Борд: 7 днів», щоб побачити сітку з семи стовпців (пн–нд, Київ) і перетягувати задачі між днями.
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <label className="sr-only" htmlFor="task-input">
          Нова задача
        </label>
        <textarea
          id="task-input"
          rows={3}
          className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/40 focus:border-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          placeholder='Наприклад: «Завтра до обіду написати Славі про відео, терміново»'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={saving}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          <label className="flex items-center gap-2">
            <span className="whitespace-nowrap">Ліміт год/тиждень (пн–нд, Київ)</span>
            <input
              type="number"
              min={1}
              max={168}
              step={1}
              value={weeklyCapacity}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (Number.isFinite(v)) setWeeklyCapacity(Math.min(168, Math.max(1, v)));
              }}
              className="w-16 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void addTask()}
            disabled={saving || !input.trim()}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Додаю…" : "Додати задачу"}
          </button>
          <button
            type="button"
            onClick={() => void runSuggest()}
            disabled={suggestLoading || digestLoading}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            {suggestLoading ? "Думаю…" : "Що робити зараз?"}
          </button>
          <button
            type="button"
            onClick={() => void runDigest()}
            disabled={digestLoading || suggestLoading}
            className="rounded-full border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900 transition hover:bg-sky-100 disabled:opacity-50 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-950"
          >
            {digestLoading ? "Збираю…" : "План на сьогодні"}
          </button>
        </div>
      </section>

      {overload && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50">
          <p className="font-medium">Перевантаження тижня</p>
          <p className="mt-2 text-amber-900/90 dark:text-amber-100/90">
            Вже ~{overload.used.toFixed(1)} год з {overload.capacity} год (за дедлайнами в поточному тижні, пн–нд за Києвом). Нова задача ~{overload.newHours.toFixed(1)} год.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setOverload(null);
                void addTask(true);
              }}
              className="rounded-full bg-amber-700 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
            >
              Додати все одно
            </button>
            <button
              type="button"
              onClick={() => setOverload(null)}
              className="rounded-full border border-amber-400 px-4 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900/50"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      {suggest && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50">
          <p className="font-medium">{suggest.intro}</p>
          {suggest.items.length > 0 && (
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              {suggest.items.map((item) => {
                const t = tasks.find((x) => x.id === item.taskId);
                return (
                  <li key={item.taskId}>
                    <span className="font-medium">{t?.title ?? item.taskId}</span>
                    <span className="text-emerald-900/80 dark:text-emerald-100/80">
                      {" "}
                      — {item.reason}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {digest && (
        <section className="rounded-2xl border border-sky-200 bg-sky-50/90 p-4 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-50">
          <h2 className="text-base font-semibold">{digest.headline}</h2>
          {digest.bullets.length > 0 && (
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              {digest.bullets.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-zinc-500">Показати:</span>
        {(
          [
            ["active", "Активні"],
            ["done", "Виконані"],
            ["all", "Усі"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 ${
              filter === key
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-2 text-zinc-500">Сортування:</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="created">За датою створення</option>
          <option value="deadline">За дедлайном</option>
          <option value="priority">За пріоритетом</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-500">Категорія:</span>
        {(
          [
            ["all", "Усі"],
            ["work", "Робота"],
            ["personal", "Особисте"],
            ["learning", "Навчання"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategoryFilter(key)}
            className={`rounded-full px-3 py-1 ${
              categoryFilter === key
                ? "bg-sky-800 text-white dark:bg-sky-300 dark:text-sky-950"
                : "bg-sky-100 text-sky-900 hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:hover:bg-sky-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </p>
      )}

      {wellnessMounted && !loading && wellnessHints.heavy.show && (
        <div className="rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-50">
          <p className="font-medium text-amber-900 dark:text-amber-100">Про план на тиждень</p>
          <p className="mt-2 leading-relaxed text-amber-900/95 dark:text-amber-100/90">
            Ти молодець, що береш на себе стільки на тиждень — це сміливість і небайдужість до своїх цілей.
            І з турботою нагадаю: залиш собі місце на сон, паузи й «нічого не робити», щоб усе встигнути вчасно й
            якісно, без вигорання.
          </p>
        </div>
      )}

      {wellnessMounted && !loading && wellnessHints.showRescheduleNudge && (
        <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/85 px-4 py-3 text-sm text-emerald-950 shadow-sm dark:border-emerald-800/50 dark:bg-emerald-950/35 dark:text-emerald-50">
          <p className="font-medium text-emerald-900 dark:text-emerald-100">Про переноси</p>
          <p className="mt-2 leading-relaxed text-emerald-900/95 dark:text-emerald-100/90">
            Бачу, ти доволі часто підлаштовуєш дедлайни — це нормально: плани живуть разом із життям, а не застигають у
            камені. Ти впораєшся!
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-zinc-500">Завантаження…</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="text-lg font-medium text-zinc-800 dark:text-zinc-100">
            Все зроблено 🎉
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Тут з’являться задачі. Додай першу зліва в полі вище.
          </p>
        </div>
      ) : viewMode === "week" ? (
        <WeekBoard
          tasks={tasks}
          weekOffset={weekOffset}
          onWeekOffset={setWeekOffset}
          onToggleDone={toggleDone}
          onRemove={removeTask}
          onSnooze={snoozeTomorrow}
          onEditTask={setEditorTask}
          onBoardDrop={applyBoardDrop}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => {
            const overdue = isOverdue(task.deadline, task.done);
            const cat = task.category ?? "personal";
            return (
              <li
                key={task.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-zinc-950 ${
                  overdue
                    ? "border-red-400 dark:border-red-700"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => void toggleDone(task)}
                    className="mt-1 size-4 rounded border-zinc-400"
                    aria-label="Позначити виконаною"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p
                      className={`text-left text-base font-medium ${
                        task.done
                          ? "text-zinc-400 line-through"
                          : "text-zinc-900 dark:text-zinc-50"
                      }`}
                    >
                      {task.title}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {priorityEmoji(task.priority)} {task.priority} · {categoryShort(cat)}{" "}
                      {categoryLabel(cat)} · дедлайн:{" "}
                      <span className={overdue ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                        {formatDeadline(task.deadline)}
                      </span>
                      {overdue && !task.done && (
                        <span className="ml-1 text-red-600 dark:text-red-400">(прострочено)</span>
                      )}
                      {task.estimatedHours != null && (
                        <span className="ml-1 text-zinc-600 dark:text-zinc-300">
                          · план ~{task.estimatedHours} год
                        </span>
                      )}
                      {task.spentHours != null && (
                        <span className="ml-1 text-zinc-600 dark:text-zinc-300">
                          · витрачено {task.spentHours} год
                        </span>
                      )}
                    </p>
                    {task.description ? (
                      <p className="line-clamp-3 text-xs text-zinc-600 dark:text-zinc-400">{task.description}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end justify-start gap-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditorTask(task)}
                        className={editIconButtonClass}
                        aria-label="Редагувати задачу"
                        title="Редагувати"
                      >
                        <IconPencil className="size-[1.15rem]" />
                      </button>
                      {!task.done && (
                        <button
                          type="button"
                          onClick={() => void snoozeTomorrow(task)}
                          className={snoozeTomorrowButtonClass}
                        >
                          До завтра
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void removeTask(task.id)}
                        className={deleteIconButtonClass}
                        aria-label="Видалити задачу"
                        title="Видалити"
                      >
                        <IconTrash className="size-[1.15rem]" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && tasks.length > 0 && (
        <p className="text-center text-xs text-zinc-400">
          Активних у поточному списку: {activeCount}
        </p>
      )}
    </div>
  );
}
