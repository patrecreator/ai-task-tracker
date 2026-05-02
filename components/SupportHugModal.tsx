"use client";

import { useEffect } from "react";
import { SUPPORT_MESSAGES } from "@/lib/support-messages";

type Props = {
  open: boolean;
  messageIndex: number;
  onClose: () => void;
};

export default function SupportHugModal({ open, messageIndex, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const safeIndex =
    Number.isInteger(messageIndex) && messageIndex >= 0 && messageIndex < SUPPORT_MESSAGES.length
      ? messageIndex
      : 0;
  const msg = SUPPORT_MESSAGES[safeIndex];

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
          {msg.title}
        </h2>
        {msg.paragraphs.map((paragraph, i) => (
          <p
            key={i}
            className={`text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 ${i === 0 ? "mt-3" : "mt-2"}`}
          >
            {paragraph}
          </p>
        ))}
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
