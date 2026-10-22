import { appendFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ParseResult } from '@/types/api';
import { SYSTEM_PROMPT, buildUserPrompt } from './parse';
import { parseExtraction, type Extraction } from './extraction';
import { generate } from './gemma';
import { resolveReminder } from './resolve';

// Runs the documented sample phrases through the real Gemma model with the same
// fixed clock as resolve.test.ts, and checks the end result. `npm run test:live`.

const NOW = new Date('2026-10-21T08:00:00Z'); // Wednesday 09:00 in Lagos
const TZ = 'Africa/Lagos';

beforeAll(() => {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // Keys may already be in the environment.
  }
});

// Free-tier quotas are per minute (each call sends ~1.5k prompt tokens), so space calls out.
const MIN_GAP_MS = 7_000;
let lastCall = 0;
async function pace() {
  const wait = lastCall + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCall = Date.now();
}

const optionTimes =(r: ParseResult) => r.options.map((o) => o.result.scheduled_at);

const CASES: [string, (r: ParseResult, x: Extraction) => void][] = [
  ['Remind me to renew my hosting next Friday at 10 AM.', (r) => {
    expect(r.title).toMatch(/renew.*hosting/i);
    expect(r.ambiguities).toEqual(['ambiguous_next_weekday']);
    expect(optionTimes(r)).toEqual(['2026-10-23T09:00:00.000Z', '2026-10-30T09:00:00.000Z']);
  }],
  ['Tomorrow morning remind me to call James.', (r) => {
    expect(r.title).toMatch(/call james/i);
    expect(r.ambiguities).toEqual(['vague_time']);
    expect(r.clarification_question).toBe('What time tomorrow morning?');
  }],
  ['Every Monday at 7 AM remind me to pray.', (r) => {
    expect(r.title).toMatch(/pray/i);
    expect(r).toMatchObject({ needs_clarification: false, recurrence: 'weekly', scheduled_at: '2026-10-26T06:00:00.000Z' });
  }],
  ['Remind me in two hours to submit my proposal.', (r) => {
    expect(r.title).toMatch(/submit.*proposal/i);
    expect(r).toMatchObject({ needs_clarification: false, scheduled_at: '2026-10-21T10:00:00.000Z' });
  }],
  ['Tomorrow 8 in the morning, remind me to call James.', (r) => {
    expect(r).toMatchObject({ needs_clarification: false, scheduled_at: '2026-10-22T07:00:00.000Z' });
  }],
  ['Remind me at 7 to call mum.', (r) => {
    expect(r.ambiguities[0]).toBe('ambiguous_meridiem');
    expect(optionTimes(r)).toEqual(['2026-10-22T06:00:00.000Z', '2026-10-21T18:00:00.000Z']);
  }],
  ['Remind me today at 8 AM to stretch.', (r) => {
    expect(r.ambiguities).toEqual(['time_in_past']);
    expect(optionTimes(r)).toEqual(['2026-10-22T07:00:00.000Z']);
  }],
  ['Remind me tomorrow.', (r) => {
    expect(r.ambiguities[0]).toBe('missing_title');
  }],
  ['Remind me to call the bank.', (r) => {
    expect(r.ambiguities).toEqual(['missing_when']);
  }],
  ['Remind me on Friday to pay rent.', (r) => {
    expect(r).toMatchObject({ ambiguities: ['missing_time'], date: '2026-10-23' });
  }],
  ['Remind me to drink water every other day at 9 AM.', (r) => {
    expect(r.ambiguities).toEqual(['unsupported_recurrence']);
  }],
  ['Next Tuesday at 10am remind me to file taxes.', (r) => {
    expect(r).toMatchObject({ needs_clarification: false, scheduled_at: '2026-10-27T09:00:00.000Z' });
  }],
  ['Every day at 6 PM remind me to take my medicine.', (r) => {
    expect(r).toMatchObject({ needs_clarification: false, recurrence: 'daily', scheduled_at: '2026-10-21T17:00:00.000Z' });
  }],
  ['On October 30 at 3 pm remind me to go to the dentist.', (r) => {
    expect(r).toMatchObject({ needs_clarification: false, scheduled_at: '2026-10-30T14:00:00.000Z' });
  }],
  ['Every month on the 5th at 9 AM remind me to pay rent.', (r) => {
    expect(r).toMatchObject({ needs_clarification: false, recurrence: 'monthly', date: '2026-11-05' });
  }],
];

describe(`Gemma live (${process.env.GEMMA_MODEL || 'default model'})`, () => {
  for (const [said, check] of CASES) {
    it(said, async () => {
      await pace();
      const started = Date.now();
      const raw = await generate(SYSTEM_PROMPT, buildUserPrompt({ text: said, timezone: TZ, now: NOW }));
      const extraction = parseExtraction(raw);
      expect(extraction, `unparseable reply: ${raw}`).not.toBeNull();
      const result = resolveReminder(extraction!, { now: NOW, timezone: TZ, sourceText: said });
      const line = JSON.stringify({
          said,
          ms: Date.now() - started,
          gemma: Object.fromEntries(Object.entries(extraction!).filter(([, v]) => v !== null && v !== false)),
          title: result.title,
          ambiguities: result.ambiguities,
          question: result.clarification_question,
          scheduled_at: result.scheduled_at,
          speech: result.preview.speech,
      });
      console.log(line);
      // Set LIVE_LOG=<file> to collect one JSON line per phrase.
      if (process.env.LIVE_LOG) appendFileSync(process.env.LIVE_LOG, `${line}\n`);
      check(result, extraction!);
    });
  }
});
