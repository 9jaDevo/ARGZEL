# ARGZEL Backend

Technical reference for the backend foundation (Phase 5): architecture, data model, auth, and the reminder API.

## Architecture

| Concern | Choice | Why |
| --- | --- | --- |
| Runtime | Next.js Route Handlers (`src/app/api/**/route.ts`) | One app and one Render service. No CORS, and the cookie works on the same origin. |
| Database | MongoDB Atlas via Mongoose | Spec requirement. Schemas give field validation and indexes. |
| Validation | Zod | Every body and query is parsed before use and returns per-field messages. |
| Auth | Email + password. scrypt hash (Node built-in). HS256 JWT in an httpOnly cookie | Spec allows email/password. No third-party provider, no email dependency, and the frontend never handles tokens. |
| Time | UTC instant + IANA timezone, converted with `Intl` | Handles user timezones and DST without a date library. |

```
src/
  app/api/
    auth/signup/route.ts      POST
    auth/signin/route.ts      POST
    auth/signout/route.ts     POST
    me/route.ts               GET, PATCH
    reminders/route.ts        GET, POST
    reminders/[id]/route.ts   GET, PATCH, DELETE
    voice/transcribe/route.ts POST (audio -> text, Whisper)
    voice/parse/route.ts      POST (text -> reminder preview, Gemma)
    cron/dispatch/route.ts    POST/GET (every-minute due-reminder run, CRON_SECRET)
  server/                     server-only code (never import from client components)
    env.ts                    typed, lazy env access
    db.ts                     cached Mongoose connection
    auth.ts                   password hashing + session cookie
    http.ts                   route wrapper, JSON errors, body/query validation
    validation.ts             Zod schemas for every request
    time.ts                   timezone helpers
    models/                   User, Reminder, NotificationLog
    voice/                    transcription, Gemma parsing, date resolution (see docs/VOICE_PARSING.md)
    scheduler/dispatch.ts     due-reminder worker: claim, send, retry, log (see docs/SCHEDULING.md)
    email/                    Resend client + reminder email template
  types/api.ts                API contract types for the frontend (type-only)
```

## Environment variables

| Name | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB Atlas connection string. |
| `MONGODB_DB` | no | Database name. Default `argzel`. |
| `AUTH_SECRET` | yes | Session signing secret, at least 32 characters. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. |
| `GEMINI_API_KEY` | for voice parsing | Google AI Studio key for Gemma on the Gemini API. |
| `GEMMA_MODEL` | no | Default `gemma-4-26b-a4b-it`. |
| `STT_API_KEY` | for transcription | Groq key for hosted Whisper. Empty is fine for a self-hosted server without auth. |
| `STT_API_URL` / `STT_MODEL` | no | Defaults: Groq's OpenAI-compatible endpoint and `whisper-large-v3-turbo`. |
| `RESEND_API_KEY` | for email | Resend key. |
| `EMAIL_FROM` | no | Default `ARGZEL <onboarding@resend.dev>`, which only reaches your own Resend account email. Verify a domain to email anyone. |
| `APP_URL` | production | Public URL for links in emails. |
| `CRON_SECRET` | for the scheduler | Bearer token for `/api/cron/dispatch`, at least 16 characters. |

Variables are read when a request needs them, so `next build` works without them. A missing variable makes that request return `500 INTERNAL_ERROR` and logs the variable name on the server. None of these use the `NEXT_PUBLIC_` prefix, so none reach the browser.

## Setup

1. In MongoDB Atlas, create a free cluster and a database user. Under **Network Access**, allow your IP for local development and `0.0.0.0/0` for Render. Copy the driver connection string.
2. `cp .env.example .env.local` and fill in `MONGODB_URI` and `AUTH_SECRET`.
3. `npm install`, then `npm run dev`.
4. Smoke check: `curl -i http://localhost:3000/api/me` should return `401` with `{"error":{"code":"UNAUTHORIZED",...}}`.

Collections and indexes are created automatically on first use. A local MongoDB works too: set `MONGODB_URI=mongodb://127.0.0.1:27017`.

## Data model

Field names follow spec §10 exactly. Timestamps are `created_at` / `updated_at`.

**`users`**: `name`, `email` (unique, lowercased), `password_hash` (never selected by default, never returned), `timezone` (IANA, default `UTC`), `onboarding_completed` (default `false`).

**`reminders`**: `user_id`, `title`, `notes`, `source_text`, `scheduled_at` (UTC `Date`), `timezone`, `recurrence` (`none | daily | weekly | monthly`), `status` (`scheduled | delivered | completed | cancelled | failed`), `delivery_channel` (`email`), `ai_confidence` (0–1 or `null`).
Scheduler bookkeeping, never client-editable: `delivery_attempts`, `locked_until` (claim lease and retry backoff), `last_delivered_at`. `failed` is an addition to the spec: a one-off reminder whose email could not be sent after all retries.
Indexes: `{user_id, scheduled_at}` for the dashboard and `{status, scheduled_at}` for the due-reminder scan.

**`notification_logs`**: `reminder_id`, `channel`, `attempted_at`, `status` (`sent | failed`), `provider_response` (provider id or error summary only, never email content). Index: `{reminder_id, attempted_at}`. One row per delivery attempt, written by the scheduler. Deleted along with their reminder.

## API

### Conventions

- JSON in, JSON out. Success bodies wrap the resource: `{ user }`, `{ reminder }`, `{ reminders }`, `{ ok: true }`.
- Auth uses the `argzel_session` cookie: httpOnly, `SameSite=Lax`, `Secure` in production, 30-day expiry. Same-origin `fetch` sends it automatically. Unauthenticated calls get `401 UNAUTHORIZED`.
- Errors always have this shape:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "Some fields are invalid",
               "fields": { "email": ["Enter a valid email address"], "password": ["Password must be at least 8 characters"] } } }
  ```
  Codes: `VALIDATION_ERROR`, `INVALID_JSON` (400) · `UNAUTHORIZED`, `INVALID_CREDENTIALS` (401) · `NOT_FOUND` (404) · `EMAIL_TAKEN` (409) · `INTERNAL_ERROR` (500).
- Unknown body fields are ignored, so sending a whole reminder object back on PATCH is safe.
- A reminder that does not exist, or belongs to someone else, is a `404`.
- TypeScript types for every body and response are in `src/types/api.ts` (import with `import type`).

### Auth & profile

| Method & path | Body | Success |
| --- | --- | --- |
| `POST /api/auth/signup` | `{ name, email, password (8–128), timezone? }` | `201 { user }` + cookie |
| `POST /api/auth/signin` | `{ email, password }` | `200 { user }` + cookie |
| `POST /api/auth/signout` | none | `200 { ok: true }`, cookie cleared |
| `GET /api/me` | none | `200 { user }` |
| `PATCH /api/me` | any of `{ name, timezone, onboarding_completed }` | `200 { user }` |

`user` = `{ id, name, email, timezone, onboarding_completed, created_at, updated_at }`.
Send the browser timezone on sign-up: `Intl.DateTimeFormat().resolvedOptions().timeZone`. Sign-in returns the same `INVALID_CREDENTIALS` for an unknown email and for a wrong password.

Onboarding runs before an account exists, so keep the frontend's local flag. After sign-up or sign-in, if the flag is set, send `PATCH /api/me { onboarding_completed: true }`.

### Reminders

| Method & path | Body / query | Success |
| --- | --- | --- |
| `GET /api/reminders` | `?status=scheduled&limit=100` (both optional; limit 1–200) | `200 { reminders }`, soonest first |
| `POST /api/reminders` | see below | `201 { reminder }` |
| `GET /api/reminders/:id` | none | `200 { reminder }` |
| `PATCH /api/reminders/:id` | any editable field | `200 { reminder }` |
| `DELETE /api/reminders/:id` | none | `200 { ok: true }` |

`reminder` = `{ id, title, notes, source_text, scheduled_at, date, time, timezone, recurrence, status, delivery_channel, ai_confidence, last_delivered_at, created_at, updated_at }`.
`scheduled_at` is the UTC instant (ISO 8601). `date` (`YYYY-MM-DD`) and `time` (`HH:mm`, 24-hour) are that instant shown in the reminder's `timezone`, ready to display.

**Create** (call only from the Confirm action):
```json
{
  "confirmed": true,
  "title": "Renew website hosting",
  "notes": "Check the annual plan first",
  "source_text": "Remind me to renew my hosting next Friday at 10 AM.",
  "timezone": "Africa/Lagos",
  "date": "2026-10-23",
  "time": "10:00",
  "recurrence": "none",
  "ai_confidence": 0.92
}
```
- `confirmed: true` is required. It enforces the spec's "no reminder without confirmation" rule at the API.
- Required: `confirmed`, `title` (1–200 chars), `timezone`, and the time.
- Optional: `notes` (≤1000 chars), `source_text` (≤2000 chars), `recurrence` (default `none`), `ai_confidence` (0–1, default `null`).
- Send the time in one of two ways, not both:
  - `scheduled_at`: ISO 8601 with offset, e.g. `2026-10-23T10:00:00+01:00`
  - `date` + `time`: wall clock in `timezone`, which matches `<input type="date">` / `<input type="time">`
- The time must not be in the past. There is a 60-second grace period.

**Update rules** (`PATCH`):
- Editable fields: `title`, `notes`, `timezone`, `recurrence`, `status`, and the time (`scheduled_at`, or `date` + `time`). `source_text` and `ai_confidence` are fixed.
- `status` accepts `scheduled`, `completed` or `cancelled`. Only the scheduler sets `delivered` and `failed`.
- A change of time or status resets the delivery bookkeeping. If an email is in flight at that moment, the edit wins.
- A new time must be in the future. It resets `status` to `scheduled` unless the request also sends a `status`.
- New `date` + `time` are read in the new `timezone` if one is sent, otherwise in the reminder's current one. Sending only `timezone` keeps the same instant and changes the displayed `date`/`time`.
- Reopening a past reminder (`status: "scheduled"` with no new time) returns `400`. Otherwise the scheduler would send it immediately.

### Voice

| Method & path | Body | Success |
| --- | --- | --- |
| `POST /api/voice/transcribe` | multipart `audio` file | `200 { text }` |
| `POST /api/voice/parse` | `{ text, timezone?, clarification? }` | `200 { result }` (a preview; nothing saved) |

Full contract, clarification flow, assumptions and sample cases: `docs/VOICE_PARSING.md`.

### Frontend integration sketch

```ts
import type { ApiErrorBody, CreateReminderInput, ReminderResponse } from '@/types/api';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
  const body = await res.json();
  if (!res.ok) throw (body as ApiErrorBody).error; // { code, message, fields? }
  return body as T;
}

const input: CreateReminderInput = { confirmed: true, title, timezone, date, time };
const { reminder } = await api<ReminderResponse>('/api/reminders', { method: 'POST', body: JSON.stringify(input) });
```

The demo `Reminder` type in `src/lib/demo.ts` maps directly to the API: `source` → `source_text`. `date`, `time`, `timezone` and `recurrence` are identical. The API adds `scheduled_at`, `delivery_channel` and `ai_confidence`, and its `status` can also be `delivered` or `cancelled`.

## Testing

Phase 5 was verified end to end against a running dev server and a local MongoDB 7 database (61 checks). The checks covered:
- sign-up, sign-in, sign-out, a forged cookie, and duplicate emails
- per-field validation
- the confirmation guard
- timezone conversion, including DST edges
- past-time rejection
- list, filter and limit
- cross-user isolation (404s)
- PATCH status rules
- delete cascading to `notification_logs`
- stored field names and indexes

`npm test` (Vitest) runs the voice parsing unit tests (Phase 6), the email template tests, and 13 scheduler integration tests against MongoDB (Phase 7; local by default, skipped if unreachable). `npm run test:live` checks Gemma against the real API. Route-level HTTP tests are still manual. The checklist is in `docs/SCHEDULING.md`.

## Known limitations / next phases

- No rate limiting on sign-in or sign-up. Add it before a public launch (Phase 8).
- Sessions are stateless: sign-out clears the cookie, but a copied token stays valid until it expires. Rotating `AUTH_SECRET` invalidates every session.
- No password reset (the spec allows a placeholder link).
- Scheduling and email (Phase 7): see `docs/SCHEDULING.md`. Known limits: monthly reminders on the 29th–31st drift to the last day of short months, and delivery is accurate to about a minute.
- The voice endpoints (Phase 6) call paid/free-tier providers and are behind sign-in, but are not rate-limited yet (Phase 8).
