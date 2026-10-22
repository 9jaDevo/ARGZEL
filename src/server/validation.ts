import { z } from 'zod';
import { validationError } from './http';
import { RECURRENCES, REMINDER_STATUSES, type ReminderStatus } from './models/Reminder';
import { isRealDate, isValidTimeZone, zonedToUtc } from './time';

// Friendlier than Zod's default "Invalid input: expected string, received undefined".
z.config({
  customError: (issue) => (issue.code === 'invalid_type' && issue.input === undefined ? 'This field is required' : undefined),
});

const atLeastOneField = (value: object) => Object.values(value).some((v) => v !== undefined);

// ---- Shared fields ----

const name = z.string().trim().min(1, 'Name is required').max(80, 'Name must be 80 characters or fewer');
const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));
const timezone = z.string().trim().refine(isValidTimeZone, 'Use a valid IANA timezone, e.g. Africa/Lagos');

// ---- Auth & profile ----

export const signUpSchema = z.object({
  name,
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be 128 characters or fewer'),
  timezone: timezone.default('UTC'),
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(128, 'Password must be 128 characters or fewer'),
});

export const updateMeSchema = z
  .object({ name: name.optional(), timezone: timezone.optional(), onboarding_completed: z.boolean().optional() })
  .refine(atLeastOneField, 'Send at least one field to update');

// ---- Reminders ----

const title = z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer');
const notes = z.string().trim().max(1000, 'Notes must be 1000 characters or fewer');
const recurrence = z.enum(RECURRENCES, `Use one of: ${RECURRENCES.join(', ')}`);

// A reminder time is either an absolute `scheduled_at` (ISO 8601 with offset)
// or a wall-clock `date` + `time` interpreted in the reminder's timezone.
const scheduleFields = {
  scheduled_at: z.iso.datetime({ offset: true, error: 'Use an ISO 8601 date-time, e.g. 2026-10-23T10:00:00+01:00' }).optional(),
  date: z.string().refine(isRealDate, 'Use a real date in YYYY-MM-DD format').optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm, e.g. 09:30').optional(),
};
type ScheduleInput = { scheduled_at?: string; date?: string; time?: string };

const SCHEDULE_REQUIRED = 'Send scheduled_at, or date and time';
const PAST_GRACE_MS = 60_000; // tolerate clock skew and time spent on the confirm screen

function checkSchedule(value: ScheduleInput, ctx: z.RefinementCtx, required: boolean) {
  if (value.scheduled_at && (value.date || value.time)) {
    ctx.addIssue({ code: 'custom', path: ['scheduled_at'], message: 'Send either scheduled_at or date and time, not both' });
  } else if (value.date && !value.time) {
    ctx.addIssue({ code: 'custom', path: ['time'], message: 'time is required when date is sent' });
  } else if (value.time && !value.date) {
    ctx.addIssue({ code: 'custom', path: ['date'], message: 'date is required when time is sent' });
  } else if (required && !hasSchedule(value)) {
    ctx.addIssue({ code: 'custom', path: ['scheduled_at'], message: SCHEDULE_REQUIRED });
  }
}

export const hasSchedule = (value: ScheduleInput) => Boolean(value.scheduled_at || value.date || value.time);

/** Resolves the schedule fields to a UTC instant, rejecting times in the past. */
export function futureInstant(value: ScheduleInput, timeZone: string) {
  const at = value.scheduled_at
    ? new Date(value.scheduled_at)
    : value.date && value.time
      ? zonedToUtc(value.date, value.time, timeZone)
      : null;
  if (!at) throw validationError({ scheduled_at: [SCHEDULE_REQUIRED] });
  if (at.getTime() < Date.now() - PAST_GRACE_MS) throw validationError({ scheduled_at: ['Pick a time in the future'] });
  return at;
}

export const createReminderSchema = z
  .object({
    // The spec's non-negotiable: nothing is saved until the user confirms the preview.
    confirmed: z.literal(true, 'Reminders are saved only after the user confirms them (send confirmed: true)'),
    title,
    notes: notes.default(''),
    source_text: z.string().trim().max(2000, 'source_text must be 2000 characters or fewer').default(''),
    timezone,
    recurrence: recurrence.default('none'),
    ai_confidence: z.number().min(0).max(1).nullable().default(null),
    ...scheduleFields,
  })
  .superRefine((value, ctx) => checkSchedule(value, ctx, true));

// `delivered` is set by the scheduler only, so clients cannot send it.
const EDITABLE_STATUSES = ['scheduled', 'completed', 'cancelled'] as const satisfies readonly ReminderStatus[];

export const updateReminderSchema = z
  .object({
    title: title.optional(),
    notes: notes.optional(),
    timezone: timezone.optional(),
    recurrence: recurrence.optional(),
    status: z.enum(EDITABLE_STATUSES, `Use one of: ${EDITABLE_STATUSES.join(', ')}`).optional(),
    ...scheduleFields,
  })
  .refine(atLeastOneField, 'Send at least one field to update')
  .superRefine((value, ctx) => checkSchedule(value, ctx, false));

// ---- Voice ----

export const parseInputSchema = z.object({
  /** The transcript (or typed text) to turn into a reminder preview. */
  text: z.string().trim().min(1, 'Say or type a reminder first').max(500, 'Keep it under 500 characters'),
  /** Defaults to the user's profile timezone. */
  timezone: timezone.optional(),
  /** A free-form answer to the previous clarification_question. */
  clarification: z
    .object({
      question: z.string().trim().min(1).max(300),
      answer: z.string().trim().min(1, 'Answer the question first').max(300),
    })
    .optional(),
});

export const listRemindersQuerySchema = z.object({
  status: z.enum(REMINDER_STATUSES, `Use one of: ${REMINDER_STATUSES.join(', ')}`).optional(),
  limit: z.coerce.number('limit must be a number').int().min(1).max(200).default(100),
});
