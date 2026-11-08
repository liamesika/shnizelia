import type { FridayOverride, Settings } from "./types";
import { addDays, parseISODate, toISODate, weekdayOf, zonedTimeToUtc, zonedToday, type CalDate } from "./time";

export interface OrderingCycle {
  /** True when a Friday is open for new orders right now. */
  open: boolean;
  /** Friday being ordered for (YYYY-MM-DD). null when nothing is open. */
  fridayDate: string | null;
  /** UTC ISO instant of that Friday's cutoff. */
  deadline: string | null;
  /** The nearest Friday is past its cutoff (or closed) and ordering rolled to a later one. */
  rolledOver: boolean;
  /** Why ordering is closed, when open=false. */
  closedReason: "paused" | "no_friday" | null;
}

const FRIDAY = 5;

/** Nearest Friday on or after `from`. */
export function nextFriday(from: CalDate): CalDate {
  const diff = (FRIDAY - weekdayOf(from) + 7) % 7;
  return addDays(from, diff);
}

/** Cutoff instant for a Friday, e.g. Thursday 16:00 Asia/Jerusalem the day before. */
export function cutoffFor(friday: CalDate, weekday: number, time: string): Date {
  const daysBefore = (FRIDAY - weekday + 7) % 7;
  return zonedTimeToUtc(addDays(friday, -daysBefore), time);
}

/** Resolves which Friday is orderable at `now`. Pure — no I/O. */
export function getOrderingCycle(now: Date, settings: Settings, overrides: FridayOverride[]): OrderingCycle {
  if (!settings.orderingOpen) {
    return { open: false, fridayDate: null, deadline: null, rolledOver: false, closedReason: "paused" };
  }
  const closed = new Set(overrides.filter((o) => o.closed).map((o) => o.date));
  const first = nextFriday(zonedToday(now));
  const lookahead = Math.max(1, Math.min(8, settings.weeksAhead + 1));

  for (let k = 0; k < lookahead; k++) {
    const friday = addDays(first, 7 * k);
    const iso = toISODate(friday);
    const deadline = cutoffFor(friday, settings.cutoffWeekday, settings.cutoffTime);
    if (now.getTime() < deadline.getTime() && !closed.has(iso)) {
      return {
        open: true,
        fridayDate: iso,
        deadline: deadline.toISOString(),
        rolledOver: k > 0,
        closedReason: null,
      };
    }
  }
  return { open: false, fridayDate: null, deadline: null, rolledOver: true, closedReason: "no_friday" };
}

/** True if `fridayDate` is still orderable at `now` — used server-side right before charging. */
export function isFridayOrderable(
  fridayDate: string,
  now: Date,
  settings: Settings,
  overrides: FridayOverride[],
): boolean {
  const cycle = getOrderingCycle(now, settings, overrides);
  return cycle.open && cycle.fridayDate === fridayDate;
}

/** Fridays to show in the admin date picker: a few back, a few ahead. */
export function adminFridays(now: Date, back = 4, ahead = 4): string[] {
  const first = nextFriday(zonedToday(now));
  const out: string[] = [];
  for (let k = -back; k <= ahead; k++) out.push(toISODate(addDays(first, 7 * k)));
  return out;
}

export function isFriday(iso: string): boolean {
  const c = parseISODate(iso);
  return !!c && weekdayOf(c) === FRIDAY;
}
