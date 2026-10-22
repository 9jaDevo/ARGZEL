import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { env } from './env';
import { ApiError } from './http';

// Auth: email + password, hashed with Node's built-in scrypt. The session is a
// signed JWT (HS256) in an httpOnly cookie, so the frontend never handles tokens.

// ---- Passwords ----

const SCHEME = 'scrypt';
const KEY_LENGTH = 64;
// OWASP-equivalent cost to N=2^17,r=8,p=1 while keeping memory per hash at ~16 MB.
const SCRYPT_PARAMS = { N: 2 ** 14, r: 8, p: 5 };

function derive(password: string, salt: Buffer, length = KEY_LENGTH) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, length, SCRYPT_PARAMS, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `${SCHEME}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  const [scheme, saltHex, hashHex] = stored?.split('$') ?? [];
  if (scheme !== SCHEME || !saltHex || !hashHex) {
    // Unknown user: still do the work so response time doesn't reveal which emails exist.
    await derive(password, randomBytes(16));
    return false;
  }
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await derive(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

// ---- Sessions ----

const SESSION_COOKIE = 'argzel_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

const secretKey = () => new TextEncoder().encode(env.authSecret);

export async function startSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function requireUserId() {
  const userId = await getSessionUserId();
  if (!userId) throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in to continue');
  Sentry.setUser({ id: userId }); // id only: no email or IP
  return userId;
}
