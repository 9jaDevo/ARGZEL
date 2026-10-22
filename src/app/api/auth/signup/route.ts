import { hashPassword, startSession } from '@/server/auth';
import { connectDB } from '@/server/db';
import { ApiError, json, readJson, route } from '@/server/http';
import { User, toApiUser } from '@/server/models/User';
import { LIMITS, clientIp, rateLimit } from '@/server/rate-limit';
import { signUpSchema } from '@/server/validation';
import type { UserResponse } from '@/types/api';

const emailTaken = () => new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists', { email: ['Already registered'] });

export const POST = route(async (req: Request) => {
  rateLimit(`signup:${clientIp(req)}`, ...LIMITS.signUpPerIp);
  const { password, ...profile } = await readJson(req, signUpSchema);
  await connectDB();
  if (await User.exists({ email: profile.email })) throw emailTaken();

  const user = await User.create({ ...profile, password_hash: await hashPassword(password) }).catch((err) => {
    // Unique index catches a concurrent sign-up with the same email.
    throw (err as { code?: number }).code === 11000 ? emailTaken() : err;
  });
  await startSession(user.id);
  return json<UserResponse>({ user: toApiUser(user) }, 201);
});
