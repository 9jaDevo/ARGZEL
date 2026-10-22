import * as Sentry from '@sentry/nextjs';
import { sentryDataCollection } from './sentry.privacy';

// Server-side Sentry. Without a DSN the SDK stays disabled, so local
// development and tests need no Sentry account.
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT || (process.env.RENDER ? 'production' : process.env.NODE_ENV),
  release: process.env.RENDER_GIT_COMMIT,
  // Low traffic at launch: trace everything so AI and scheduler spans are always visible.
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 1),
  dataCollection: sentryDataCollection,
});
