import { requireUserId } from '@/server/auth';
import { connectDB } from '@/server/db';
import { json, readJson, route, validate } from '@/server/http';
import { Reminder, toApiReminder } from '@/server/models/Reminder';
import { createReminderSchema, futureInstant, listRemindersQuerySchema } from '@/server/validation';
import type { ReminderResponse, RemindersResponse } from '@/types/api';

/** Lists the user's reminders, soonest first. Query: ?status=scheduled&limit=100 */
export const GET = route(async (req: Request) => {
  const userId = await requireUserId();
  const { status, limit } = validate(listRemindersQuerySchema, Object.fromEntries(new URL(req.url).searchParams));
  await connectDB();
  const reminders = await Reminder.find({ user_id: userId, ...(status && { status }) })
    .sort({ scheduled_at: 1 })
    .limit(limit)
    .lean();
  return json<RemindersResponse>({ reminders: reminders.map(toApiReminder) });
});

/** Saves a reminder the user has confirmed on the preview screen. */
export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const input = await readJson(req, createReminderSchema);
  const scheduledAt = futureInstant(input, input.timezone);
  await connectDB();
  const reminder = await Reminder.create({
    user_id: userId,
    title: input.title,
    notes: input.notes,
    source_text: input.source_text,
    scheduled_at: scheduledAt,
    timezone: input.timezone,
    recurrence: input.recurrence,
    ai_confidence: input.ai_confidence,
  });
  return json<ReminderResponse>({ reminder: toApiReminder(reminder) }, 201);
});
