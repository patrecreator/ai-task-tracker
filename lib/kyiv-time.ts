import { addDays, setHours, setMilliseconds, setMinutes, setSeconds } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const KYIV = "Europe/Kyiv";

/** Завтра (календарний день у Києві) о 09:00 за київським часом → як Date в UTC для Prisma. */
export function getKyivTomorrowNineAmUtc(): Date {
  const kyivNow = toZonedTime(new Date(), KYIV);
  const tomorrowKyiv = addDays(kyivNow, 1);
  const atNine = setMilliseconds(
    setSeconds(setMinutes(setHours(tomorrowKyiv, 9), 0), 0),
    0,
  );
  return fromZonedTime(atNine, KYIV);
}
