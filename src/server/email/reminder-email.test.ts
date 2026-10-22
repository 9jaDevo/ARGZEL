import { describe, expect, it } from 'vitest';
import { reminderEmail } from './reminder-email';

const base = {
  name: 'Ada Obi',
  title: 'Renew my hosting',
  notes: 'Check the annual plan first',
  scheduledAt: new Date('2026-10-23T09:00:00Z'),
  timezone: 'Africa/Lagos',
  recurrence: 'none' as const,
  appUrl: 'https://argzel.example',
};

describe('reminderEmail', () => {
  it('includes the title, local date and time, notes and a link back to the app', () => {
    const email = reminderEmail(base);
    expect(email.subject).toBe('Reminder: Renew my hosting');
    expect(email.text).toContain('Hi Ada,');
    expect(email.text).toContain('Friday 23 October at 10:00 AM (Africa/Lagos)');
    expect(email.text).toContain('Check the annual plan first');
    expect(email.text).toContain('Open ARGZEL: https://argzel.example');
    expect(email.html).toContain('href="https://argzel.example"');
    expect(email.html).toContain('Friday 23 October at 10:00 AM');
  });

  it('describes repeats and omits empty notes', () => {
    const email = reminderEmail({ ...base, notes: '', recurrence: 'weekly' });
    expect(email.text).toContain('Repeats every Friday');
    expect(email.html).not.toContain('white-space:pre-wrap');
  });

  it('escapes user text in the HTML', () => {
    const email = reminderEmail({ ...base, title: '<script>alert(1)</script>', notes: 'Tom & "Jerry"' });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain('Tom &amp; &quot;Jerry&quot;');
  });
});
