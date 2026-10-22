import { startSession, verifyPassword } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, json, readJson, route } from '@/server/http';
import { User, toApiUser } from '@/server/models/User';
import { LIMITS, clientIp, rateLimit } from '@/server/rate-limit';
import { signInSchema } from '@/server/validation';
import type { UserResponse } from '@/types/api';

export const POST = route(async (req: Request) => {
  rateLimit(`signin:${clientIp(req)}`, ...LIMITS.signInPerIp);
  const { email, password } = await readJson(req, signInSchema);
  // Per-account limit too, so guessing one password from many IPs is still capped.
  rateLimit(`signin-email:${email}`, ...LIMITS.signInPerEmail);
  await connectDB();
  const user = await User.findOne({ email }).select('+password_hash');
  const valid = await verifyPassword(password, user?.password_hash);
  if (!user || !valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');

  await startSession(user.id);
  return json<UserResponse>({ user: toApiUser(user) });
});
