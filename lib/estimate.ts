/** Нормалізація оцінки годин з AI або форми: null якщо невалідно. */
export function normalizeEstimatedHours(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string") {
    n = parseFloat(value.replace(",", "."));
  } else return null;
  if (!Number.isFinite(n) || n <= 0) return null;
  const rounded = Math.round(n * 4) / 4;
  return Math.min(80, Math.max(0.25, rounded));
}

/** Фактично витрачений час (0 год дозволено), null якщо поле порожнє / невалідно. */
export function normalizeSpentHours(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string") {
    const t = value.trim();
    if (t === "") return null;
    n = parseFloat(t.replace(",", "."));
  } else return null;
  if (!Number.isFinite(n) || n < 0) return null;
  const rounded = Math.round(n * 4) / 4;
  return Math.min(80, rounded);
}
