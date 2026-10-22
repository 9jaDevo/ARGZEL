# ARGZEL · Quiet precision

The master spec remains authoritative. This document defines the frontend visual foundation, not backend behavior.

## Identity

A little less on your mind. The product promise remains **Speak it. Confirm it. Remember it.**

The mark is a deliberately cut geometric A: two ascending stems and an offset diagonal bridge. It suggests structure and forward movement without using a microphone, robot, brain, circuit, or sparkle as the brand. The microphone is reserved for the action itself. The compact silhouette works in one color at app-icon sizes.

Assets: `/brand/argzel-mark.svg`, `/brand/argzel-wordmark.svg`, `/brand/argzel-icon.svg`. The wordmark uses editable system text; outline its letters before final commercial artwork delivery. This is an original concept direction, not a trademark clearance.

Use graphite on ivory or ivory on graphite. Keep one mark-width of clear space. Do not rotate the production logo, add gradients to it, stretch it, or combine it with decorative AI symbols. The onboarding illustration may rotate the surrounding icon tile as a product visual. Minimum mark size: 24px; app tile: 48px. At smaller favicon sizes use the dedicated icon and inspect rasterization.

## Palette

| Token | Value | Purpose |
| --- | --- | --- |
| Ink | `#20232B` | Primary type, primary action, brand |
| Canvas | `#F8F9FB` | App background |
| Surface | `#FFFFFF` | Forms and reminder cards |
| Accent | `#4165ED` | Focus and active navigation |
| Slate | `#697180` | Secondary body copy |
| Mist | `#ECEFF6` | Voice hero and illustration planes |
| Sage | `#EDF3EF` | Quiet success backgrounds |
| Border | `#E9EBF0` | Dividers and card edges |

The quieter decorative labels are not a substitute for essential text. Audit contrast again when finalizing the production accessibility pass.

## Typography

System sans (Arial / Helvetica fallback) keeps this foundation self-hosted and avoids font-service dependencies. The direction is a restrained neo-grotesk: 500-weight display headings with close tracking; 400-weight body text; 600-weight small uppercase section labels with open tracking. Desktop display 40px, mobile 32px, flow title 33–36px, card title 17–24px. Georgia italic is used sparingly for the editorial quote, not forms or actions.

## Geometry and motion

Spacing rhythm: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px. Mobile gutter 24px (18px below 370px); desktop gutter 48px. Form width 460px. Layout max width 1360px. Sidebar 244px; mobile navigation replaces it below 800px.

Radius: controls 10–12px, reminder rows 14px, cards 20px, hero 22px, icon tile 29px at 128px. Elevation uses thin borders first, then low-opacity graphite shadows. Reserve pronounced shadows for floating illustrations and dialogs.

Transitions: 180ms controls, 350ms page entry, slow organic breathing for the recording illustration. Honor `prefers-reduced-motion`. Focus uses a visible 3px blue outline. Main controls have 44–48px minimum height; safe-area padding protects mobile navigation. Minor desktop text actions remain compact and should receive a final touch-target audit.

## Components and states

`Button` (primary, secondary, ghost), `Card`, labeled `Input`, `Brand`, and `Wave` are shared primitives. The experience composes reminder rows, structured review cards, form grids, bottom navigation, status tags, a deletion dialog, and an empty state. Lucide icons use a consistent light outline.

Screens: splash → 3-slide onboarding → sign in / sign up → dashboard → recording preview → sample processing → editable confirmation → success. Details, completion, deletion, reminder filters, settings, and replayable onboarding are included.

Dashboard sample dates are explicitly anchored to October 21, 2026. They are fixture data, not today's live schedule. Only onboarding completion persists in localStorage. Reminders and settings reset on refresh. No reminder enters demo state before explicit confirmation. Existing reminder edits preserve their ID. Browser speech synthesis is optional and manually initiated.

## Integration boundaries

Replace fixture data through a typed service layer once the backend contract exists. The `Reminder` UI type is a view model, not the final database schema. Backend work must enforce ownership, timezone conversion, ambiguity handling, validation, persistence, and email scheduling. Never connect real scheduling to these frontend preview timers. Auth submit intentionally reports unavailable; demo access is separate. Recording never asks for microphone access or claims real transcription. Processing advances only when the user reviews the sample. Settings show local preference controls; they do not configure a delivery provider.

The visual foundation does not establish production readiness. Real-device Safari testing, final contrast checks, verification of the implemented dialog keyboard loop, connected service failures, and live provider acceptance belong to later integration QA.

## October 22 experience refinement

`experience-polish.css` applies the readable experience layer after the base visual foundation: 14px primary buttons, 16px form controls to avoid iOS input zoom, 52px voice actions, and 52–54px mobile navigation targets. Supporting content uses stronger slate tones. Key text-pair contrast checks range from 4.93:1 to 7.5:1; form borders are 3.63:1 against white. These sampled checks do not replace a full accessibility audit.

Composition now uses dedicated `Dashboard`, `AuthScreen`, `Onboarding`, `SettingsScreen`, `PreferenceToggle`, `MobileNavigation`, and `EmptyState` components. Shared input hints are connected through `aria-describedby`; password reveal is a labeled toggle. Active navigation exposes `aria-current`. A keyboard skip link targets the main region, and screen/slide changes move focus to their heading. Onboarding has three distinct product illustrations, direct step controls, Back, Skip and Continue/Get started. Motion respects reduced-motion preferences.

Keep all new screen polish in this experience layer or its reusable components; avoid duplicating ad hoc styles inside individual screen branches. Demo preferences and reminders still live in memory, and onboarding completion stays on the current device. No backend services were connected in this refinement.
