import { env } from '../env';

// Resend over plain HTTPS (no SDK). The idempotency key makes a retried send of
// the same reminder occurrence a no-op on Resend's side for 24 hours.

export type EmailMessage = { to: string; subject: string; html: string; text: string; idempotencyKey: string };
export type SendResult = { ok: true; id: string } | { ok: false; error: string; permanent: boolean };

/** Keeps provider errors useful for debugging without storing addresses in logs. */
const redact = (message: string) => message.replace(/[^\s@<>()"']+@[^\s@<>()"']+/g, '[email]').slice(0, 300);

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.resendApiKey}`,
      'content-type': 'application/json',
      'idempotency-key': message.idempotencyKey,
    },
    body: JSON.stringify({ from: env.emailFrom, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    signal: AbortSignal.timeout(15_000),
  }).catch((err: Error) => err);

  if (res instanceof Error) return { ok: false, error: redact(`Network error: ${res.message}`), permanent: false };
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (res.ok && body.id) return { ok: true, id: body.id };

  // Rate limits and server errors may pass; other 4xx (bad sender, unverified domain) will not.
  const permanent = res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 408;
  return { ok: false, error: redact(`HTTP ${res.status}: ${body.message ?? body.name ?? 'Unknown error'}`), permanent };
}
