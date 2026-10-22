import { requireUserId } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, json, readJson, route } from '@/server/http';
import { User } from '@/server/models/User';
import { parseInputSchema } from '@/server/validation';
import { parseReminder } from '@/server/voice/parse';
import type { ParseResponse } from '@/types/api';

/**
 * Turns a transcript into a reminder preview. Nothing is saved here: the client
 * saves with POST /api/reminders only after the user confirms.
 */
export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const input = await readJson(req, parseInputSchema);

  let timezone = input.timezone;
  if (!timezone) {
    await connectDB();
    const user = await User.findById(userId).select('timezone').lean();
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in to continue');
    timezone = user.timezone;
  }

  const result = await parseReminder({ text: input.text, clarification: input.clarification, timezone, now: new Date() });
  return json<ParseResponse>({ result });
});
