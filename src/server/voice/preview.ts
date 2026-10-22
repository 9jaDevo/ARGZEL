import type { Recurrence, ReminderPreview } from '@/types/api';
import { addDays } from '../time';

// Display and read-back strings. Dates are wall-clock YYYY-MM-DD values, so they
// are formatted in UTC to avoid any timezone shift.

const asUtcNoon = (date: string) => new Date(`${date}T12:00:00Z`);
const fmt = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format(asUtcNoon(date));

/** "Fri 23 Oct" / "Friday 23 October", plus the year when it is not this year. Built from parts for consistent punctuation. */
function dateText(date: string, today: string, width: 'short' | 'long') {
  const year = date.slice(0, 4) === today.slice(0, 4) ? '' : ` ${date.slice(0, 4)}`;
  return `${fmt(date, { weekday: width })} ${Number(date.slice(8))} ${fmt(date, { month: width })}${year}`;
}

export const longDate = (date: string, today: string) => dateText(date, today, 'long');

export const weekdayName = (date: string) => fmt(date, { weekday: 'long' });

/** "10:00 AM", matching the frontend's displayTime. */
export function timeLabel(time: string) {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "10 AM" / "7:30 PM", which sounds natural when spoken. */
function spokenTime(time: string) {
  return timeLabel(time).replace(':00 ', ' ');
}

function ordinal(n: number) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

export function dayLabel(date: string, today: string) {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return dateText(date, today, 'short');
}

function recurrenceLabel(recurrence: Recurrence, date: string | null) {
  if (recurrence === 'daily') return 'Every day';
  if (recurrence === 'weekly') return date ? `Every ${weekdayName(date)}` : 'Every week';
  if (recurrence === 'monthly') return date ? `Every month on the ${ordinal(Number(date.slice(8)))}` : 'Every month';
  return 'Does not repeat';
}

/** "today" / "tomorrow" / "on Friday 23 October". */
function spokenDay(date: string, today: string) {
  if (date === today) return 'today';
  if (date === addDays(today, 1)) return 'tomorrow';
  return `on ${longDate(date, today)}`;
}

// Read back in second person: "Renew my hosting" -> "renew your hosting".
const PRONOUNS: Record<string, string> = { my: 'your', me: 'you', myself: 'yourself', mine: 'yours', i: 'you', "i'm": "you're" };
function secondPerson(title: string) {
  const swapped = title.replace(/\b(i'm|myself|mine|my|me|i)\b/gi, (word) => PRONOUNS[word.toLowerCase()]);
  return swapped.charAt(0).toLowerCase() + swapped.slice(1);
}

function readBack(title: string, date: string, time: string, recurrence: Recurrence, today: string) {
  const at = spokenTime(time);
  const when =
    recurrence === 'daily'
      ? `every day at ${at}${date === today ? '' : `, starting ${spokenDay(date, today)}`}`
      : recurrence === 'weekly'
        ? `every ${weekdayName(date)} at ${at}`
        : recurrence === 'monthly'
          ? `every month on the ${ordinal(Number(date.slice(8)))} at ${at}`
          : `${spokenDay(date, today)} at ${at}`;
  return `I'll remind you to ${secondPerson(title)} ${when}. Should I save it?`;
}

export function buildPreview(input: {
  title: string;
  date: string | null;
  time: string | null;
  recurrence: Recurrence;
  question: string | null;
  today: string;
}): ReminderPreview {
  const { title, date, time, recurrence, question, today } = input;
  const displayTitle = title || 'New reminder';
  const when = [date && longDate(date, today), time && `at ${timeLabel(time)}`].filter(Boolean).join(' ');
  return {
    title: displayTitle,
    day_label: date ? dayLabel(date, today) : null,
    time_label: time ? timeLabel(time) : null,
    recurrence_label: recurrenceLabel(recurrence, date),
    channel_label: 'Email',
    summary: when ? `${displayTitle} · ${when}` : displayTitle,
    speech: question ?? (date && time ? readBack(displayTitle, date, time, recurrence, today) : displayTitle),
  };
}
