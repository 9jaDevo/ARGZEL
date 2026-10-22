import * as Sentry from '@sentry/nextjs';

// Runs once when the server starts (Next.js instrumentation hook).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
    const { logEnvProblems } = await import('./server/env-check');
    logEnvProblems();
  }
}

// Errors Next.js catches outside our route() wrapper (pages, rendering).
export const onRequestError = Sentry.captureRequestError;
