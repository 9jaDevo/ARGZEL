import type { AmbiguityCode, ClarificationOption, ParseResult, Recurrence } from '@/types/api';
import { addDays, addMonths, nextRecurrenceDate, utcToZoned, weekdayIndex, zonedToUtc } from '../time';
import { WEEKDAYS, type DayPart, type Extraction, type Weekday } from './extraction';
import { buildPreview, longDate, timeLabel, weekdayName } from './preview';

// Deterministic second half of parsing: turns Gemma's description of *when*
// into concrete dates in the user's timezone, decides whether to ask a
// clarifying question, and pre-computes the quick-answer options.

export type ResolveContext = {
  now: Date;
  timezone: string;
  /** What the user said (including any clarification answer). */
  sourceText: string;
};

const PAST_GRACE_MS = 60_000;
const UNCLEAR_BELOW = 0.6;

/** Asked in this order; only the first applicable question is shown. */
const QUESTION_ORDER: AmbiguityCode[] = [
  'missing_title',
  'missing_when',
  'ambiguous_next_weekday',
  'ambiguous_meridiem', // before time_in_past: "today at 8" said at 9 AM may mean 8 PM
  'time_in_past',
  'vague_time',
  'missing_time',
  'unsupported_recurrence',
  'unclear',
];

// These leave the moment itself unsettled, so no scheduled_at is returned.
const TIME_ISSUES = new Set<AmbiguityCode>([
  'missing_when',
  'ambiguous_next_weekday',
  'time_in_past',
  'vague_time',
  'missing_time',
  'ambiguous_meridiem',
]);

const DAY_PART_TIMES: Record<DayPart, string[]> = {
  morning: ['08:00', '09:00', '10:00'],
  afternoon: ['13:00', '14:00', '15:00'],
  evening: ['18:00', '19:00', '20:00'],
  night: ['20:00', '21:00', '22:00'],
};
const SUGGESTED_TIMES = ['09:00', '13:00', '18:00'];

const RECURRENCE_CHOICES: [string, Recurrence][] = [
  ['Every day', 'daily'],
  ['Every week', 'weekly'],
  ['Every month', 'monthly'],
  ["Don't repeat", 'none'],
];

// A bare "at 7" is AM/PM-ambiguous unless something in the sentence settles it.
const MERIDIEM_CONTEXT =
  /\d\s*(a\.?m\.?|p\.?m\.?)(?![a-z])|\b(morning|afternoon|evening|night|tonight|noon|midday|midnight|breakfast|lunch|dinner)\b|\b(0\d|1[3-9]|2[0-3]):[0-5]\d\b/i;

function tidyTitle(title: string | null) {
  const cleaned = (title ?? '')
    .replace(/^\s*(please\s+)?(remind\s+me\s+(to|about|that)\s+)/i, '')
    .replace(/[.!?\s]+$/, '')
    .trim()
    .slice(0, 200);
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

type WeekdayResolution = { date: string; candidates?: undefined } | { date?: undefined; candidates: [string, string] };

/**
 * "Friday" / "this Friday" = the coming Friday (today if the time is still ahead).
 * "next Friday" is ambiguous when the coming Friday is under 6 days away, so both
 * readings are offered; from 6 days out it can only mean the coming one.
 */
function resolveWeekday(weekday: Weekday, modifier: 'this' | 'next' | null, today: { date: string; time: string }, time: string | null): WeekdayResolution {
  const delta = (WEEKDAYS.indexOf(weekday) - weekdayIndex(today.date) + 7) % 7;
  if (modifier === 'next') {
    const coming = addDays(today.date, delta === 0 ? 7 : delta);
    return (delta === 0 ? 7 : delta) >= 6 ? { date: coming } : { candidates: [coming, addDays(coming, 7)] };
  }
  if (delta === 0) return { date: !time || time > today.time ? today.date : addDays(today.date, 7) };
  return { date: addDays(today.date, delta) };
}

/** "On the 5th": this month's 5th if still ahead, else next month's (clamped to short months). */
function resolveDayOfMonth(day: number, today: { date: string; time: string }, time: string | null) {
  const inMonth = (offset: number) => {
    const first = addMonths(`${today.date.slice(0, 8)}01`, offset);
    const lastDay = Number(addDays(addMonths(first, 1), -1).slice(8));
    return `${first.slice(0, 8)}${String(Math.min(day, lastDay)).padStart(2, '0')}`;
  };
  const thisMonth = inMonth(0);
  const stillAhead = thisMonth > today.date || (thisMonth === today.date && (!time || time > today.time));
  return stillAhead ? thisMonth : inMonth(1);
}

export function resolveReminder(x: Extraction, ctx: ResolveContext): ParseResult {
  const { now, timezone, sourceText } = ctx;
  const today = utcToZoned(now, timezone);
  const issues = new Set<AmbiguityCode>();

  const title = tidyTitle(x.title);
  if (!title) issues.add('missing_title');
  if (x.recurrence_unsupported) issues.add('unsupported_recurrence');

  let date: string | null = null;
  let time: string | null = null;
  let at: Date | null = null;
  let candidates: [string, string] | null = null;

  if (x.minute_offset) {
    // "in two hours": exact, rounded up to the next whole minute.
    at = new Date(Math.ceil((now.getTime() + x.minute_offset * 60_000) / 60_000) * 60_000);
    ({ date, time } = utcToZoned(at, timezone));
  } else {
    time = x.time;
    if (time && !x.time_confirmed && (x.time_ambiguous_meridiem || !MERIDIEM_CONTEXT.test(sourceText))) {
      issues.add('ambiguous_meridiem');
    }

    date =
      x.date ??
      (x.day_offset !== null ? addDays(today.date, x.day_offset) : null) ??
      (x.day_of_month !== null ? resolveDayOfMonth(x.day_of_month, today, time) : null);
    if (!date && x.weekday) {
      const resolved = resolveWeekday(x.weekday, x.weekday_modifier, today, time);
      if (resolved.candidates) {
        candidates = resolved.candidates;
        issues.add('ambiguous_next_weekday');
      } else {
        date = resolved.date;
      }
    }

    if (!time) {
      if (!date && !candidates && !x.day_part) issues.add('missing_when');
      else issues.add(x.day_part ? 'vague_time' : 'missing_time');
    } else if (!date && !candidates) {
      // A time with no day means the next time it comes round.
      date = time > today.time ? today.date : addDays(today.date, 1);
    }

    if (date && time) {
      at = zonedToUtc(date, time, timezone);
      if (at.getTime() < now.getTime() - PAST_GRACE_MS) {
        if (x.recurrence !== 'none') {
          // A repeating reminder simply starts at its next future occurrence.
          for (let i = 0; i < 400 && at.getTime() < now.getTime(); i++) {
            date = nextRecurrenceDate(date, x.recurrence);
            at = zonedToUtc(date, time, timezone);
          }
        } else {
          issues.add('time_in_past');
        }
      }
    }
  }

  if (x.clarification_question && x.confidence < UNCLEAR_BELOW) issues.add('unclear');

  const ambiguities = QUESTION_ORDER.filter((code) => issues.has(code));
  const asked = ambiguities[0] ?? null;
  const unsettled = ambiguities.some((code) => TIME_ISSUES.has(code));
  const shownTime = issues.has('ambiguous_meridiem') ? null : time;

  const question = asked ? questionFor(asked, { x, date, time, candidates, today: today.date }) : null;
  const confidence = Math.round((asked ? Math.min(x.confidence, 0.5) : x.confidence) * 100) / 100;

  return {
    title,
    notes: x.notes ?? '',
    source_text: sourceText,
    timezone,
    recurrence: x.recurrence,
    scheduled_at: at && !unsettled ? at.toISOString() : null,
    date,
    time: shownTime,
    confidence,
    needs_clarification: asked !== null,
    clarification_question: question,
    ambiguities,
    options: asked ? optionsFor(asked, { x, ctx, date, time, candidates, today: today.date }) : [],
    preview: buildPreview({ title, date, time: shownTime, recurrence: x.recurrence, question, today: today.date }),
  };
}

type QuestionState = { x: Extraction; date: string | null; time: string | null; candidates: [string, string] | null; today: string };

function meridiemPair(time: string) {
  const [h, m] = time.split(':');
  const hour = Number(h) % 12;
  const pad = (n: number) => `${String(n).padStart(2, '0')}:${m}`;
  return [pad(hour), pad(hour + 12)] as const;
}

function questionFor(code: AmbiguityCode, { x, date, time, candidates, today }: QuestionState): string {
  switch (code) {
    case 'missing_title':
      return 'What should I remind you about?';
    case 'missing_when':
      return 'When should I remind you?';
    case 'ambiguous_next_weekday':
      return `Do you mean ${longDate(candidates![0], today)} or ${longDate(candidates![1], today)}?`;
    case 'time_in_past':
      return 'That time has already passed. When should I remind you instead?';
    case 'vague_time': {
      const part = x.day_part!;
      if (!date) return part === 'night' ? 'What time tonight?' : `What time in the ${part}?`;
      if (date === today) return part === 'night' ? 'What time tonight?' : `What time this ${part}?`;
      if (date === addDays(today, 1)) return `What time tomorrow ${part}?`;
      return `What time on ${weekdayName(date)} ${part}?`;
    }
    case 'missing_time':
      if (date === today) return 'What time today?';
      if (date === addDays(today, 1)) return 'What time tomorrow?';
      return date ? `What time on ${longDate(date, today)}?` : 'What time?';
    case 'ambiguous_meridiem': {
      const [am, pm] = meridiemPair(time!);
      return `Is that ${timeLabel(am)} or ${timeLabel(pm)}?`;
    }
    case 'unsupported_recurrence':
      return 'I can repeat reminders every day, week or month. Which would you like?';
    case 'unclear':
      return x.clarification_question!;
  }
}

/**
 * Quick answers, each fully re-resolved. Every option settles the issue it
 * answers, so the recursion is shallow (at most a few levels).
 */
function optionsFor(
  code: AmbiguityCode,
  { x, ctx, date, time, candidates, today }: QuestionState & { ctx: ResolveContext },
): ClarificationOption[] {
  const option = (label: string, patch: Partial<Extraction>) => ({ label, result: resolveReminder({ ...x, ...patch }, ctx) });
  const timeOptions = (times: string[]) => times.map((t) => option(timeLabel(t), { time: t, time_confirmed: true }));

  switch (code) {
    case 'ambiguous_next_weekday':
      return candidates!.map((d) => option(longDate(d, today), { date: d }));
    case 'vague_time':
      return timeOptions(DAY_PART_TIMES[x.day_part!]);
    case 'missing_time':
      return timeOptions(SUGGESTED_TIMES);
    case 'ambiguous_meridiem':
      return timeOptions([...meridiemPair(time!)]);
    case 'time_in_past': {
      const tomorrow = addDays(today, 1);
      const next = option(`Tomorrow at ${timeLabel(time!)}`, { date: tomorrow, time_confirmed: true });
      return date && date <= tomorrow && !next.result.ambiguities.includes('time_in_past') ? [next] : [];
    }
    case 'unsupported_recurrence':
      return RECURRENCE_CHOICES.map(([label, recurrence]) => option(label, { recurrence, recurrence_unsupported: false }));
    default:
      return [];
  }
}
