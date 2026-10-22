# ARGZEL Voice Parsing (Phase 6)

How speech becomes a reminder preview: transcription, Gemma parsing, ambiguity detection, clarification, and the data the frontend renders. API conventions (auth cookie, error shape) are in `docs/BACKEND.md`.

## Pipeline

```
mic ─► POST /api/voice/transcribe ─► Whisper ─► { text }
        (audio in memory only, never stored)
text ─► POST /api/voice/parse ─► Gemma 4: describes the reminder (JSON)
                                 └► resolver (plain code): computes dates in the user's timezone,
                                    detects ambiguity, builds question + options + preview
     ◄─ { result: ParseResult }
user confirms ─► POST /api/reminders { confirmed: true, ... }   (only now is anything saved)
```

**Gemma describes *when*; it never computes dates.** Gemma reports "weekday: friday, modifier: next, time: 10:00", "day_offset: 1, day_part: morning" or "minute_offset: 120". `src/server/voice/resolve.ts` turns that into concrete dates. Date arithmetic is where language models fail most (spec "Known Risks"). Keeping it in plain code makes every rule exact, testable without an API key, and independent of the model.

| Piece | File |
| --- | --- |
| Whisper client (OpenAI-compatible) | `src/server/voice/transcribe.ts` |
| Gemma client (Gemini API `generateContent`) | `src/server/voice/gemma.ts` |
| Prompt + orchestration | `src/server/voice/parse.ts` |
| Gemma reply → validated fields | `src/server/voice/extraction.ts` |
| Date resolution, ambiguity, options | `src/server/voice/resolve.ts` |
| Labels and read-back sentence | `src/server/voice/preview.ts` |
| Tests (29) | `src/server/voice/*.test.ts` (`npm test`) |

## Providers and environment

| Variable | Default | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | (required) | Free key from Google AI Studio. Used for Gemma on the Gemini API. |
| `GEMMA_MODEL` | `gemma-4-26b-a4b-it` | Fast mixture-of-experts Gemma 4. `gemma-4-31b-it` is the larger option. Called with thinking off (`thinkingLevel: "minimal"`), which is about 3x faster for this extraction task. Timeouts (10 s), 429s and 5xx errors are retried up to 3 times. |
| `STT_API_KEY` | none | Groq key for hosted Whisper. Leave empty for a self-hosted server that needs no auth. |
| `STT_API_URL` | Groq `/openai/v1/audio/transcriptions` | Any OpenAI-compatible endpoint: Groq, OpenAI, or a self-hosted faster-whisper server. |
| `STT_MODEL` | `whisper-large-v3-turbo` | Open Whisper model. |

Both models are open-weight (Gemma 4, Whisper), as the spec intends. Hosting them via Gemini API and Groq keeps Render light; switching to self-hosting changes env values only, not code.

## Endpoints

### `POST /api/voice/transcribe`
`multipart/form-data` with an `audio` file, e.g. a `MediaRecorder` blob. Accepted types: webm/ogg (Chrome, Firefox, Android), mp4/m4a/aac (iOS Safari), mp3, wav, flac. Max 10 MB (minutes of speech; a reminder takes seconds).

→ `200 { text }` · `400 VALIDATION_ERROR` (missing, empty, too large or unsupported audio) · `422 NO_SPEECH` · `502 STT_UNAVAILABLE`

```ts
const form = new FormData();
form.append('audio', blob, 'recording.webm');
const { text } = await fetch('/api/voice/transcribe', { method: 'POST', body: form }).then((r) => r.json());
```

### `POST /api/voice/parse`
```json
{ "text": "Tomorrow morning remind me to call James.",
  "timezone": "Africa/Lagos",
  "clarification": { "question": "What time tomorrow morning?", "answer": "half past eight" } }
```
- `text` is required, up to 500 characters. It can also be typed text, as a fallback when the mic is unavailable.
- `timezone` defaults to the user's profile timezone.
- `clarification` is optional. Send it when the user answers a question in their own words.

→ `200 { result: ParseResult }` · `400 VALIDATION_ERROR` · `502 AI_UNAVAILABLE`. Nothing is saved.

### `ParseResult` (real output for "Tomorrow morning remind me to call James.")
```json
{
  "title": "Call James",
  "notes": "",
  "source_text": "Tomorrow morning remind me to call James.",
  "timezone": "Africa/Lagos",
  "recurrence": "none",
  "scheduled_at": null,
  "date": "2026-10-22",
  "time": null,
  "confidence": 0.5,
  "needs_clarification": true,
  "clarification_question": "What time tomorrow morning?",
  "ambiguities": ["vague_time"],
  "options": [
    { "label": "8:00 AM", "result": {
        "title": "Call James", "notes": "", "source_text": "Tomorrow morning remind me to call James.",
        "timezone": "Africa/Lagos", "recurrence": "none",
        "scheduled_at": "2026-10-22T07:00:00.000Z", "date": "2026-10-22", "time": "08:00",
        "confidence": 0.85, "needs_clarification": false, "clarification_question": null,
        "ambiguities": [], "options": [],
        "preview": { "title": "Call James", "day_label": "Tomorrow", "time_label": "8:00 AM",
                     "recurrence_label": "Does not repeat", "channel_label": "Email",
                     "summary": "Call James · Thursday 22 October at 8:00 AM",
                     "speech": "I'll remind you to call James tomorrow at 8 AM. Should I save it?" } } },
    { "label": "9:00 AM", "result": { "…": "…" } },
    { "label": "10:00 AM", "result": { "…": "…" } }
  ],
  "preview": {
    "title": "Call James", "day_label": "Tomorrow", "time_label": null,
    "recurrence_label": "Does not repeat", "channel_label": "Email",
    "summary": "Call James · Thursday 22 October",
    "speech": "What time tomorrow morning?"
  }
}
```
The spec's fields are all present: `title`, `notes`, `scheduled_at`, `timezone`, `recurrence`, `confidence`, `needs_clarification`, `clarification_question`, `source_text`. Types are in `src/types/api.ts` (`ParseResult`, `ClarificationOption`, `ReminderPreview`, `AmbiguityCode`).

### Frontend flow
1. Record, then transcribe, then show `text` as "what I heard".
2. Parse, then render `result.preview` (title, day, time, repeat, channel).
3. If `needs_clarification`:
   - show and speak `clarification_question` (`preview.speech` holds it too);
   - render `options` as chips. **Tapping one replaces `result` with `option.result`**, with no extra request. That result may carry its own follow-up question, e.g. day first, then time;
   - a spoken or typed answer goes to `/api/voice/parse` again with `clarification: { question, answer }`.
4. When `needs_clarification` is false:
   - speak `preview.speech` with `speechSynthesis`;
   - show Confirm, Edit and Retry.
5. On Confirm, send `POST /api/reminders`:
   ```json
   { "confirmed": true, "title": "…", "notes": "…", "source_text": "…", "timezone": "…", "recurrence": "…", "scheduled_at": "…", "ai_confidence": 0.85 }
   ```
   `ai_confidence` is the result's `confidence`. If the user edited the date or time, send `date` + `time` instead of `scheduled_at`.

## Ambiguity and clarification rules

One question at a time, asked in this order. `ambiguities` lists everything found.

| Code | Triggered by | Question | Options |
| --- | --- | --- | --- |
| `missing_title` | no task ("Remind me tomorrow at 9") | What should I remind you about? | none (free answer) |
| `missing_when` | no day, time or part of day | When should I remind you? | none |
| `ambiguous_next_weekday` | "next Friday" when the coming Friday is under 6 days away | Do you mean Friday 23 October or Friday 30 October? | both dates |
| `ambiguous_meridiem` | a clock time with no AM/PM or day-part word ("at 7") | Is that 7:00 AM or 7:00 PM? | both |
| `time_in_past` | a non-repeating time already gone ("today at 8 AM" at 9 AM) | That time has already passed. When should I remind you instead? | "Tomorrow at 8:00 AM" when sensible |
| `vague_time` | part of day without a clock time ("tomorrow morning") | What time tomorrow morning? | morning 8/9/10 AM · afternoon 1/2/3 PM · evening 6/7/8 PM · night 8/9/10 PM |
| `missing_time` | a day but no time ("on Friday") | What time on Friday 23 October? | 9 AM, 1 PM, 6 PM |
| `unsupported_recurrence` | every other day, weekdays only, fortnightly, yearly | I can repeat reminders every day, week or month. Which would you like? | Every day / week / month / Don't repeat |
| `unclear` | Gemma's own question, only when its confidence is below 0.6 | Gemma's question | none |

**Confidence:** Gemma's self-reported 0–1, capped at 0.5 while any question is pending. `scheduled_at` stays `null` until the moment itself is settled.

## Assumptions

1. **"Friday" / "this Friday"** means the coming Friday. If that is today, it means today when the time is still ahead, otherwise next week.
2. **"Next Friday"** is ambiguous when the coming Friday is 1–5 days away, so the user picks. When it is 6–7 days away (said on Saturday or Friday), it means that one.
3. **A day number without a month** ("on the 5th") means this month's if still ahead, otherwise next month's. In short months "the 31st" becomes the last day. Gemma reports the number and code picks the month.
4. **A time without a day** ("at 5 PM") means the next time that clock time comes round: today if still ahead, otherwise tomorrow.
5. **AM/PM:** "at 7" with no AM/PM and no day-part word is always asked about, even if Gemma did not flag it. A server-side check backs up the model.
6. **Parts of the day are not guessed** ("morning" never silently becomes 9 AM), per the spec's "ask rather than guess". The quick-pick chips make the extra step one tap.
7. **"In N minutes/hours"** is exact: now plus N, rounded up to the next minute. Nothing is asked.
8. **Repeating reminders** start at the next future occurrence: "every Wednesday at 8 AM" said on Wednesday at 9 AM starts next Wednesday. Only daily, weekly and monthly exist (spec); monthly keeps the day of the month.
9. **Times are interpreted in the user's timezone.** The request's `timezone` wins, otherwise the profile timezone. DST is handled.
10. **`source_text`** keeps the transcript verbatim. After a free-form clarification it becomes `"<original> — <answer>"`.
11. **Titles** are a short verb phrase in the user's words ("Renew my hosting"). The read-back switches to second person ("renew *your* hosting").
12. **English only** (spec): Whisper is called with `language=en`.
13. **Audio is never stored.** It is held in memory for one request and forwarded to Whisper (spec §12). The transcript is kept only as `source_text` on a confirmed reminder.

## Sample test cases and expected outputs

Clock fixed at **Wednesday 21 Oct 2026, 09:00, Africa/Lagos (UTC+1)**. Each row is an automated test in `src/server/voice/resolve.test.ts`. The "Gemma fields" column is what the prompt asks the model to return. Its few-shot examples include the first three rows.

| Said | Gemma fields (abridged) | Expected result |
| --- | --- | --- |
| Remind me to renew my hosting next Friday at 10 AM. | title "Renew my hosting", weekday friday, modifier next, time 10:00 | Asks "Do you mean Friday 23 October or Friday 30 October?" Options resolve to `2026-10-23T09:00Z` / `2026-10-30T09:00Z`. Read-back: "I'll remind you to renew your hosting on Friday 23 October at 10 AM. Should I save it?" |
| Tomorrow morning remind me to call James. | title "Call James", day_offset 1, day_part morning | Asks "What time tomorrow morning?" with options 8:00 / 9:00 / 10:00 AM. 9:00 AM resolves to `2026-10-22T08:00Z`. |
| Every Monday at 7 AM remind me to pray. | title "Pray", weekday monday, time 07:00, weekly | No question. `2026-10-26T06:00Z`, "Every Monday". Read-back: "I'll remind you to pray every Monday at 7 AM. Should I save it?" |
| Remind me in two hours to submit my proposal. | minute_offset 120 | No question. `2026-10-21T10:00Z` (11:00 AM today). |
| Tomorrow 8 in the morning, remind me to call James. | day_offset 1, time 08:00 | No question. `2026-10-22T07:00Z`. |
| Remind me at 7 to call mum | time 07:00 | Asks "Is that 7:00 AM or 7:00 PM?" AM resolves to tomorrow `06:00Z` (7 AM has passed today); PM to today `18:00Z`. |
| Remind me today at 8 to stretch | day_offset 0, time 08:00 | AM/PM first. PM resolves to today `19:00Z`. AM leads to "That time has already passed…" with option "Tomorrow at 8:00 AM". |
| Remind me today at 8 AM to stretch | day_offset 0, time 08:00 | Asks "That time has already passed. When should I remind you instead?" with option "Tomorrow at 8:00 AM". |
| Remind me tomorrow | day_offset 1, no title | Asks "What should I remind you about?" Ambiguities `missing_title`, `missing_time`. |
| Remind me to call the bank | title only | Asks "When should I remind you?" |
| Remind me on Friday to pay rent | weekday friday | Asks "What time on Friday 23 October?" with options 9 AM / 1 PM / 6 PM. |
| …drink water every other day at 9 AM | daily, unsupported | Asks to choose Every day / week / month / Don't repeat. "Every day" resolves to `2026-10-22T08:00Z`. |
| Next Friday morning remind me to call mum | friday, next, morning | Asks which Friday, then "What time on Friday morning?" |
| Next Tuesday at 10am remind me to file taxes | tuesday, next | No question. 27 Oct (6 days away). |
| Every Wednesday at 8 AM… | wednesday, weekly, 08:00 | Starts 28 Oct (today's 8 AM has passed). |
| Every day at 8 AM remind me to stretch | daily, day_offset 0, 08:00 | Starts tomorrow. Read-back "…every day at 8 AM, starting tomorrow." |
| Every month on the 5th at 9 AM… | monthly, day_of_month 5 | 5 Nov, "Every month on the 5th". |
| Tomorrow at 9 AM… (America/New_York) | day_offset 1, 09:00 | `2026-10-22T13:00Z` (EDT). |

`src/server/voice/parse.test.ts` covers the other pieces:
- tolerant reading of Gemma replies: code fences, capitalised values, "7:05", impossible dates, out-of-range numbers, non-JSON;
- the prompt's date context;
- audio type mapping.

## Not covered / next

- **Whisper, checked live (22 Oct 2026):** six sample phrases were synthesized with Windows text-to-speech and sent through `transcribe()` to Groq `whisper-large-v3-turbo`. All six transcripts were correct, at about 0.5–0.9 s each (the first, cold call took 9.7 s). Whisper writes times as "10 a.m." and the AM/PM check accepts that.
- **Gemma, checked live (22 Oct 2026, `gemma-4-26b-a4b-it`):** `npm run test:live` sends 15 sample phrases to the real model with the fixed test clock and checks each result against the table above. The suite is in `src/server/voice/gemma.live.ts` and is kept out of `npm test`. A clean run passed **15/15**, at a median of 3.0 s and a maximum of 4.7 s per phrase.
  - Fixed during live testing: for "every month on the 5th", Gemma left `date` empty. A `day_of_month` field now carries the number, and code picks the month.
  - Fixed during live testing: thinking is now off, about 3x faster.
  - Fixed during live testing: transient 500s and 429s are retried.
- **Free-tier quota:** Google's free tier returned occasional `500 Internal error` and per-minute `429` quota errors when calls came back to back. The live suite spaces calls 7 s apart. In the app a request that still fails returns `502 AI_UNAVAILABLE`, and the UI should offer typing as a fallback. For a demo with many users, enable billing or raise the quota.
- The frontend recording UI and its connection to these endpoints live in `src/lib/voice-service.ts` and `src/hooks/use-voice-reminder.ts`.
- Read-back uses the browser's `speechSynthesis` with `preview.speech`. ElevenLabs is optional and not wired.
