import { requireUserId } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, json, readJson, route } from '@/server/http';
import { User, toApiUser } from '@/server/models/User';
import { updateMeSchema } from '@/server/validation';
import type { UserResponse } from '@/types/api';

async function findCurrentUser() {
  const userId = await requireUserId();
  await connectDB();
  const user = await User.findById(userId);
  // A valid cookie for an account that no longer exists is treated as signed out.
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in to continue');
  return user;
}

export const GET = route(async () => {
  const user = await findCurrentUser();
  return json<UserResponse>({ user: toApiUser(user) });
});

/** Profile and settings: name, timezone, onboarding_completed. */
export const PATCH = route(async (req: Request) => {
  const input = await readJson(req, updateMeSchema);
  const user = await findCurrentUser();
  user.set(input);
  await user.save();
  return json<UserResponse>({ user: toApiUser(user) });
});
