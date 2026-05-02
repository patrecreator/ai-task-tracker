import { addDays, addWeeks, startOfWeek } from "date-fns";
import { uk } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

const KYIV = "Europe/Kyiv";

export type KyivWeekDayMeta = {
  ymd: string;
  weekdayShort: string;
  dayMonth: string;
};

/** Сім днів понеділок–неділя за київським календарем; `weekOffset` — зсув від тижня, що містить `anchor`. */
export function getKyivWeekDayMetas(anchor: Date, weekOffset: number): KyivWeekDayMeta[] {
  const shifted = addWeeks(anchor, weekOffset);
  const kyiv = toZonedTime(shifted, KYIV);
  const mondayKyiv = startOfWeek(kyiv, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => {
    const dKyiv = addDays(mondayKyiv, i);
    const utc = fromZonedTime(dKyiv, KYIV);
    return {
      ymd: formatInTimeZone(utc, KYIV, "yyyy-MM-dd"),
      weekdayShort: formatInTimeZone(utc, KYIV, "EEE", { locale: uk }),
      dayMonth: formatInTimeZone(utc, KYIV, "d MMM", { locale: uk }),
    };
  });
}

/** Календарний день дедлайну в Києві (YYYY-MM-DD). */
export function deadlineKyivYmd(deadlineIso: string | null | undefined): string | null {
  if (!deadlineIso) return null;
  const d = new Date(deadlineIso);
  if (Number.isNaN(d.getTime())) return null;
  return formatInTimeZone(d, KYIV, "yyyy-MM-dd");
}

export function formatDeadlineTimeKyiv(deadlineIso: string): string {
  const d = new Date(deadlineIso);
  if (Number.isNaN(d.getTime())) return "";
  return formatInTimeZone(d, KYIV, "HH:mm");
}
