import { requireUserId } from '@/server/auth';
import { connectDB } from '@/server/db';
import { json, notFound, readJson, route, validationError } from '@/server/http';
import { NotificationLog } from '@/server/models/NotificationLog';
import { Reminder, toApiReminder } from '@/server/models/Reminder';
import { futureInstant, hasSchedule, updateReminderSchema } from '@/server/validation';
import type { OkResponse, ReminderResponse } from '@/types/api';

type Context = { params: Promise<{ id: string }> };

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** Loads a reminder owned by the current user; anything else is a 404. */
async function findOwnedReminder(params: Context['params'], userId: string) {
  const { id } = await params;
  if (!OBJECT_ID.test(id)) throw notFound();
  await connectDB();
  const reminder = await Reminder.findOne({ _id: id, user_id: userId });
  if (!reminder) throw notFound();
  return reminder;
}

export const GET = route(async (_req: Request, { params }: Context) => {
  const userId = await requireUserId();
  const reminder = await findOwnedReminder(params, userId);
  return json<ReminderResponse>({ reminder: toApiReminder(reminder) });
});

/**
 * Partial update. Changing the time (scheduled_at, or date + time) re-arms the
 * reminder as `scheduled` unless a status is sent too. A new time without a new
 * timezone keeps the reminder's timezone; a new timezone alone keeps the same instant.
 */
export const PATCH = route(async (req: Request, { params }: Context) => {
  const userId = await requireUserId();
  const input = await readJson(req, updateReminderSchema);
  const reminder = await findOwnedReminder(params, userId);

  const { scheduled_at, date, time, ...fields } = input;
  reminder.set(fields);
  if (hasSchedule(input)) {
    reminder.scheduled_at = futureInstant({ scheduled_at, date, time }, reminder.timezone);
    if (!input.status) reminder.status = 'scheduled';
  } else if (reminder.isModified('status') && reminder.status === 'scheduled' && reminder.scheduled_at.getTime() < Date.now()) {
    // Reopening a past reminder would make the scheduler send it immediately.
    throw validationError({ scheduled_at: ['Pick a new time to reopen this reminder'] });
  }
  if (reminder.isModified('scheduled_at') || reminder.isModified('status')) {
    // A new time or status starts delivery afresh. Clearing the lease also makes
    // an in-flight send's final write a no-op, so this edit wins.
    reminder.locked_until = null;
    reminder.delivery_attempts = 0;
  }

  await reminder.save();
  return json<ReminderResponse>({ reminder: toApiReminder(reminder) });
});

export const DELETE = route(async (_req: Request, { params }: Context) => {
  const userId = await requireUserId();
  const reminder = await findOwnedReminder(params, userId);
  await reminder.deleteOne();
  await NotificationLog.deleteMany({ reminder_id: reminder._id });
  return json<OkResponse>({ ok: true });
});
