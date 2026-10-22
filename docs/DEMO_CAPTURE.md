# ARGZEL demo capture handoff

**Later frontend audit update:** Account-mode API wiring and browser capture are now implemented locally; explicit demo mode remains available. The dated phase notes below describe their original evidence. Current behavior and fixture-versus-provider acceptance are recorded in [FRONTEND_AUDIT.md](FRONTEND_AUDIT.md).

22 October 2026 · Frontend presentation and branding

## Ready to review

The final UI build is available locally on port 3002. The finalized identity board is `/brand`. The interface uses session-only demo data; capture it as a product preview, not as proof of live transcription, authentication or email delivery.

Final artwork:

- [Graphite wordmark](../public/brand/argzel-wordmark.svg)
- [Reversed wordmark](../public/brand/argzel-wordmark-reversed.svg)
- [Monogram](../public/brand/argzel-mark.svg)
- [App icon SVG](../public/brand/argzel-icon.svg)
- [1024px app icon PNG](../public/brand/argzel-icon-1024.png)
- [180px Apple touch icon](../public/brand/argzel-apple-touch.png)

The original geometric A and outlined uppercase letters are shared with the UI. There are no font dependencies, AI symbols or gradient logo treatments. The dark tile uses optically centered ivory artwork.

## Capture recipe

Use 390 × 844 CSS pixels for the phone master, browser zoom 100%, and a full-page still for screens taller than the viewport. Keep the separate 1440 × 1000 desktop dashboard and identity-board frames. Retain the demo disclosures. Capture short video at the normal motion setting; separately verify reduced motion. Use browser UI to navigate; do not inject hidden app state.

| Order | Screen          | Reproduction                                                                                |
| ----- | --------------- | ------------------------------------------------------------------------------------------- |
| 01    | Splash          | Begin video before opening `/`; the welcome transitions automatically.                      |
| 02–04 | Walkthrough     | Settings → Replay the welcome; capture all three slides.                                    |
| 05    | Sign in         | Get started from the walkthrough. Leave fields empty for the still.                         |
| 06    | Sign up         | Create an account; capture labels and password guidance.                                    |
| 07    | Dashboard       | Explore the demo; start with the original three fixtures.                                   |
| 08    | Recording       | Tap the hero microphone; use the labelled Hosting example.                                  |
| 09    | Processing      | Finish speaking; record the genuine adapter stage transition.                               |
| 10    | Review          | Show task, date, time, recurrence, delivery channel and timezone.                           |
| 11    | Edit            | Edit details; use a future date in the displayed timezone. Review changes does not save.    |
| 12    | Clarification   | Record again → Call James → Finish speaking. Confirm stays disabled until a time is chosen. |
| 13    | Success         | Explicitly Confirm reminder; capture the seal and complete summary.                         |
| 14    | Details         | View reminder details; capture normal actions and status.                                   |
| 15    | Settings        | Use Africa/Lagos and the default demo preferences.                                          |
| 16    | Completed empty | Fresh session → Completed filter, before completing any fixtures.                           |
| 17    | Upcoming empty  | Complete each fixture, then choose Upcoming. The copy acknowledges existing history.        |
| 18    | Delete dialog   | Open a reminder → Delete; capture Keep reminder and destructive action. Cancel afterward.   |
| 19    | Identity board  | Open `/brand`; show monochrome mark, wordmark, app icon and palette.                        |

Fixtures are anchored to the labelled demo day. New voice examples resolve tomorrow in the selected timezone. Session changes reset on refresh. Do not present the fixed demo day as a live calendar.

## Screenshot inventory and evidence

- Fresh final-artwork onboarding capture: [01-onboarding.jpg](screenshots/final/01-onboarding.jpg), inspected at 390px in Chrome.
- Final outlined identity export: [brand-wordmark-final.png](screenshots/brand-wordmark-final.png).
- Existing baseline set: `screenshots/dashboard-mobile.jpg`, `dashboard-desktop.jpg`, `settings-mobile.jpg`, `empty-state-mobile.jpg`, and `voice-*.jpg`. These predate the final outlined wordmark and empty/detail refinements; recapture them before treating them as final marketing artwork.

Chrome initially rendered the current dashboard and walkthrough. The final production build was then opened in the in-app browser and the first two walkthrough states were inspected. Repeated browser/debugger and screenshot timeouts interrupted the remaining capture sequence, including the breakpoint sweep. **Full final-screen capture and final responsive acceptance remain pending.** Earlier 320–1440px evidence is recorded in `FRONTEND_QA.md` and `VOICE_UX.md`; it does not verify this final CSS pass.

## Verification checklist

- [x] Final production build, including TypeScript validation.
- [x] ESLint without warnings after correcting the React 19 ref contract.
- [x] Twelve focused voice adapter/validation tests.
- [x] Final logo exported as font-independent SVG paths and app icon PNGs.
- [x] Current onboarding captured and visually inspected.
- [ ] Final breakpoint matrix: 320 / 390 / 430 / 768 / 1024 / 1440px on every primary screen.
- [ ] Long task/notes/timezone wrapping, native date/time inputs, and 200% zoom.
- [ ] Final empty-state and details screenshots.
- [ ] Dialog background isolation, focus return, Tab loop and Escape in the final browser build.
- [ ] Reduced-motion preference and full keyboard/screen-reader checks.
- [ ] Physical iPhone Safari and Android Chrome acceptance.

The previous local preview emitted Node `MaxListenersExceededWarning` messages during interrupted browser requests. No frontend exception was captured with that warning. Recheck the server/instrumentation during integrated runtime QA; this phase does not alter backend monitoring code.

Visual implementation is complete; browser acceptance and complete final capture are still open. Live auth, recording, durable reminders and delivery retain their own integration gates in the tracker.
