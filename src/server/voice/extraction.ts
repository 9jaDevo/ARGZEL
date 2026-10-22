import { z } from 'zod';
import { RECURRENCES } from '../models/Reminder';
import { isRealDate } from '../time';

// What Gemma returns: a description of *when*, not a computed timestamp.
// The deterministic resolver (resolve.ts) turns it into dates, so the model
// never does calendar arithmetic. Every field falls back to a safe default,
// so one bad field never discards the whole answer.

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
export const DAY_PARTS = ['morning', 'afternoon', 'evening', 'night'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type DayPart = (typeof DAY_PARTS)[number];

const lower = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : v);
const text = z.string().trim().min(1).nullable().catch(null);
const choice = <T extends readonly [string, ...string[]]>(values: T) => z.preprocess(lower, z.enum(values).nullable()).catch(null);

/** Accepts "7:05" as well as "07:05"; anything else becomes null. */
function normalizeTime(value: string | null) {
  const match = value?.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match || Number(match[1]) > 23) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export const extractionSchema = z.object({
  title: text,
  notes: text,
  date: z.string().refine(isRealDate).nullable().catch(null),
  day_offset: z.number().int().min(0).max(366).nullable().catch(null),
  day_of_month: z.number().int().min(1).max(31).nullable().catch(null),
  weekday: choice(WEEKDAYS),
  weekday_modifier: choice(['this', 'next'] as const),
  minute_offset: z.number().int().min(1).max(525_600).nullable().catch(null),
  time: z.string().nullable().catch(null).transform(normalizeTime),
  time_ambiguous_meridiem: z.boolean().catch(false),
  day_part: choice(DAY_PARTS),
  recurrence: z.preprocess(lower, z.enum(RECURRENCES)).catch('none'),
  recurrence_unsupported: z.boolean().catch(false),
  confidence: z.number().min(0).max(1).catch(0.5),
  clarification_question: text,
});

export type Extraction = z.output<typeof extractionSchema> & {
  /** Set when the user picked a time from the clarification options (skips the AM/PM check). */
  time_confirmed?: boolean;
};

/** Pulls the JSON object out of a model reply (tolerates code fences and stray prose). */
export function parseExtraction(raw: string): Extraction | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return extractionSchema.parse(value);
}
