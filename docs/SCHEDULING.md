# ARGZEL Scheduling & Email Delivery (Phase 7)

How a confirmed reminder becomes an email at the right time, with retries, logging and no duplicates. API conventions are in `docs/BACKEND.md`.

## End-to-end flow

```
voice/parse ─► preview (nothing saved)
user confirms ─► POST /api/reminders { confirmed: true, ... } ─► reminders (status: scheduled)
every minute ─► POST /api/cron/dispatch ─► claim due reminders ─► Resend email ─► notification_logs
```

- **Confirmation guard:** nothing is stored until `POST /api/reminders` arrives with `confirmed: true`. The parse endpoint never writes. Codex's real adapter (`src/lib/voice-service.ts`) sends `confirmed: true` only from the Confirm action, and edits use `PATCH` without it.
- **Scheduling runs on the backend** (spec §11), not on frontend timers.

## Choices

| Concern | Choice | Why |
| --- | --- | --- |
| Email provider | **Resend**, plain HTTPS, no SDK | One API key and one HTTP call. Free tier: 3,000/month, 100/day. Supports idempotency keys, used here to prevent duplicates. |
| Trigger | **Protected endpoint + external cron**, every minute | Works with Render Cron Jobs, cron-job.org or any scheduler. No long-running worker process to keep alive. Each run is stateless and safe to overlap. |
| Concurrency | **Atomic claim with a lease** in MongoDB | Multiple runs or instances can never take the same reminder. A crashed run's lease simply expires. |

## Status flow

| From | Event | To |
| --- | --- | --- |
| `scheduled` | email sent, one-off | `delivered` (and `last_delivered_at` set) |
| `scheduled` | email sent, repeating | stays `scheduled`, moved to the next occurrence at the same local time (and `last_delivered_at` set) |
| `scheduled` | send failed (attempts 1–3) | stays `scheduled`; retried after 1, 5, then 15 minutes |
| `scheduled` | 4th failure or permanent error, one-off | **`failed`** |
| `scheduled` | 4th failure or permanent error, repeating | stays `scheduled`, skips to the next occurrence |
| any | user `PATCH status: completed/cancelled` | `completed` / `cancelled` (never sent) |
| `delivered`/`failed`/`cancelled` | user `PATCH` with a new future time | `scheduled`; attempts reset |

`failed` is the only addition to the spec's status list. Without it, a one-off reminder that could not be emailed would sit at `scheduled` in the past and look upcoming. Permanent errors are 4xx responses other than 408 and 429, such as an unverified sender domain or an invalid key, plus a deleted account. Timeouts, 429 and 5xx count as transient.

**Missed time:** if the cron was down, a one-off reminder is still sent, late. A repeating reminder sends **one** email and jumps to its next future occurrence, never a backlog.

## Duplicate prevention

1. **Atomic claim.** One `findOneAndUpdate` finds a due `scheduled` reminder whose lease is free or expired, sets a 2-minute `locked_until` lease and counts the attempt. Two overlapping runs can never claim the same document.
2. **Guarded finish.** The result is written only if `locked_until` and `scheduled_at` still match what was claimed. A stalled worker whose lease was taken over, or a reminder the user edited or deleted mid-send, is left alone (`superseded`).
3. **Idempotency key per occurrence.** Every send carries `reminder-<id>-<scheduled_at ms>`, so a retry after a crash between "sent" and "recorded" is ignored by Resend for 24 hours.
4. **Edits re-arm cleanly.** Changing a reminder's time or status resets `locked_until` and `delivery_attempts`. A title-only edit keeps the lease, so it cannot trigger a resend.

## Notification logging

Every attempt writes one `notification_logs` row: `reminder_id`, `channel: email`, `attempted_at`, `status: sent | failed`, and `provider_response`. That field holds the Resend message id, or an error summary with email addresses redacted. Email content is never logged. Logs are deleted along with their reminder.

## Setup

1. **Resend:** create an API key at resend.com.
   - **Sender limitation:** with the default sender `onboarding@resend.dev`, Resend only delivers to *your own* Resend account email, which is fine for a demo to yourself.
   - To email any user, verify a domain in Resend (a `.tech` domain also counts toward that prize category) and set `EMAIL_FROM="ARGZEL <reminders@yourdomain.tech>"`.
2. **Environment** (`.env.local` for dev, Render → Environment for production):

   | Variable | Required | Notes |
   | --- | --- | --- |
   | `RESEND_API_KEY` | yes | Missing → the dispatch call returns 500 without claiming anything |
   | `EMAIL_FROM` | no | Default `ARGZEL <onboarding@resend.dev>` |
   | `APP_URL` | yes in production | Public URL for the email's "Open ARGZEL" link |
   | `CRON_SECRET` | yes | At least 16 characters. Already generated in `.env.local` and `.env.production` |

3. **Trigger every minute:**
   - **Render Cron Job.** Schedule `* * * * *`, command: `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/dispatch"`. Give the cron job the same `CRON_SECRET` and `APP_URL` env vars.
   - **Free alternative: cron-job.org.** Every minute, `POST https://<your-app>/api/cron/dispatch`, header `Authorization: Bearer <CRON_SECRET>`. The endpoint also accepts `GET` for services that only do GET.
   - **Local:** `npm run dev`, then `npm run cron:dev` in a second terminal.
   - On Render's free web plan the service sleeps when idle. The every-minute call keeps it awake, and the first call after a sleep may take about 30 s to wake it.

Response: `200 { "summary": { "claimed", "sent", "failed", "retrying", "superseded" } }`. `401` for a wrong or missing secret.

## Scheduling test checklist

Automated: `npm test`. `src/server/scheduler/dispatch.test.ts` runs 13 integration tests against MongoDB, defaulting to local `mongodb://127.0.0.1:27017`; set `MONGODB_TEST_URI` to override. The suite skips if no database is reachable. `src/server/email/reminder-email.test.ts` covers the email template.

| # | Check | How | Expected |
| --- | --- | --- | --- |
| 1 | Unconfirmed save rejected | `POST /api/reminders` without `confirmed` | `400`, field `confirmed`. Nothing stored |
| 2 | Due one-off is sent once | Reminder 1 min in the past → dispatch twice | 1 email. `delivered`. One `sent` log. Second run `claimed: 0` |
| 3 | Not-due/inactive ignored | Future, `completed`, `cancelled`, `delivered` reminders | `claimed: 0` |
| 4 | Overlapping runs | 12 due reminders, 3 parallel dispatches | Exactly 12 emails, all distinct |
| 5 | Repeating reminder | Weekly Wed 7 AM, dispatched | Next Wed 7 AM, still `scheduled`, `last_delivered_at` set |
| 6 | DST | Weekly 9 AM New York across 1 Nov | Next send at 9 AM EST (14:00Z, was 13:00Z) |
| 7 | Missed occurrences | Daily reminder 4 days overdue | 1 email, next occurrence in the future |
| 8 | Transient failure | Provider 503 once | `failed` log. Retry blocked for 1 min. Then `sent`. Same idempotency key |
| 9 | Retries exhausted | Provider always 500 at 0, 1, 6, 21 min | 4 attempts, 4 logs. One-off → `failed`. No further claims |
| 10 | Permanent error | Provider 403 | One-off → `failed` immediately. Weekly → next occurrence |
| 11 | Crashed worker | `locked_until` set in the future, never finished | Reclaimed and sent once the lease expires |
| 12 | Stalled worker overtaken | Worker A stalls past its lease, B sends | B `sent`. A's late write rejected (`superseded`) |
| 13 | Edit mid-send | Reschedule while the email is in flight | Edit wins: `scheduled` at the new time (`superseded`) |
| 14 | Deleted account | User removed before due time | No email. `failed` log "Account no longer exists" |
| 15 | Cron auth | No or wrong bearer token | `401` |
| 16 | Missing `RESEND_API_KEY` | Dispatch with no key | `500`, nothing claimed |
| 17 | Real email (manual) | Set a real key and your own email, create a reminder due in 2 min, run `npm run cron:dev` | Email arrives within about a minute. `sent` log with a Resend id |

Rows 1–16 were verified: rows 2–14 by automated tests, and rows 1, 15 and 16 over HTTP. A full HTTP round trip also ran against **Atlas** (22 Oct 2026): sign up, confirmation-gated save, dispatch, then reschedule of the failed reminder. It used an invalid Resend key, which exercised the real API's error path: `HTTP 401` was logged and the one-off reminder went to `failed`. The test data was deleted afterwards.

**Row 17 verified (22 Oct 2026):**
- A confirmed reminder due 2 minutes ahead was saved through the API on Atlas.
- A dispatch before the due time claimed nothing. The run 7 s after it fell due sent it.
- The reminder became `delivered`, and Atlas logged `sent` with the Resend message id.
- Resend reported `last_event: delivered` (sent from a verified Resend domain).
- A repeat run claimed nothing.
- The temporary test account and its data were deleted afterwards.

## Known limitations

- **Monthly drift:** a monthly reminder on the 29th–31st moves to the month's last day in short months and then stays there (31 Jan → 28 Feb → 28 Mar). The model does not store the original day.
- **Per-minute timing:** emails go out within about a minute of the scheduled time. A run handles up to 50 reminders, or 45 s, sequentially, which is fine at hackathon scale. Resend's free tier also caps sending at about 2 requests/second.
- **Email only:** SMS and WhatsApp are out of scope (spec).
