# Voice experience — 22 October 2026

This phase implements the frontend recording, listening, processing, review, edit and success experience from the master spec. The visible application deliberately uses the mock adapter. Its microphone is off, reminders live only in session memory, and no email is sent.

## Components and state

- `VoiceFlow` composes reusable screens and `ReminderEditor`.
- `useVoiceReminder` owns recording → transcribing → parsing → preview → saving → success, plus recoverable errors. Processing advances when each adapter promise completes. There are no fictional percentages or enforced minimum waits.
- Large microphone toggles the demo's pause/resume state. Retry clears the unsaved draft and timer. Closing during processing aborts the operation; late results cannot reopen the flow.
- Only the confirmed save callback updates the dashboard. Review changes never saves. Repeated submissions are guarded synchronously, and existing reminder edits retain their ID and status.
- Preview explicitly displays task, notes, date, local time, recurrence, delivery channel and timezone. Original words remain available. Optional browser read-back uses the current edited values and stops on navigation.
- Missing time produces a clarification question and disables confirmation until the user supplies valid details. Validation rejects past times, impossible dates and nonexistent DST times.
- Requests that may have saved but lost their response offer a reminder-list check instead of blind resubmission.

## Backend handoff

`src/lib/voice-service.ts` exports `VoiceService`, `createMockVoiceService` and `apiVoiceService`. Shared request/response types come from `src/types/api.ts`.

1. Capture an actual MediaRecorder Blob in a permission-aware recording hook. Pass it to `finish(audio)`; the present demo button intentionally passes no recording.
2. Select `apiVoiceService` after connecting real authentication. It uploads multipart `audio` to `/api/voice/transcribe`, then posts `{ text, timezone }` to `/api/voice/parse`. Parse accepts the existing clarification context contract too.
3. New reminders POST the reviewed date/time/timezone and `confirmed: true` to `/api/reminders`. Existing reminders PATCH accepted fields to `/api/reminders/:id`.
4. Connect the authenticated reminder store and adapt demo-specific copy before enabling live mode. Refresh server data after uncertain save outcomes. Do not silently fall back to mock success on provider/auth errors.

Adapters accept AbortSignal; network calls include same-origin credentials. Demo parsing recognizes only its two labelled examples. It never pretends to interpret arbitrary speech. Pure timezone helpers reuse the existing `src/server/time.ts` implementation, which contains no database access or secrets.

## Captured verification

Chrome responsive emulation against a local production build:

- Listening and preview: 320, 390, 430, 768, 1024 and 1440px, no horizontal overflow.
- Pause/resume labels and timer, automatic processing, retry reset, cancellation during processing with no late navigation.
- Missing-time example disables Confirm; editing to 15:30 produces 3:30 PM in review.
- Review cancellation leaves the original three fixture reminders unchanged.
- Confirm creates one fourth reminder; editing its task/time preserves the count at four and displays the new 4:45 PM time.
- Heading focus follows screen transitions; controls have accessible labels, disabled/busy states and reduced-motion styles.

Screenshots: `screenshots/voice-recording-mobile.jpg`, `voice-processing-mobile.jpg`, `voice-preview-mobile.jpg`, `voice-success-mobile.jpg`, `voice-preview-desktop.jpg`.

Automated: 12 focused adapter/validation tests (mock timing, abort, missing-time clarification, explicit confirmation, edits, DST/time validation, multipart shape, parse context, POST/PATCH contract, auth errors, uncertain/invalid save responses and missing audio). Lint, TypeScript and production build also checked.

Physical iPhone/Safari and Android recording permissions, real capture/provider/Atlas round trips, browser speech output and full screen-reader acceptance remain open. These checks do not establish end-to-end production readiness.
