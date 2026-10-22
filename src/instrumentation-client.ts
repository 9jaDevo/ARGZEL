import * as Sentry from '@sentry/nextjs';
import { sentryDataCollection } from './sentry.privacy';

// Browser-side Sentry: front-end errors and page-load/navigation performance.
// NEXT_PUBLIC_SENTRY_DSN is inlined at build time; without it Sentry stays off.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.2,
  dataCollection: sentryDataCollection,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
