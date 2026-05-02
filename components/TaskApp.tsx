"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { priorityEmoji } from "@/lib/priority";

export type Task = {
  id: string;
  rawInput: string;
  title: string;
  priority: string;
  deadline: string | null;
  done: boolean;
  createdAt: string;
};

type Filter = "all" | "active" | "done";
type Sort = "created" | "deadline" | "priority";

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

async function readApiErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
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
  return text.trim() || res.statusText || `Помилка ${res.status}`;
}

export default function TaskApp() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [sort, setSort] = useState<Sort>("created");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [suggest, setSuggest] = useState<{
    intro: string;
    items: { taskId: string; reason: string }[];
  } | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks?filter=${filter}&sort=${sort}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = (await res.json()) as Task[];
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося завантажити задачі");
    } finally {
      setLoading(false);
    }
  }, [filter, sort]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const activeCount = useMemo(
    () => tasks.filter((t) => !t.done).length,
    [tasks],
  );

  async function addTask() {
    const raw = input.trim();
    if (!raw) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput: raw }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
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

  async function removeTask(id: string) {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося видалити задачу");
    }
  }

  async function saveTitle(id: string) {
    const title = editTitle.trim();
    if (!title) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося зберегти назву");
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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          AI таск-трекер
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Напиши задачу як колезі в Slack — штучний інтелект розбере назву, пріоритет
          і дедлайн.
        </p>
      </header>

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
            disabled={suggestLoading}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            {suggestLoading ? "Думаю…" : "Що робити зараз?"}
          </button>
        </div>
      </section>

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

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </p>
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
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => {
            const overdue = isOverdue(task.deadline, task.done);
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
                    {editingId === task.id ? (
                      <div className="flex flex-wrap gap-2">
                        <input
                          className="min-w-[12rem] flex-1 rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="rounded-lg bg-zinc-900 px-3 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
                          onClick={() => void saveTitle(task.id)}
                        >
                          Зберегти
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-600"
                          onClick={() => setEditingId(null)}
                        >
                          Скасувати
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={`text-left text-base font-medium ${
                          task.done
                            ? "text-zinc-400 line-through"
                            : "text-zinc-900 dark:text-zinc-50"
                        }`}
                        onClick={() => {
                          setEditingId(task.id);
                          setEditTitle(task.title);
                        }}
                      >
                        {task.title}
                      </button>
                    )}
                    <p className="text-xs text-zinc-500">
                      {priorityEmoji(task.priority)} {task.priority} · дедлайн:{" "}
                      <span className={overdue ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                        {formatDeadline(task.deadline)}
                      </span>
                      {overdue && !task.done && (
                        <span className="ml-1 text-red-600 dark:text-red-400">(прострочено)</span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      Оригінал: {task.rawInput}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeTask(task.id)}
                    className="shrink-0 text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Видалити
                  </button>
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
