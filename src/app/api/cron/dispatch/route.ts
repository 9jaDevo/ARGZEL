import { createHash, timingSafeEqual } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import { env } from '@/server/env';
import { ApiError, json, route } from '@/server/http';
import { dispatchDueReminders } from '@/server/scheduler/dispatch';

// Sends due reminder emails. Call every minute with `Authorization: Bearer $CRON_SECRET`
// (Render Cron Job, cron-job.org, or `npm run cron:dev` locally). Safe to call
// concurrently or repeatedly: reminders are claimed atomically.

const digest = (value: string) => createHash('sha256').update(value).digest();

function authorize(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  // Hashing first gives equal-length buffers for a constant-time comparison.
  if (!token || !timingSafeEqual(digest(token), digest(env.cronSecret))) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid cron secret');
  }
}

// Sentry Cron Monitor: alerts when the every-minute trigger stops arriving or a run fails.
const MONITOR_SLUG = 'argzel-reminder-dispatch';
const MONITOR_CONFIG = {
  schedule: { type: 'crontab' as const, value: '* * * * *' },
  checkinMargin: 2,
  maxRuntime: 2,
  timezone: 'UTC',
  failureIssueThreshold: 3,
  recoveryThreshold: 1,
};

async function handle(req: Request) {
  authorize(req);
  const summary = await Sentry.withMonitor(MONITOR_SLUG, () => dispatchDueReminders(), MONITOR_CONFIG);
  if (summary.claimed) console.log('[cron] dispatch', JSON.stringify(summary));
  return json({ summary });
}

// GET too, because some cron services can only send GET requests.
export const POST = route(handle);
export const GET = route(handle);
