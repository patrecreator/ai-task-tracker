"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SupportHugModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

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
        aria-labelledby="support-hug-title"
        className="max-w-md rounded-2xl border-2 border-violet-300 bg-white p-6 shadow-xl dark:border-violet-600 dark:bg-zinc-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="support-hug-title"
          className="text-lg font-semibold tracking-tight text-violet-900 dark:text-violet-100"
        >
          Тобі важко з обсягом — і це нормально
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          Коли задач здається забагато, легко почуватися винним або «недостатнім». Ти не зобов’язаний(-а) встигати
          все одночасно: список — це лише план, а не оцінка твоєї цінності.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          Дозволь собі паузу, перенеси дрібниці або попроси про допомогу. Маленький крок сьогодні — уже перемога.
          Обійми (навіть уявні) — теж важливі.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
        >
          Дякую, трохи легше
        </button>
      </div>
    </div>
  );
}
