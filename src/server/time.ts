// Timezone helpers built on Intl, so no date library is needed.
// Reminders store `scheduled_at` as a UTC instant plus the IANA `timezone`
// the user meant; `date`/`time` are the wall-clock view in that timezone.

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isRealDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

// Calendar arithmetic on YYYY-MM-DD wall dates (no timezone involved).
const toIsoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dateParts = (date: string) => date.split('-').map(Number) as [number, number, number];

export function addDays(date: string, days: number) {
  const [y, m, d] = dateParts(date);
  return toIsoDate(Date.UTC(y, m - 1, d + days));
}

/** Adds months, clamping to the month's last day (Jan 31 + 1 month = Feb 28). */
export function addMonths(date: string, months: number) {
  const [y, m, d] = dateParts(date);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return toIsoDate(Date.UTC(y, m - 1 + months, Math.min(d, lastDay)));
}

/** The next wall-clock date of a repeating reminder. */
export function nextRecurrenceDate(date: string, recurrence: 'daily' | 'weekly' | 'monthly') {
  return recurrence === 'daily' ? addDays(date, 1) : recurrence === 'weekly' ? addDays(date, 7) : addMonths(date, 1);
}

/**
 * First occurrence strictly after `after`, keeping the same wall-clock time in
 * `timeZone` (so a 7 AM reminder stays 7 AM across daylight saving changes).
 */
export function nextOccurrenceAfter(
  current: Date,
  recurrence: 'daily' | 'weekly' | 'monthly',
  timeZone: string,
  after: Date,
) {
  let { date } = utcToZoned(current, timeZone);
  const { time } = utcToZoned(current, timeZone);
  let next = current;
  for (let i = 0; i < 1000 && next.getTime() <= after.getTime(); i++) {
    date = nextRecurrenceDate(date, recurrence);
    next = zonedToUtc(date, time, timeZone);
  }
  return next;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayIndex(date: string) {
  const [y, m, d] = dateParts(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function wallClockParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** Milliseconds the timezone is ahead of UTC at the given instant. */
function offsetAt(ms: number, timeZone: string) {
  const p = wallClockParts(new Date(ms), timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** Converts a wall-clock date ('2026-10-23') and time ('10:00') in `timeZone` to a UTC instant. */
export function zonedToUtc(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const asIfUtc = Date.UTC(y, m - 1, d, hh, mm);
  const first = asIfUtc - offsetAt(asIfUtc, timeZone);
  // A second pass corrects the guess when it lands across a DST change.
  const second = asIfUtc - offsetAt(first, timeZone);
  return new Date(second);
}

/** Wall-clock date (YYYY-MM-DD) and time (HH:mm) of an instant in `timeZone`. */
export function utcToZoned(instant: Date, timeZone: string) {
  const p = wallClockParts(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}
