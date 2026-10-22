import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  turbopack: { root: path.resolve(process.cwd()) },
  // Lets a verification build run beside a running `next start` without overwriting .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

// Sentry is inert at runtime without a DSN; source maps upload only when an auth token is
// available (SENTRY_AUTH_TOKEN, or the git-ignored .env.sentry-build-plugin locally).
export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG || "tog-africa",
  project: process.env.SENTRY_PROJECT || "argzel",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  // Upload a wider set of client source maps for readable stack traces (slower builds).
  widenClientFileUpload: true,
  // Browser events go through this app route instead of straight to sentry.io, so ad blockers don't drop them.
  tunnelRoute: "/monitoring",
});
