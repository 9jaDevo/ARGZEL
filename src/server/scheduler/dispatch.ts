import type { HydratedDocument } from 'mongoose';
import { connectDB } from '../db';
import { reminderEmail } from '../email/reminder-email';
import { sendEmail, type EmailMessage, type SendResult } from '../email/resend';
import { env } from '../env';
import { NotificationLog } from '../models/NotificationLog';
import { Reminder, type ReminderAttrs } from '../models/Reminder';
import { User } from '../models/User';
import { nextOccurrenceAfter } from '../time';

// Due-reminder worker, run every minute by a cron trigger (POST /api/cron/dispatch).
//
// Duplicate prevention:
// 1. Claiming is one atomic findOneAndUpdate that sets a lease (`locked_until`),
//    so two overlapping runs can never take the same reminder.
// 2. Finishing is guarded by that lease and the claimed `scheduled_at`, so a
//    stale worker, or a user edit made mid-send, is never overwritten.
// 3. Each send carries an idempotency key per reminder occurrence, so even a
//    crash between "sent" and "recorded" cannot email twice (Resend dedupes).
//
// Status flow per occurrence:
//   scheduled ─(sent)→ delivered            one-off
//   scheduled ─(sent)→ scheduled @ next     repeating (daily/weekly/monthly)
//   scheduled ─(fail)→ scheduled, retry after 1, 5, 15 min (attempts 2, 3, 4)
//   scheduled ─(4th fail or permanent error)→ failed (one-off) | scheduled @ next (repeating)

export const LEASE_MS = 2 * 60_000;
export const MAX_ATTEMPTS = 4;
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000];
const RUN_BUDGET_MS = 45_000; // finish well inside the one-minute cron interval

type ReminderDoc = HydratedDocument<ReminderAttrs>;

export type DispatchSummary = {
  claimed: number;
  sent: number;
  failed: number;
  /** Failed but will retry later. */
  retrying: number;
  /** Finished, but the reminder was edited or deleted while sending, so the edit wins. */
  superseded: number;
};

export type DispatchOptions = {
  now?: () => Date;
  limit?: number;
  send?: (message: EmailMessage) => Promise<SendResult>;
};

/** Stable per occurrence, so retries of the same send are deduplicated by the provider. */
export const idempotencyKey = (reminderId: string, occurrence: Date) => `reminder-${reminderId}-${occurrence.getTime()}`;

async function claimNext(now: Date): Promise<ReminderDoc | null> {
  return Reminder.findOneAndUpdate(
    {
      status: 'scheduled',
      scheduled_at: { $lte: now },
      $or: [{ locked_until: null }, { locked_until: { $lte: now } }],
    },
    { $set: { locked_until: new Date(now.getTime() + LEASE_MS) }, $inc: { delivery_attempts: 1 } },
    { sort: { scheduled_at: 1 }, returnDocument: 'after' },
  );
}

async function deliver(reminder: ReminderDoc, now: Date, send: DispatchOptions['send'] & {}): Promise<keyof DispatchSummary> {
  const occurrence = reminder.scheduled_at;
  const user = await User.findById(reminder.user_id).select('email name').lean();

  let result: SendResult;
  if (!user) {
    result = { ok: false, error: 'Account no longer exists', permanent: true };
  } else {
    const email = reminderEmail({
      name: user.name,
      title: reminder.title,
      notes: reminder.notes,
      scheduledAt: occurrence,
      timezone: reminder.timezone,
      recurrence: reminder.recurrence,
      appUrl: env.appUrl,
    });
    result = await send({ to: user.email, ...email, idempotencyKey: idempotencyKey(reminder.id, occurrence) }).catch(
      (err: Error): SendResult => ({ ok: false, error: `Unexpected error: ${err.message}`.slice(0, 300), permanent: false }),
    );
  }

  await NotificationLog.create({
    reminder_id: reminder._id,
    channel: reminder.delivery_channel,
    attempted_at: now,
    status: result.ok ? 'sent' : 'failed',
    provider_response: result.ok ? `id: ${result.id}` : result.error,
  });

  const repeating = reminder.recurrence !== 'none' ? reminder.recurrence : null;
  const nextOccurrence = () => nextOccurrenceAfter(occurrence, repeating!, reminder.timezone, now);
  const free = { locked_until: null, delivery_attempts: 0 };

  let update: Partial<ReminderAttrs>;
  let outcome: keyof DispatchSummary;
  if (result.ok) {
    update = repeating
      ? { ...free, scheduled_at: nextOccurrence(), last_delivered_at: now }
      : { ...free, status: 'delivered', last_delivered_at: now };
    outcome = 'sent';
  } else if (result.permanent || reminder.delivery_attempts >= MAX_ATTEMPTS) {
    // Give up on this occurrence. A repeating reminder still fires next time.
    update = repeating && user ? { ...free, scheduled_at: nextOccurrence() } : { ...free, status: 'failed' };
    outcome = 'failed';
  } else {
    update = { locked_until: new Date(now.getTime() + RETRY_DELAYS_MS[reminder.delivery_attempts - 1]) };
    outcome = 'retrying';
  }

  const { modifiedCount } = await Reminder.updateOne(
    { _id: reminder._id, locked_until: reminder.locked_until, scheduled_at: occurrence },
    { $set: update },
  );
  return modifiedCount === 1 ? outcome : 'superseded';
}

export async function dispatchDueReminders(options: DispatchOptions = {}): Promise<DispatchSummary> {
  const { now = () => new Date(), limit = 50, send = sendEmail } = options;
  if (send === sendEmail) void env.resendApiKey; // fail fast on missing config, before claiming anything
  await connectDB();

  const summary: DispatchSummary = { claimed: 0, sent: 0, failed: 0, retrying: 0, superseded: 0 };
  const stopAt = Date.now() + RUN_BUDGET_MS;
  while (summary.claimed < limit && Date.now() < stopAt) {
    const at = now();
    const reminder = await claimNext(at);
    if (!reminder) break;
    summary.claimed++;
    summary[await deliver(reminder, at, send)]++;
  }
  return summary;
}
