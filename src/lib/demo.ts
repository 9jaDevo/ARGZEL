import type { Recurrence, ReminderStatus } from "@/types/api";
// Pure Intl/date helpers only (no server I/O or credentials).
import { addDays, utcToZoned } from "@/server/time";
export type Reminder = {
  id: string;
  title: string;
  notes: string;
  date: string;
  time: string;
  recurrence: Recurrence;
  status: ReminderStatus;
  timezone: string;
  source: string;
};
const DEMO_TIMEZONE = "Africa/Lagos";
/** Demo sample reminders, dated from today so they always read as upcoming. */
export function demoReminders(now = new Date()): Reminder[] {
  const today = utcToZoned(now, DEMO_TIMEZONE);
  const day = (offset: number) => addDays(today.date, offset);
  const hosting = day(3);
  const hostingWords = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${hosting}T12:00:00Z`));
  const reminders: Reminder[] = [
    {
      id: "1",
      title: "Send the design proposal",
      notes: "Final review, then send to the team.",
      date: day(1),
      time: "14:00",
      recurrence: "none",
      status: "scheduled",
      timezone: DEMO_TIMEZONE,
      source: "Remind me to send the design proposal tomorrow at 2 PM.",
    },
    {
      id: "2",
      title: "Take a moment for yourself",
      notes: "A short walk. A deep breath. A fresh start.",
      // A daily reminder's next occurrence: today if 5:30 PM is still ahead.
      date: today.time < "17:30" ? today.date : day(1),
      time: "17:30",
      recurrence: "daily",
      status: "scheduled",
      timezone: DEMO_TIMEZONE,
      source: "Every day at 5:30 PM, remind me to take a moment for myself.",
    },
    {
      id: "3",
      title: "Renew website hosting",
      notes: "Check the annual plan before renewing.",
      date: hosting,
      time: "10:00",
      recurrence: "none",
      status: "scheduled",
      timezone: DEMO_TIMEZONE,
      source: `Remind me to renew website hosting on ${hostingWords} at 10 AM.`,
    },
  ];
  // Soonest first, like the real reminders list.
  return reminders.sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
  );
}
export function displayDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
export function displayTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
