import mongoose from 'mongoose';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { EmailMessage, SendResult } from '../email/resend';
import { NotificationLog } from '../models/NotificationLog';
import { Reminder, type ReminderAttrs } from '../models/Reminder';
import { User } from '../models/User';
import { LEASE_MS, MAX_ATTEMPTS, dispatchDueReminders, idempotencyKey } from './dispatch';

// Integration tests against a real MongoDB (local by default; set
// MONGODB_TEST_URI to point elsewhere). Skipped when no database is reachable.
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017';
process.env.MONGODB_DB = 'argzel_test_dispatch';
process.env.APP_URL = 'https://argzel.example';

const reachable = await import('../db')
  .then(({ connectDB }) => connectDB())
  .then(() => true)
  .catch(() => false);

const T0 = new Date('2026-10-21T08:00:00Z'); // Wednesday 09:00 in Lagos
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);

/** A fake email provider that records what was sent. */
function fakeProvider(behaviour: (message: EmailMessage, call: number) => SendResult = () => ({ ok: true, id: 'em_1' })) {
  const sent: EmailMessage[] = [];
  const send = async (message: EmailMessage) => {
    sent.push(message);
    return behaviour(message, sent.length);
  };
  return { sent, send };
}

let userId: mongoose.Types.ObjectId;
async function reminder(fields: Partial<ReminderAttrs> = {}) {
  return Reminder.create({
    user_id: userId,
    title: 'Renew my hosting',
    notes: 'Annual plan',
    timezone: 'Africa/Lagos',
    scheduled_at: minutes(-1),
    ...fields,
  });
}
const reload = async (id: mongoose.Types.ObjectId) => (await Reminder.findById(id).lean())!;
const logsFor = (id: mongoose.Types.ObjectId) => NotificationLog.find({ reminder_id: id }).sort({ attempted_at: 1 }).lean();

describe.skipIf(!reachable)('dispatchDueReminders', () => {
  beforeEach(async () => {
    await Promise.all([Reminder.deleteMany({}), User.deleteMany({}), NotificationLog.deleteMany({})]);
    userId = (await User.create({ name: 'Ada Obi', email: 'ada@example.com', password_hash: 'x', timezone: 'Africa/Lagos' }))._id;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('sends a due one-off reminder once, marks it delivered and logs it', async () => {
    const r = await reminder();
    const provider = fakeProvider();
    expect(await dispatchDueReminders({ now: () => T0, send: provider.send })).toMatchObject({ claimed: 1, sent: 1 });

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toMatchObject({
      to: 'ada@example.com',
      subject: 'Reminder: Renew my hosting',
      idempotencyKey: idempotencyKey(r.id, r.scheduled_at),
    });
    expect(provider.sent[0].text).toContain('Wednesday 21 October at 8:59 AM (Africa/Lagos)');
    expect(provider.sent[0].text).toContain('https://argzel.example');
    expect(await reload(r._id)).toMatchObject({ status: 'delivered', locked_until: null, delivery_attempts: 0, last_delivered_at: T0 });
    expect(await logsFor(r._id)).toMatchObject([{ status: 'sent', channel: 'email', provider_response: 'id: em_1' }]);

    // Running again sends nothing.
    expect(await dispatchDueReminders({ now: () => minutes(5), send: provider.send })).toMatchObject({ claimed: 0 });
    expect(provider.sent).toHaveLength(1);
  });

  it('ignores reminders that are not due or not scheduled', async () => {
    await reminder({ scheduled_at: minutes(1) });
    await reminder({ status: 'completed' });
    await reminder({ status: 'cancelled' });
    await reminder({ status: 'delivered' });
    const provider = fakeProvider();
    expect(await dispatchDueReminders({ now: () => T0, send: provider.send })).toMatchObject({ claimed: 0 });
    expect(provider.sent).toHaveLength(0);
  });

  it('never double-sends when runs overlap', async () => {
    const ids = await Promise.all(Array.from({ length: 12 }, (_, i) => reminder({ title: `Task ${i}` })));
    const provider = fakeProvider();
    const runs = await Promise.all([1, 2, 3].map(() => dispatchDueReminders({ now: () => T0, send: provider.send })));

    expect(runs.reduce((n, run) => n + run.sent, 0)).toBe(12);
    expect(new Set(provider.sent.map((m) => m.idempotencyKey)).size).toBe(12);
    expect(provider.sent).toHaveLength(12);
    expect(await Reminder.countDocuments({ _id: { $in: ids.map((r) => r._id) }, status: 'delivered' })).toBe(12);
  });

  it('moves a repeating reminder to its next occurrence at the same local time', async () => {
    const r = await reminder({ recurrence: 'weekly', scheduled_at: new Date('2026-10-21T06:00:00Z') }); // Wed 7 AM
    const provider = fakeProvider();
    await dispatchDueReminders({ now: () => T0, send: provider.send });
    expect(await reload(r._id)).toMatchObject({
      status: 'scheduled',
      scheduled_at: new Date('2026-10-28T06:00:00Z'),
      last_delivered_at: T0,
      delivery_attempts: 0,
    });
  });

  it('sends one email, not a backlog, after missed occurrences', async () => {
    const r = await reminder({ recurrence: 'daily', scheduled_at: new Date('2026-10-17T07:00:00Z') }); // 4 days overdue
    const provider = fakeProvider();
    await dispatchDueReminders({ now: () => T0, send: provider.send });
    expect(provider.sent).toHaveLength(1);
    expect((await reload(r._id)).scheduled_at).toEqual(new Date('2026-10-22T07:00:00Z'));
  });

  it('keeps the wall-clock time across a daylight saving change', async () => {
    // Sunday 1 November 2026 09:00 New York: EDT -> EST in between.
    const r = await reminder({ recurrence: 'weekly', timezone: 'America/New_York', scheduled_at: new Date('2026-10-25T13:00:00Z') });
    await dispatchDueReminders({ now: () => new Date('2026-10-25T13:00:30Z'), send: fakeProvider().send });
    expect((await reload(r._id)).scheduled_at).toEqual(new Date('2026-11-01T14:00:00Z'));
  });

  it('retries a failed send with backoff, logging each failure', async () => {
    const r = await reminder();
    const provider = fakeProvider((_, call) => (call === 1 ? { ok: false, error: 'HTTP 503: busy', permanent: false } : { ok: true, id: 'em_2' }));

    expect(await dispatchDueReminders({ now: () => T0, send: provider.send })).toMatchObject({ retrying: 1 });
    expect(await reload(r._id)).toMatchObject({ status: 'scheduled', delivery_attempts: 1, locked_until: minutes(1) });

    // Within the backoff window nothing is retried.
    expect(await dispatchDueReminders({ now: () => minutes(0.5), send: provider.send })).toMatchObject({ claimed: 0 });

    expect(await dispatchDueReminders({ now: () => minutes(1), send: provider.send })).toMatchObject({ sent: 1 });
    expect(await reload(r._id)).toMatchObject({ status: 'delivered', delivery_attempts: 0 });
    expect((await logsFor(r._id)).map((l) => [l.status, l.provider_response])).toEqual([
      ['failed', 'HTTP 503: busy'],
      ['sent', 'id: em_2'],
    ]);
    // Both attempts used the same idempotency key.
    expect(provider.sent[0].idempotencyKey).toBe(provider.sent[1].idempotencyKey);
  });

  it(`marks a one-off reminder failed after ${MAX_ATTEMPTS} attempts`, async () => {
    const r = await reminder();
    const provider = fakeProvider(() => ({ ok: false, error: 'HTTP 500: down', permanent: false }));
    for (const at of [0, 1, 6, 21]) await dispatchDueReminders({ now: () => minutes(at), send: provider.send });

    expect(provider.sent).toHaveLength(MAX_ATTEMPTS);
    expect(await reload(r._id)).toMatchObject({ status: 'failed', locked_until: null });
    expect(await logsFor(r._id)).toHaveLength(MAX_ATTEMPTS);
    expect(await dispatchDueReminders({ now: () => minutes(60), send: provider.send })).toMatchObject({ claimed: 0 });
  });

  it('gives up immediately on a permanent error; a repeating reminder still fires next time', async () => {
    const once = await reminder();
    const weekly = await reminder({ recurrence: 'weekly', scheduled_at: new Date('2026-10-21T06:00:00Z') });
    const provider = fakeProvider(() => ({ ok: false, error: 'HTTP 403: domain not verified', permanent: true }));
    expect(await dispatchDueReminders({ now: () => T0, send: provider.send })).toMatchObject({ failed: 2 });

    expect(await reload(once._id)).toMatchObject({ status: 'failed' });
    expect(await reload(weekly._id)).toMatchObject({ status: 'scheduled', scheduled_at: new Date('2026-10-28T06:00:00Z') });
  });

  it('reclaims a reminder whose worker crashed mid-send once the lease expires', async () => {
    const r = await reminder({ locked_until: minutes(1), delivery_attempts: 1 }); // claimed, never finished
    const provider = fakeProvider();
    expect(await dispatchDueReminders({ now: () => T0, send: provider.send })).toMatchObject({ claimed: 0 });
    expect(await dispatchDueReminders({ now: () => minutes(1), send: provider.send })).toMatchObject({ sent: 1 });
    expect(await reload(r._id)).toMatchObject({ status: 'delivered' });
  });

  it('lets a user edit made during the send win', async () => {
    const r = await reminder();
    const send = async (): Promise<SendResult> => {
      // What PATCH /api/reminders/:id does when the user reschedules while the email is in flight.
      await Reminder.updateOne({ _id: r._id }, { $set: { scheduled_at: minutes(60), locked_until: null, delivery_attempts: 0 } });
      return { ok: true, id: 'em_3' };
    };
    expect(await dispatchDueReminders({ now: () => T0, send })).toMatchObject({ superseded: 1 });
    expect(await reload(r._id)).toMatchObject({ status: 'scheduled', scheduled_at: minutes(60) });
  });

  it('fails a reminder whose account no longer exists without emailing', async () => {
    const r = await reminder();
    await User.deleteMany({});
    const provider = fakeProvider();
    await dispatchDueReminders({ now: () => T0, send: provider.send });
    expect(provider.sent).toHaveLength(0);
    expect(await reload(r._id)).toMatchObject({ status: 'failed' });
    expect(await logsFor(r._id)).toMatchObject([{ status: 'failed', provider_response: 'Account no longer exists' }]);
  });

  it('lets a stalled worker be overtaken once its lease expires', async () => {
    const r = await reminder();
    // Worker A claims, then stalls past its lease; worker B reclaims and sends.
    let resumeA!: () => void;
    const stalled = new Promise<void>((resolve) => (resumeA = resolve));
    const runA = dispatchDueReminders({ now: () => T0, send: async () => (await stalled, { ok: true, id: 'em_a' }) });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const runB = await dispatchDueReminders({ now: () => new Date(T0.getTime() + LEASE_MS), send: async () => ({ ok: true, id: 'em_b' }) });
    resumeA();

    expect(runB).toMatchObject({ sent: 1 });
    expect(await runA).toMatchObject({ superseded: 1 }); // A's late write is rejected
    expect(await reload(r._id)).toMatchObject({ status: 'delivered' });
  });
});
