"use client";

import { startTransition, useEffect, useState } from "react";
import { datetimeLocalToIso, deadlineToDatetimeLocalValue } from "@/lib/datetime-local";
import { normalizeEstimatedHours, normalizeSpentHours } from "@/lib/estimate";
import type { Task } from "@/lib/task-model";

type Props = {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
};

async function readApiErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { error?: string; hint?: string };
    const parts = [j.error, j.hint].filter(Boolean);
    if (parts.length) return parts.join(" ");
  } catch {
    /* ignore */
  }
  return text.trim() || res.statusText || `Помилка ${res.status}`;
}

export default function TaskEditorModal({ task, open, onClose, onSaved, onError }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadlineLocal, setDeadlineLocal] = useState("");
  const [estimatedRaw, setEstimatedRaw] = useState("");
  const [spentRaw, setSpentRaw] = useState("");
  const [category, setCategory] = useState("personal");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!task) return;
    startTransition(() => {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setDeadlineLocal(deadlineToDatetimeLocalValue(task.deadline));
      setEstimatedRaw(task.estimatedHours != null ? String(task.estimatedHours) : "");
      setSpentRaw(task.spentHours != null ? String(task.spentHours) : "");
      setCategory(task.category ?? "personal");
      setPriority(task.priority ?? "medium");
    });
  }, [task]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !task) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!task) return;
    const t = title.trim();
    if (!t) {
      onError("Назва не може бути порожньою");
      return;
    }
    const deadlineIso =
      deadlineLocal.trim() === "" ? null : datetimeLocalToIso(deadlineLocal.trim());
    if (deadlineLocal.trim() !== "" && deadlineIso === null) {
      onError("Некоректна дата дедлайну");
      return;
    }
    let estimatedHours: number | null = null;
    if (estimatedRaw.trim() !== "") {
      const n = parseFloat(estimatedRaw.replace(",", "."));
      if (!Number.isFinite(n)) {
        onError("Некоректна оцінка часу (план)");
        return;
      }
      estimatedHours = normalizeEstimatedHours(n);
      if (estimatedHours === null) {
        onError("План: від 0,25 до 80 год або залиш поле порожнім");
        return;
      }
    }
    let spentHours: number | null = null;
    if (spentRaw.trim() !== "") {
      const n = parseFloat(spentRaw.replace(",", "."));
      if (!Number.isFinite(n)) {
        onError("Некоректне значення витраченого часу");
        return;
      }
      spentHours = normalizeSpentHours(n);
      if (spentHours === null) {
        onError("Витрачений час не може бути від’ємним");
        return;
      }
    }

    const descTrim = description.trim();
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t.slice(0, 500),
          description: descTrim.length === 0 ? null : descTrim.slice(0, 8000),
          deadline: deadlineIso,
          estimatedHours,
          spentHours,
          category,
          priority,
        }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      onClose();
      await onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Не вдалося зберегти");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-editor-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 id="task-editor-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Редагувати задачу
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            Закрити
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Назва</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              maxLength={500}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Опис</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="resize-y rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              maxLength={8000}
              placeholder="Нотатки, підзадачі, посилання…"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Дедлайн (час за часовим поясом браузера)
            </span>
            <input
              type="datetime-local"
              value={deadlineLocal}
              onChange={(e) => setDeadlineLocal(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={() => setDeadlineLocal("")}
              className="self-start text-xs text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Прибрати дедлайн
            </button>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">План, год</span>
              <input
                type="number"
                min={0.25}
                max={80}
                step={0.25}
                value={estimatedRaw}
                onChange={(e) => setEstimatedRaw(e.target.value)}
                placeholder="порожньо = без оцінки"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <span className="text-[11px] text-zinc-500">Очікуваний час на виконання</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Витрачено, год</span>
              <input
                type="number"
                min={0}
                max={80}
                step={0.25}
                value={spentRaw}
                onChange={(e) => setSpentRaw(e.target.value)}
                placeholder="0 або порожньо"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <span className="text-[11px] text-zinc-500">Фактично витрачений час</span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Категорія</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="work">Робота</option>
                <option value="personal">Особисте</option>
                <option value="learning">Навчання</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Пріоритет</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="high">Високий</option>
                <option value="medium">Середній</option>
                <option value="low">Низький</option>
              </select>
            </label>
          </div>

          <p className="text-xs text-zinc-400">
            Оригінал з чату: <span className="text-zinc-600 dark:text-zinc-300">{task.rawInput}</span>
          </p>

          <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Зберігаю…" : "Зберегти"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
