// Environment validation: presence and shape of every variable, never values.
// Used at server start (instrumentation.ts) and by `npm run check:env`.
// Plain TypeScript with no imports, so Node can run it directly from the CLI script.

type Env = Record<string, string | undefined>;
type Rule = {
  name: string;
  feature: string;
  required: (env: Env, production: boolean) => boolean;
  /** Returns a problem description, or null when the value looks right. */
  check?: (value: string, env: Env, production: boolean) => string | null;
};

const always = () => true;
const usesGroq = (env: Env) => !env.STT_API_URL || env.STT_API_URL.includes('api.groq.com');

const RULES: Rule[] = [
  { name: 'MONGODB_URI', feature: 'database', required: always, check: (v) => (/^mongodb(\+srv)?:\/\//.test(v) ? null : 'must start with mongodb:// or mongodb+srv://') },
  { name: 'AUTH_SECRET', feature: 'sign-in', required: always, check: (v) => (v.length >= 32 ? null : 'must be at least 32 characters') },
  { name: 'GEMINI_API_KEY', feature: 'voice parsing (Gemma)', required: always, check: (v) => (v.startsWith('AIza') ? null : 'does not look like a Google AI Studio key (AIza…)') },
  { name: 'STT_API_KEY', feature: 'transcription (Whisper)', required: usesGroq, check: (v, env) => (usesGroq(env) && !v.startsWith('gsk_') ? 'does not look like a Groq key (gsk_…)' : null) },
  { name: 'RESEND_API_KEY', feature: 'reminder email', required: always, check: (v) => (v.startsWith('re_') ? null : 'does not look like a Resend key (re_…)') },
  { name: 'CRON_SECRET', feature: 'scheduler', required: always, check: (v) => (v.length >= 16 ? null : 'must be at least 16 characters') },
  {
    name: 'APP_URL',
    feature: 'links in emails',
    required: (_, production) => production,
    check: (v, _, production) => (production && !/^https:\/\/[^/]+/.test(v) ? 'must be the public https:// URL of the app' : null),
  },
];

export type EnvReport = { errors: string[]; warnings: string[] };

export function checkEnv(env: Env, production: boolean): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const rule of RULES) {
    const value = env[rule.name]?.trim();
    if (!value) {
      if (rule.required(env, production)) errors.push(`${rule.name} is missing (${rule.feature} will fail)`);
      continue;
    }
    const problem = rule.check?.(value, env, production);
    if (problem) errors.push(`${rule.name} ${problem}`);
  }

  const dsn = env.NEXT_PUBLIC_SENTRY_DSN || env.SENTRY_DSN;
  if (!dsn) warnings.push('NEXT_PUBLIC_SENTRY_DSN is not set: error monitoring is off');
  else if (!/^https:\/\/[^@]+@[^/]+\/\d+$/.test(dsn)) errors.push('NEXT_PUBLIC_SENTRY_DSN does not look like a Sentry DSN');
  if (production && (env.EMAIL_FROM ?? '').includes('onboarding@resend.dev')) {
    warnings.push("EMAIL_FROM uses Resend's test sender: emails reach only the Resend account owner");
  }
  return { errors, warnings };
}

/** Logs problems once at server start, so a misconfigured deploy is obvious in the logs. */
export function logEnvProblems() {
  const { errors, warnings } = checkEnv(process.env, process.env.NODE_ENV === 'production');
  for (const error of errors) console.error(`[env] ${error}`);
  for (const warning of warnings) console.warn(`[env] ${warning}`);
  if (!errors.length) console.log('[env] configuration OK');
}
