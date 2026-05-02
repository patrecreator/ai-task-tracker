import { setDate, setHours, setMilliseconds, setMinutes, setMonth, setSeconds, setYear } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const KYIV = "Europe/Kyiv";

/**
 * Переносить дедлайн на календарний день `targetYmd` (YYYY-MM-DD) у Києві.
 * Час доби в Київському поясі зберігається з поточного дедлайну; якщо дедлайну не було — 09:00.
 */
export function shiftDeadlineToKyivYmd(currentDeadlineIso: string | null, targetYmd: string): Date {
  const parts = targetYmd.split("-").map((x) => parseInt(x, 10));
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    throw new Error("Invalid targetYmd");
  }
  const anchor = currentDeadlineIso ? new Date(currentDeadlineIso) : new Date();
  let kyiv = toZonedTime(anchor, KYIV);
  kyiv = setYear(kyiv, y);
  kyiv = setMonth(kyiv, mo - 1);
  kyiv = setDate(kyiv, d);
  if (!currentDeadlineIso) {
    kyiv = setHours(kyiv, 9);
    kyiv = setMinutes(kyiv, 0);
    kyiv = setSeconds(kyiv, 0);
    kyiv = setMilliseconds(kyiv, 0);
  }
  return fromZonedTime(kyiv, KYIV);
}
