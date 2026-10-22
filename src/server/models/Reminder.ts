import { Schema, type Types } from 'mongoose';
import { defineModel } from './define';
import { utcToZoned } from '../time';
import type { ApiReminder } from '@/types/api';

export const RECURRENCES = ['none', 'daily', 'weekly', 'monthly'] as const;
// `failed` extends the spec's list: a one-off reminder whose email could not be
// delivered after every retry (see src/server/scheduler/dispatch.ts).
export const REMINDER_STATUSES = ['scheduled', 'delivered', 'completed', 'cancelled', 'failed'] as const;
export const DELIVERY_CHANNELS = ['email'] as const;

export type Recurrence = (typeof RECURRENCES)[number];
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

export interface ReminderAttrs {
  user_id: Types.ObjectId;
  title: string;
  notes: string;
  source_text: string;
  scheduled_at: Date;
  timezone: string;
  recurrence: Recurrence;
  status: ReminderStatus;
  delivery_channel: DeliveryChannel;
  ai_confidence: number | null;
  // Scheduler bookkeeping (not editable by clients).
  /** Attempts for the current occurrence; reset after a send or a reschedule. */
  delivery_attempts: number;
  /** Lease while a worker sends, then the retry backoff; null when free. */
  locked_until: Date | null;
  last_delivered_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const reminderSchema = new Schema<ReminderAttrs>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    notes: { type: String, default: '', trim: true, maxlength: 1000 },
    source_text: { type: String, default: '', trim: true, maxlength: 2000 },
    scheduled_at: { type: Date, required: true },
    timezone: { type: String, required: true },
    recurrence: { type: String, enum: RECURRENCES, default: 'none' },
    status: { type: String, enum: REMINDER_STATUSES, default: 'scheduled' },
    delivery_channel: { type: String, enum: DELIVERY_CHANNELS, default: 'email' },
    ai_confidence: { type: Number, min: 0, max: 1, default: null },
    delivery_attempts: { type: Number, default: 0 },
    locked_until: { type: Date, default: null },
    last_delivered_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
);

// Dashboard listing (per user, by time) and the due-reminder scan (by status, by time).
reminderSchema.index({ user_id: 1, scheduled_at: 1 });
reminderSchema.index({ status: 1, scheduled_at: 1 });

export const Reminder = defineModel<ReminderAttrs>('Reminder', reminderSchema, 'reminders');

export function toApiReminder(reminder: ReminderAttrs & { _id: Types.ObjectId }): ApiReminder {
  const { date, time } = utcToZoned(reminder.scheduled_at, reminder.timezone);
  return {
    id: reminder._id.toString(),
    title: reminder.title,
    notes: reminder.notes,
    source_text: reminder.source_text,
    scheduled_at: reminder.scheduled_at.toISOString(),
    date,
    time,
    timezone: reminder.timezone,
    recurrence: reminder.recurrence,
    status: reminder.status,
    delivery_channel: reminder.delivery_channel,
    ai_confidence: reminder.ai_confidence,
    last_delivered_at: reminder.last_delivered_at?.toISOString() ?? null,
    created_at: reminder.created_at.toISOString(),
    updated_at: reminder.updated_at.toISOString(),
  };
}
