// ARGZEL API contract, shared by the route handlers and the frontend.
// Endpoints live under /api, accept and return JSON, and authenticate with an
// httpOnly session cookie set by sign-up/sign-in (fetch sends it automatically
// on same-origin requests). Full reference: docs/BACKEND.md.
import type { z } from 'zod';
import type {
  createReminderSchema,
  listRemindersQuerySchema,
  parseInputSchema,
  signInSchema,
  signUpSchema,
  updateMeSchema,
  updateReminderSchema,
} from '@/server/validation';

import type { DeliveryChannel, Recurrence, ReminderStatus } from '@/server/models/Reminder';

// Recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
// ReminderStatus: 'scheduled' | 'delivered' | 'completed' | 'cancelled' | 'failed'
//   failed = a one-off reminder whose email could not be sent after all retries
// DeliveryChannel: 'email' (the only MVP channel)
export type { DeliveryChannel, Recurrence, ReminderStatus };

// ---- Resources ----

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  /** IANA timezone, e.g. "Africa/Lagos" */
  timezone: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiReminder {
  id: string;
  title: string;
  notes: string;
  /** What the user said, verbatim. Empty for reminders created without voice. */
  source_text: string;
  /** UTC instant, ISO 8601 (e.g. "2026-10-23T09:00:00.000Z") */
  scheduled_at: string;
  /** Wall-clock date in `timezone`, YYYY-MM-DD */
  date: string;
  /** Wall-clock time in `timezone`, 24-hour HH:mm */
  time: string;
  timezone: string;
  recurrence: Recurrence;
  status: ReminderStatus;
  delivery_channel: DeliveryChannel;
  /** 0–1 from the AI parser, or null when entered manually */
  ai_confidence: number | null;
  /**
   * When the last reminder email went out (repeating reminders keep status `scheduled`).
   * Always present in API responses; optional so client-side mocks stay valid.
   */
  last_delivered_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Voice parsing (preview before confirmation) ----

/** Why a parse needs a follow-up question. Listed in the order they are asked. */
export type AmbiguityCode =
  | 'missing_title' // "Remind me tomorrow at 9", but about what?
  | 'missing_when' // no date or time at all
  | 'ambiguous_next_weekday' // "next Friday" could mean this week's or the following week's
  | 'ambiguous_meridiem' // "at 7": AM or PM?
  | 'time_in_past' // "today at 8 AM", said at 9 AM
  | 'vague_time' // "tomorrow morning": a part of the day, no clock time
  | 'missing_time' // a day but no time
  | 'unsupported_recurrence' // "every other day" (only daily/weekly/monthly exist)
  | 'unclear'; // the model flagged something else and is not confident

/** Display-ready strings for the preview card and the spoken read-back. */
export interface ReminderPreview {
  title: string;
  /** "Today", "Tomorrow" or "Fri 23 Oct"; null until the day is known */
  day_label: string | null;
  /** "10:00 AM"; null until the time is known */
  time_label: string | null;
  /** "Does not repeat", "Every day", "Every Monday", "Every month on the 5th" */
  recurrence_label: string;
  channel_label: 'Email';
  /** One line, e.g. "Renew my hosting · Friday 23 October at 10:00 AM" */
  summary: string;
  /** Read this aloud: the confirmation sentence, or the clarification question */
  speech: string;
}

/**
 * Result of POST /api/voice/parse. Field names match POST /api/reminders, so a
 * confirmed result saves as { confirmed: true, title, notes, source_text,
 * timezone, recurrence, scheduled_at, ai_confidence: confidence }.
 */
export interface ParseResult {
  title: string;
  notes: string;
  /** What the user said (plus their clarification answer), verbatim */
  source_text: string;
  timezone: string;
  recurrence: Recurrence;
  /** UTC ISO instant; null while the time still needs clarification */
  scheduled_at: string | null;
  /** Wall-clock date/time in `timezone` (YYYY-MM-DD / HH:mm); null when unknown */
  date: string | null;
  time: string | null;
  /** 0–1. Capped at 0.5 while clarification is needed */
  confidence: number;
  needs_clarification: boolean;
  /** One short question to show and speak; null when ready to confirm */
  clarification_question: string | null;
  /** Every issue found; the question addresses the first one */
  ambiguities: AmbiguityCode[];
  /**
   * Quick answers for the question (e.g. both Fridays, or 8/9/10 AM). Each holds
   * the fully re-resolved result, so tapping one needs no extra request.
   */
  options: ClarificationOption[];
  preview: ReminderPreview;
}

export interface ClarificationOption {
  label: string;
  result: ParseResult;
}

// ---- Request bodies ----

export type SignUpInput = z.input<typeof signUpSchema>;
export type SignInInput = z.input<typeof signInSchema>;
export type UpdateMeInput = z.input<typeof updateMeSchema>;
export type CreateReminderInput = z.input<typeof createReminderSchema>;
export type UpdateReminderInput = z.input<typeof updateReminderSchema>;
export type ListRemindersQuery = z.input<typeof listRemindersQuerySchema>;
export type ParseInput = z.input<typeof parseInputSchema>;

// ---- Response bodies ----

export type UserResponse = { user: ApiUser };
export type ReminderResponse = { reminder: ApiReminder };
export type RemindersResponse = { reminders: ApiReminder[] };
export type OkResponse = { ok: true };
export type TranscribeResponse = { text: string };
export type ParseResponse = { result: ParseResult };

/**
 * Every non-2xx response has this shape. `code` is one of:
 * VALIDATION_ERROR, INVALID_JSON (400) · UNAUTHORIZED, INVALID_CREDENTIALS (401)
 * NOT_FOUND (404) · EMAIL_TAKEN (409) · NO_SPEECH (422) · RATE_LIMITED (429) · INTERNAL_ERROR (500)
 * AI_UNAVAILABLE, STT_UNAVAILABLE (502: the Gemma / Whisper provider failed).
 * `fields` maps a field name to messages for VALIDATION_ERROR.
 */
export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string[]> };
}
