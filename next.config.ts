import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  turbopack: { root: path.resolve(process.cwd()) },
  // Lets a verification build run beside a running `next start` without overwriting .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

// Sentry is inert at runtime without a DSN; source maps upload only when SENTRY_AUTH_TOKEN is set.
export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
});
