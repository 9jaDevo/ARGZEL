import { describe, expect, it } from 'vitest';
import { parseExtraction } from './extraction';
import { buildUserPrompt } from './parse';
import { audioExtension } from './transcribe';

describe('parseExtraction (Gemma reply -> fields)', () => {
  it('reads JSON wrapped in code fences and prose', () => {
    const raw = 'Sure!\n```json\n{"title":"Call James","day_offset":1,"day_part":"morning","recurrence":"none","confidence":0.8}\n```';
    expect(parseExtraction(raw)).toMatchObject({ title: 'Call James', day_offset: 1, day_part: 'morning', confidence: 0.8 });
  });

  it('normalises case and time format, and drops invalid values instead of failing', () => {
    const x = parseExtraction(
      JSON.stringify({
        title: '  ',
        weekday: 'Friday',
        weekday_modifier: 'NEXT',
        time: '7:05',
        date: '2026-02-30',
        day_part: 'dawn',
        recurrence: 'yearly',
        confidence: 5,
        minute_offset: -10,
      }),
    );
    expect(x).toMatchObject({
      title: null,
      weekday: 'friday',
      weekday_modifier: 'next',
      time: '07:05',
      date: null,
      day_part: null,
      recurrence: 'none',
      confidence: 0.5,
      minute_offset: null,
      time_ambiguous_meridiem: false,
    });
  });

  it('returns null when there is no JSON object', () => {
    expect(parseExtraction('I cannot help with that.')).toBeNull();
    expect(parseExtraction('{not json}')).toBeNull();
    expect(parseExtraction('[1, 2]')).toBeNull();
  });
});

describe('buildUserPrompt', () => {
  const now = new Date('2026-10-21T08:00:00Z');

  it("gives the model today's date, a calendar and the quoted text", () => {
    const prompt = buildUserPrompt({ text: 'Remind me to pray every Monday at 7', timezone: 'Africa/Lagos', now });
    expect(prompt).toContain('Now: Wed 2026-10-21 09:00 (Africa/Lagos).');
    expect(prompt).toContain('Calendar: Wed 2026-10-21 (today), Thu 2026-10-22, Fri 2026-10-23,');
    expect(prompt).toContain('User: "Remind me to pray every Monday at 7"');
  });

  it('includes the clarification exchange', () => {
    const prompt = buildUserPrompt({
      text: 'Remind me to call James tomorrow morning',
      clarification: { question: 'What time tomorrow morning?', answer: 'half past eight' },
      timezone: 'Africa/Lagos',
      now,
    });
    expect(prompt).toContain('The app then asked: "What time tomorrow morning?"');
    expect(prompt).toContain('User answered: "half past eight"');
  });
});

describe('audioExtension', () => {
  it('maps browser recording types', () => {
    expect(audioExtension('audio/webm;codecs=opus')).toBe('webm');
    expect(audioExtension('audio/mp4')).toBe('mp4');
    expect(audioExtension('audio/x-m4a')).toBe('m4a');
    expect(audioExtension('text/plain')).toBeNull();
  });
});
