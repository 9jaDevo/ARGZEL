# ARGZEL Deployment & Operations

How to put ARGZEL live on Render, turn on monitoring, and check it works. Steps marked **(owner)** need your accounts and secrets. Everything else is already in the repo.

## What runs where

```
Render web service (free plan)  ── Next.js app + API  ── MongoDB Atlas (argzel DB)
        ▲                                │              ├─ Gemma 4 (Gemini API)
        │ every minute                   │              ├─ Whisper (Groq)
cron-job.org (or Render Cron)            │              └─ Resend (email)
  POST /api/cron/dispatch                └── Sentry (errors, AI spans, cron monitor)
```

`render.yaml` (Render Blueprint) describes the web service:
- build `npm ci && npm run build`, start `npm start`;
- Node 24, Frankfurt region;
- health check `/api/health`, which returns 200 only when MongoDB answers;
- auto-deploy on every push to `main`.

## 1. Before deploying

- **Code on GitHub:** `render.yaml` must be on `main`.
- **Atlas (owner):** Network Access must allow `0.0.0.0/0`, because Render's free plan has no fixed outbound IPs. That rule already exists. The `argzel_app` database user is limited to `readWrite` on `argzel`.
- **Resend (owner):** the sending domain is already verified, so `EMAIL_FROM` can email any address.
- **Local check:** `npm run check:env` validates `.env.production` without printing any values.

## 2. Create the service (owner)

1. In Render, go to **New → Blueprint** and connect the `9jaDevo/ARGZEL` repository. Render reads `render.yaml`.
2. Render asks for each `sync: false` value. Paste them from your local `.env.production`:
   - `MONGODB_URI`, `GEMINI_API_KEY`, `STT_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`.
   - `APP_URL`: `https://argzel.onrender.com`. If Render gives the service a different URL, use that and redeploy.
   - The Sentry fields can stay empty for now (see step 4).
3. Render generates `AUTH_SECRET` and `CRON_SECRET` for production. They're separate from your local ones.
4. Apply. The first build takes a few minutes. Then `https://<your-app>/api/health` should return `{"status":"ok","db":"up",...}`.
5. Check the service **Logs** for the start-up line `[env] configuration OK`. Any `[env]` error names the missing or malformed variable, never its value.

## 3. Start the scheduler (owner)

Reminder emails go out only when something calls the dispatcher every minute. Copy `CRON_SECRET` from Render (service → Environment), then choose one:

- **cron-job.org (free):**
  - New cronjob, URL `https://<your-app>/api/cron/dispatch`, schedule **every minute**, request method **POST**.
  - Add the header `Authorization: Bearer <CRON_SECRET>`.
  - Enable failure notifications.
- **Render Cron Job (paid, from about $1/month):**
  - Schedule `* * * * *`.
  - Command: `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/dispatch"`.
  - Give it the same `CRON_SECRET` and `APP_URL`.

A side benefit: the every-minute call keeps the free web service from sleeping, which it otherwise does after 15 idle minutes, with a slow first request. One always-on free service fits within Render's 750 free hours/month.

## 4. Turn on Sentry (owner)

1. In Sentry, create a project with platform **Next.js** and copy its **DSN**.
2. On Render, set `NEXT_PUBLIC_SENTRY_DSN` to the DSN, then **redeploy**. The DSN is built into the browser bundle, so a restart alone isn't enough.
3. Optional, for readable stack traces: create an auth token with `project:releases` and `org:read` scopes. Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT`. Source maps upload during the build.

What you'll see in Sentry:

| Where | What |
| --- | --- |
| Issues | Unhandled API and page errors, plus four specific failures: Gemma request failed, Gemma reply not valid JSON, speech-to-text failed, and a reminder email that could not be delivered after all retries. Provider failures are tagged with provider and failure type |
| Insights → AI / Agents | Each voice parse as an `invoke_agent reminder-parser` run containing the `chat gemma-4-26b-a4b-it` call(s), with model, token usage, finish reason and retry attempts. The run is tagged with the outcome: `needs_clarification`, `ambiguities`, `confidence`, `recurrence` |
| Traces | API requests, plus `ai.speech_to_text` (Whisper) and `reminder.deliver` spans with their outcome |
| Crons | Monitor `argzel-reminder-dispatch`, created automatically on the first check-in. It alerts after 3 missed or failed runs |

**Privacy:** request bodies, cookies, auto-collected user data, database query data, stack-frame variables and AI prompt/response content are all disabled (`src/sentry.privacy.ts`). Users are identified by account id only, so transcripts, reminder text and emails never reach Sentry.

## 5. Verify the live deployment

From your machine:

```bash
BASE=https://argzel.onrender.com CRON_SECRET_PROD=<render CRON_SECRET> npm run smoke
```

This runs 17 checks and sends no email:
- health and the database;
- sign up, sign out, sign in, with Secure, HttpOnly cookies;
- the profile and the confirmation guard;
- a live Gemma parse;
- save, fetch, edit and delete a reminder;
- cron authorization;
- the sign-in rate limit.

Each run leaves one `smoke-<timestamp>@example.com` account behind, which can be deleted in Atlas. For the email path, create a reminder due in 2 minutes and watch it arrive. The cron must already be running.

## Operations

- **Rate limits** (in memory, per instance; 429 `RATE_LIMITED`):

  | Action | Limit |
  | --- | --- |
  | Sign-up | 10 / 15 min per IP |
  | Sign-in | 30 / 5 min per IP, plus 10 / 15 min per account |
  | Transcribe | 30 / 5 min per user |
  | Parse | 30 / 5 min per user |

- **Health:** `/api/health` returns 200 or 503, plus the short commit id. Render restarts the service and holds back bad deploys based on it.
- **Rolling back:** in Render → Deploys, pick an earlier deploy and choose **Rollback**.
- **Rotating secrets:** changing `AUTH_SECRET` signs everyone out. Changing `CRON_SECRET` needs the cron caller updated too.
