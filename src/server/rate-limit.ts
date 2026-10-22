import { ApiError } from './http';

// Fixed-window, in-memory rate limiting. Enough for a single Render instance;
// with several instances each keeps its own counts (limits become per instance).
const windows = new Map<string, { count: number; resetAt: number }>();

/** Throws 429 RATE_LIMITED once `key` exceeds `limit` requests in `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (windows.size > 10_000) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  }
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count++;
  if (current.count > limit) {
    const seconds = Math.ceil((current.resetAt - now) / 1000);
    throw new ApiError(429, 'RATE_LIMITED', `Too many attempts. Please try again in ${seconds} seconds.`);
  }
}

/** Client IP as reported by Render's proxy. */
export function clientIp(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}

const MINUTE = 60_000;
export const LIMITS = {
  signUpPerIp: [10, 15 * MINUTE],
  signInPerIp: [30, 5 * MINUTE],
  signInPerEmail: [10, 15 * MINUTE],
  voicePerUser: [30, 5 * MINUTE],
} as const satisfies Record<string, readonly [number, number]>;
