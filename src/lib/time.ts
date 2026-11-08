import { TIMEZONE } from "./config";

/** Calendar date (no time) as {y, m, d}. Arithmetic is done in UTC to avoid DST drift. */
export interface CalDate {
  y: number;
  m: number; // 1-12
  d: number;
}

export function toISODate(c: CalDate): string {
  return `${c.y}-${String(c.m).padStart(2, "0")}-${String(c.d).padStart(2, "0")}`;
}

export function parseISODate(s: string): CalDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const c = { y: +m[1], m: +m[2], d: +m[3] };
  const check = new Date(Date.UTC(c.y, c.m - 1, c.d));
  if (check.getUTCMonth() !== c.m - 1 || check.getUTCDate() !== c.d) return null;
  return c;
}

export function addDays(c: CalDate, days: number): CalDate {
  const dt = new Date(Date.UTC(c.y, c.m - 1, c.d + days));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function weekdayOf(c: CalDate): number {
  return new Date(Date.UTC(c.y, c.m - 1, c.d)).getUTCDay();
}

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Wall-clock parts of an instant in Asia/Jerusalem. */
export function zonedParts(instant: Date) {
  const p: Record<string, number> = {};
  for (const part of partsFmt.formatToParts(instant)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return { y: p.year, m: p.month, d: p.day, hh: p.hour, mm: p.minute, ss: p.second };
}

export function zonedToday(instant: Date): CalDate {
  const { y, m, d } = zonedParts(instant);
  return { y, m, d };
}

/**
 * Converts a wall-clock time in Asia/Jerusalem to a UTC instant.
 * Handles DST by measuring the zone offset at the guessed instant (twice, so
 * times next to a transition settle correctly).
 */
export function zonedTimeToUtc(c: CalDate, time: string): Date {
  const [hh, mm] = time.split(":").map(Number);
  const asUtc = Date.UTC(c.y, c.m - 1, c.d, hh, mm);
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess));
    const wall = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
    guess = guess - (wall - asUtc);
  }
  return new Date(guess);
}

const WEEKDAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export function weekdayHe(day: number): string {
  return WEEKDAYS_HE[day] ?? "";
}

/** "13.11" */
export function shortDateHe(iso: string): string {
  const c = parseISODate(iso);
  return c ? `${c.d}.${c.m}` : iso;
}

/** "שישי, 13 בנובמבר" */
export function longDateHe(iso: string): string {
  const c = parseISODate(iso);
  if (!c) return iso;
  const noon = new Date(Date.UTC(c.y, c.m - 1, c.d, 12));
  const month = new Intl.DateTimeFormat("he-IL", { month: "long", timeZone: "UTC" }).format(noon);
  return `${weekdayHe(weekdayOf(c))}, ${c.d} ב${month}`;
}

export function formatDateTimeHe(instant: string | Date): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}
