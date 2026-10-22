import type { Recurrence } from '../models/Reminder';
import { utcToZoned } from '../time';
import { longDate, timeLabel, weekdayName } from '../voice/preview';

// Reminder email (spec §11): title, scheduled date and time, optional notes,
// and a link back to the app. Plain inline styles for email-client support.

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function repeatsLine(recurrence: Recurrence, date: string) {
  if (recurrence === 'daily') return 'Repeats every day';
  if (recurrence === 'weekly') return `Repeats every ${weekdayName(date)}`;
  if (recurrence === 'monthly') return 'Repeats every month';
  return null;
}

export function reminderEmail(input: {
  name: string;
  title: string;
  notes: string;
  scheduledAt: Date;
  timezone: string;
  recurrence: Recurrence;
  appUrl: string;
}) {
  const { date, time } = utcToZoned(input.scheduledAt, input.timezone);
  const when = `${longDate(date, date)} at ${timeLabel(time)}`;
  const repeats = repeatsLine(input.recurrence, date);
  const firstName = input.name.trim().split(/\s+/)[0] || 'there';

  const subject = `Reminder: ${input.title}`;
  const text = [
    `Hi ${firstName},`,
    '',
    `Here's your reminder: ${input.title}`,
    `${when} (${input.timezone})`,
    ...(repeats ? [repeats] : []),
    ...(input.notes ? ['', input.notes] : []),
    '',
    `Open ARGZEL: ${input.appUrl}`,
    '',
    "You're receiving this because you set this reminder in ARGZEL.",
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px 12px;background:#f4f5f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#20232b">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:20px;padding:32px 28px">
      <tr><td style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#4165ed;font-weight:600">ARGZEL reminder</td></tr>
      <tr><td style="padding-top:12px;font-size:15px;color:#5b6070">Hi ${escapeHtml(firstName)},</td></tr>
      <tr><td style="padding-top:8px;font-size:24px;line-height:1.3;font-weight:700">${escapeHtml(input.title)}</td></tr>
      <tr><td style="padding-top:12px;font-size:15px;line-height:1.5">${escapeHtml(when)}<br><span style="color:#8a8f9c;font-size:13px">${escapeHtml(input.timezone)}${repeats ? ` · ${escapeHtml(repeats)}` : ''}</span></td></tr>
      ${input.notes ? `<tr><td style="padding-top:16px"><div style="background:#f4f5f8;border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.5;white-space:pre-wrap">${escapeHtml(input.notes)}</div></td></tr>` : ''}
      <tr><td style="padding-top:24px"><a href="${escapeHtml(input.appUrl)}" style="display:inline-block;background:#20232b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:999px">Open ARGZEL</a></td></tr>
      <tr><td style="padding-top:24px;font-size:12px;color:#8a8f9c">You're receiving this because you set this reminder in ARGZEL.</td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject, text, html };
}
