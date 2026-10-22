import type { Recurrence, ReminderStatus } from "@/types/api";
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
export const demoReminders: Reminder[] = [
  {
    id: "1",
    title: "Send the design proposal",
    notes: "Final review, then send to the team.",
    date: "2026-10-21",
    time: "14:00",
    recurrence: "none",
    status: "scheduled",
    timezone: "Africa/Lagos",
    source: "Remind me to send the design proposal today at 2 PM.",
  },
  {
    id: "2",
    title: "Take a moment for yourself",
    notes: "A short walk. A deep breath. A fresh start.",
    date: "2026-10-21",
    time: "17:30",
    recurrence: "daily",
    status: "scheduled",
    timezone: "Africa/Lagos",
    source: "Every day at 5:30 PM, remind me to take a moment for myself.",
  },
  {
    id: "3",
    title: "Renew website hosting",
    notes: "Check the annual plan before renewing.",
    date: "2026-10-23",
    time: "10:00",
    recurrence: "none",
    status: "scheduled",
    timezone: "Africa/Lagos",
    source: "Remind me to renew website hosting on October 23 at 10 AM.",
  },
];
export const draftReminder: Reminder = { ...demoReminders[2], id: "draft" };
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
