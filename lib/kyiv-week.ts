import { endOfDay, endOfWeek, startOfWeek } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const KYIV = "Europe/Kyiv";

/** Понеділок 00:00 — неділя 23:59:59.999 за київським часом для календарного тижня, що містить `ref`. */
export function getKyivWeekBoundsUtc(ref: Date): { start: Date; end: Date } {
  const kyiv = toZonedTime(ref, KYIV);
  const weekStartKyiv = startOfWeek(kyiv, { weekStartsOn: 1 });
  const weekEndKyiv = endOfDay(endOfWeek(kyiv, { weekStartsOn: 1 }));
  return {
    start: fromZonedTime(weekStartKyiv, KYIV),
    end: fromZonedTime(weekEndKyiv, KYIV),
  };
}
