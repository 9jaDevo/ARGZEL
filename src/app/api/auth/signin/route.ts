import { startSession, verifyPassword } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, json, readJson, route } from '@/server/http';
import { User, toApiUser } from '@/server/models/User';
import { signInSchema } from '@/server/validation';
import type { UserResponse } from '@/types/api';

export const POST = route(async (req: Request) => {
  const { email, password } = await readJson(req, signInSchema);
  await connectDB();
  const user = await User.findOne({ email }).select('+password_hash');
  const valid = await verifyPassword(password, user?.password_hash);
  if (!user || !valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');

  await startSession(user.id);
  return json<UserResponse>({ user: toApiUser(user) });
});
