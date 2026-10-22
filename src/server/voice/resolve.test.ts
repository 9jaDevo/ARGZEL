import { describe, expect, it } from 'vitest';
import { extractionSchema, type Extraction } from './extraction';
import { resolveReminder } from './resolve';

// Fixed clock: Wednesday 21 October 2026, 09:00 in Lagos (UTC+1).
const NOW = new Date('2026-10-21T08:00:00Z');
const TZ = 'Africa/Lagos';

/** A Gemma extraction with defaults for every field not given. */
const ex = (fields: Partial<Extraction>): Extraction => ({ ...extractionSchema.parse({}), confidence: 0.9, ...fields });
const resolve = (sourceText: string, fields: Partial<Extraction>, timezone = TZ) =>
  resolveReminder(ex(fields), { now: NOW, timezone, sourceText });

describe('spec examples', () => {
  it('"Remind me to renew my hosting next Friday at 10 AM." asks which Friday', () => {
    const r = resolve('Remind me to renew my hosting next Friday at 10 AM.', {
      title: 'Renew my hosting',
      weekday: 'friday',
      weekday_modifier: 'next',
      time: '10:00',
    });
    expect(r).toMatchObject({
      title: 'Renew my hosting',
      needs_clarification: true,
      clarification_question: 'Do you mean Friday 23 October or Friday 30 October?',
      ambiguities: ['ambiguous_next_weekday'],
      scheduled_at: null,
      confidence: 0.5,
    });
    expect(r.options.map((o) => o.label)).toEqual(['Friday 23 October', 'Friday 30 October']);
    expect(r.options[0].result).toMatchObject({
      needs_clarification: false,
      scheduled_at: '2026-10-23T09:00:00.000Z',
      date: '2026-10-23',
      time: '10:00',
      confidence: 0.9,
      preview: {
        day_label: 'Fri 23 Oct',
        time_label: '10:00 AM',
        recurrence_label: 'Does not repeat',
        summary: 'Renew my hosting · Friday 23 October at 10:00 AM',
        speech: "I'll remind you to renew your hosting on Friday 23 October at 10 AM. Should I save it?",
      },
    });
    expect(r.options[1].result.scheduled_at).toBe('2026-10-30T09:00:00.000Z');
  });

  it('"Tomorrow morning remind me to call James." asks what time, offering morning slots', () => {
    const r = resolve('Tomorrow morning remind me to call James.', { title: 'Call James', day_offset: 1, day_part: 'morning' });
    expect(r).toMatchObject({
      needs_clarification: true,
      clarification_question: 'What time tomorrow morning?',
      ambiguities: ['vague_time'],
      date: '2026-10-22',
      time: null,
      scheduled_at: null,
    });
    expect(r.options.map((o) => o.label)).toEqual(['8:00 AM', '9:00 AM', '10:00 AM']);
    expect(r.options[1].result).toMatchObject({
      needs_clarification: false,
      scheduled_at: '2026-10-22T08:00:00.000Z',
      preview: { day_label: 'Tomorrow', speech: "I'll remind you to call James tomorrow at 9 AM. Should I save it?" },
    });
  });

  it('"Every Monday at 7 AM remind me to pray." is a weekly reminder from next Monday', () => {
    const r = resolve('Every Monday at 7 AM remind me to pray.', { title: 'Pray', weekday: 'monday', time: '07:00', recurrence: 'weekly' });
    expect(r).toMatchObject({
      needs_clarification: false,
      clarification_question: null,
      ambiguities: [],
      recurrence: 'weekly',
      date: '2026-10-26',
      time: '07:00',
      scheduled_at: '2026-10-26T06:00:00.000Z',
      options: [],
      preview: { recurrence_label: 'Every Monday', speech: "I'll remind you to pray every Monday at 7 AM. Should I save it?" },
    });
  });

  it('"Remind me in two hours to submit my proposal." is exact', () => {
    const r = resolve('Remind me in two hours to submit my proposal.', { title: 'Submit my proposal', minute_offset: 120 });
    expect(r).toMatchObject({
      needs_clarification: false,
      scheduled_at: '2026-10-21T10:00:00.000Z',
      date: '2026-10-21',
      time: '11:00',
      preview: { day_label: 'Today', speech: "I'll remind you to submit your proposal today at 11 AM. Should I save it?" },
    });
  });

  it('"Tomorrow 8 in the morning, remind me to call James." needs no question', () => {
    const r = resolve('Tomorrow 8 in the morning, remind me to call James.', { title: 'Call James', day_offset: 1, time: '08:00' });
    expect(r).toMatchObject({ needs_clarification: false, scheduled_at: '2026-10-22T07:00:00.000Z' });
  });
});

describe('ambiguity handling', () => {
  it('a bare "at 7" asks AM or PM, even if the model did not flag it', () => {
    const r = resolve('Remind me at 7 to call mum', { title: 'Call mum', time: '07:00' });
    expect(r).toMatchObject({ clarification_question: 'Is that 7:00 AM or 7:00 PM?', ambiguities: ['ambiguous_meridiem'], time: null });
    // 7 AM has passed today, so it rolls to tomorrow; 7 PM is still today.
    expect(r.options.map((o) => [o.label, o.result.scheduled_at])).toEqual([
      ['7:00 AM', '2026-10-22T06:00:00.000Z'],
      ['7:00 PM', '2026-10-21T18:00:00.000Z'],
    ]);
  });

  it('accepts Whisper\'s "10 a.m." spelling as a clear AM/PM', () => {
    const r = resolve('Every Monday at 7 a.m. remind me to pray.', { title: 'Pray', weekday: 'monday', time: '07:00', recurrence: 'weekly' });
    expect(r).toMatchObject({ needs_clarification: false, scheduled_at: '2026-10-26T06:00:00.000Z' });
  });

  it('"today at 8" said at 9 AM asks AM/PM first, then offers tomorrow for 8 AM', () => {
    const r = resolve('Remind me today at 8 to stretch', { title: 'Stretch', day_offset: 0, time: '08:00' });
    expect(r.ambiguities).toEqual(['ambiguous_meridiem', 'time_in_past']);
    const [am, pm] = r.options;
    expect(pm.result).toMatchObject({ needs_clarification: false, scheduled_at: '2026-10-21T19:00:00.000Z' });
    expect(am.result).toMatchObject({ clarification_question: 'That time has already passed. When should I remind you instead?' });
    expect(am.result.options[0]).toMatchObject({ label: 'Tomorrow at 8:00 AM', result: { scheduled_at: '2026-10-22T07:00:00.000Z' } });
  });

  it('"today at 8 AM" said at 9 AM says the time has passed', () => {
    const r = resolve('Remind me today at 8 AM to stretch', { title: 'Stretch', day_offset: 0, time: '08:00' });
    expect(r).toMatchObject({ ambiguities: ['time_in_past'], scheduled_at: null });
    expect(r.options.map((o) => o.label)).toEqual(['Tomorrow at 8:00 AM']);
  });

  it('no task asks what to remind about first', () => {
    const r = resolve('Remind me tomorrow', { day_offset: 1 });
    expect(r).toMatchObject({
      title: '',
      clarification_question: 'What should I remind you about?',
      ambiguities: ['missing_title', 'missing_time'],
      options: [],
      preview: { title: 'New reminder', speech: 'What should I remind you about?' },
    });
  });

  it('no time at all asks when', () => {
    const r = resolve('Remind me to call the bank', { title: 'Call the bank' });
    expect(r).toMatchObject({ clarification_question: 'When should I remind you?', ambiguities: ['missing_when'] });
  });

  it('a day without a time offers suggested times', () => {
    const r = resolve('Remind me on Friday to pay rent', { title: 'Pay rent', weekday: 'friday' });
    expect(r).toMatchObject({ clarification_question: 'What time on Friday 23 October?', ambiguities: ['missing_time'] });
    expect(r.options.map((o) => o.label)).toEqual(['9:00 AM', '1:00 PM', '6:00 PM']);
  });

  it('unsupported repeat patterns ask for a supported one', () => {
    const r = resolve('Remind me to drink water every other day at 9 AM', {
      title: 'Drink water',
      time: '09:00',
      recurrence: 'daily',
      recurrence_unsupported: true,
    });
    expect(r.clarification_question).toBe('I can repeat reminders every day, week or month. Which would you like?');
    expect(r.options.map((o) => o.label)).toEqual(['Every day', 'Every week', 'Every month', "Don't repeat"]);
    expect(r.options[0].result).toMatchObject({ needs_clarification: false, recurrence: 'daily', scheduled_at: '2026-10-22T08:00:00.000Z' });
  });

  it("uses the model's own question when it is unsure about something else", () => {
    const r = resolve('Remind me to call tomorrow at 10 am', {
      title: 'Call',
      day_offset: 1,
      time: '10:00',
      confidence: 0.4,
      clarification_question: 'Who should I call?',
    });
    expect(r).toMatchObject({ clarification_question: 'Who should I call?', ambiguities: ['unclear'], scheduled_at: '2026-10-22T09:00:00.000Z' });
  });

  it('"next Friday morning" asks the day, then the time', () => {
    const r = resolve('Next Friday morning remind me to call mum', { title: 'Call mum', weekday: 'friday', weekday_modifier: 'next', day_part: 'morning' });
    expect(r.ambiguities).toEqual(['ambiguous_next_weekday', 'vague_time']);
    expect(r.options[0].result).toMatchObject({ clarification_question: 'What time on Friday morning?' });
    expect(r.options[0].result.options[0].result.scheduled_at).toBe('2026-10-23T07:00:00.000Z');
  });
});

describe('date resolution', () => {
  it('"next Tuesday" said on Wednesday can only mean in 6 days', () => {
    const r = resolve('Next Tuesday at 10am remind me to file taxes', { title: 'File taxes', weekday: 'tuesday', weekday_modifier: 'next', time: '10:00' });
    expect(r).toMatchObject({ needs_clarification: false, date: '2026-10-27' });
  });

  it('a plain weekday that is today but already past means next week', () => {
    const r = resolve('Every Wednesday at 8 AM remind me to water the plants', {
      title: 'Water the plants',
      weekday: 'wednesday',
      time: '08:00',
      recurrence: 'weekly',
    });
    expect(r).toMatchObject({ date: '2026-10-28', scheduled_at: '2026-10-28T07:00:00.000Z' });
  });

  it('a repeating reminder whose first time has passed starts at the next occurrence', () => {
    const r = resolve('Every day at 8 AM remind me to stretch', { title: 'Stretch', day_offset: 0, time: '08:00', recurrence: 'daily' });
    expect(r).toMatchObject({
      needs_clarification: false,
      date: '2026-10-22',
      preview: { speech: "I'll remind you to stretch every day at 8 AM, starting tomorrow. Should I save it?" },
    });
  });

  it('a daily reminder later today', () => {
    const r = resolve('Every day at 6 PM remind me to take my medicine', { title: 'Take my medicine', time: '18:00', recurrence: 'daily' });
    expect(r).toMatchObject({
      scheduled_at: '2026-10-21T17:00:00.000Z',
      preview: { recurrence_label: 'Every day', speech: "I'll remind you to take your medicine every day at 6 PM. Should I save it?" },
    });
  });

  it('a named calendar date', () => {
    const r = resolve('On October 30 at 3 pm remind me to go to the dentist', { title: 'Go to the dentist', date: '2026-10-30', time: '15:00' });
    expect(r).toMatchObject({ scheduled_at: '2026-10-30T14:00:00.000Z', preview: { day_label: 'Fri 30 Oct' } });
  });

  it('a monthly reminder names the day of the month', () => {
    const r = resolve('Every month on the 5th at 9 AM remind me to pay rent', { title: 'Pay rent', date: '2026-11-05', time: '09:00', recurrence: 'monthly' });
    expect(r.preview).toMatchObject({
      recurrence_label: 'Every month on the 5th',
      speech: "I'll remind you to pay rent every month on the 5th at 9 AM. Should I save it?",
    });
  });

  it('"on the 5th" resolves the next 5th from the day number', () => {
    const r = resolve('Every month on the 5th at 9 AM remind me to pay rent', { title: 'Pay rent', day_of_month: 5, time: '09:00', recurrence: 'monthly' });
    expect(r).toMatchObject({ date: '2026-11-05', scheduled_at: '2026-11-05T08:00:00.000Z', preview: { recurrence_label: 'Every month on the 5th' } });
  });

  it('a day number later this month stays in this month; today-but-passed moves to next month', () => {
    expect(resolve('on the 25th at 9 AM pay the bill', { title: 'Pay the bill', day_of_month: 25, time: '09:00' }).date).toBe('2026-10-25');
    expect(resolve('on the 21st at 8 AM pay the bill', { title: 'Pay the bill', day_of_month: 21, time: '08:00' }).date).toBe('2026-11-21');
  });

  it('"the 31st" clamps to the last day of a shorter month', () => {
    // 31 Oct is still ahead, so this month; from November it would be the 30th.
    expect(resolve('on the 31st at 9 AM file the report', { title: 'File the report', day_of_month: 31, time: '09:00' }).date).toBe('2026-10-31');
    const nov = resolveReminder(ex({ title: 'File the report', day_of_month: 31, time: '09:00' }), {
      now: new Date('2026-11-02T08:00:00Z'),
      timezone: TZ,
      sourceText: 'on the 31st at 9 AM file the report',
    });
    expect(nov.date).toBe('2026-11-30');
  });

  it('shows the year for dates in another year', () => {
    const r = resolve('On January 5 at 9 AM remind me to renew my licence', { title: 'Renew my licence', date: '2027-01-05', time: '09:00' });
    expect(r.preview.day_label).toBe('Tue 5 Jan 2027');
  });

  it("uses the user's timezone, including daylight saving time", () => {
    const r = resolve('Tomorrow at 9 AM remind me to call the office', { title: 'Call the office', day_offset: 1, time: '09:00' }, 'America/New_York');
    expect(r).toMatchObject({ timezone: 'America/New_York', date: '2026-10-22', scheduled_at: '2026-10-22T13:00:00.000Z' });
  });

  it('tidies the title and keeps the source text verbatim', () => {
    const r = resolve('remind me to buy milk tomorrow at 9am!', { title: 'remind me to buy milk.', day_offset: 1, time: '09:00' });
    expect(r).toMatchObject({ title: 'Buy milk', source_text: 'remind me to buy milk tomorrow at 9am!' });
  });
});
