// Server-only environment access. Values are read lazily so `next build` works
// without secrets present; a missing variable fails the request that needs it.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  get mongodbUri() {
    return required('MONGODB_URI');
  },
  get mongodbDb() {
    return process.env.MONGODB_DB || 'argzel';
  },
  get authSecret() {
    const secret = required('AUTH_SECRET');
    if (secret.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters');
    return secret;
  },
  // Gemma on the Gemini API (Google AI Studio key).
  get geminiApiKey() {
    return required('GEMINI_API_KEY');
  },
  get gemmaModel() {
    return process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';
  },
  // Whisper via any OpenAI-compatible transcription endpoint (Groq by default;
  // a self-hosted faster-whisper server works too and may not need a key).
  get sttApiUrl() {
    return process.env.STT_API_URL || 'https://api.groq.com/openai/v1/audio/transcriptions';
  },
  get sttApiKey() {
    return process.env.STT_API_KEY || '';
  },
  get sttModel() {
    return process.env.STT_MODEL || 'whisper-large-v3-turbo';
  },
  // Email delivery via Resend.
  get resendApiKey() {
    return required('RESEND_API_KEY');
  },
  get emailFrom() {
    return process.env.EMAIL_FROM || 'ARGZEL <onboarding@resend.dev>';
  },
  /** Public base URL, used for the link back to the app in emails. */
  get appUrl() {
    return (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  },
  /** Shared secret the cron trigger sends as a Bearer token. */
  get cronSecret() {
    const secret = required('CRON_SECRET');
    if (secret.length < 16) throw new Error('CRON_SECRET must be at least 16 characters');
    return secret;
  },
  get isProduction() {
    return process.env.NODE_ENV === 'production';
  },
};
