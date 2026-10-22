import { describe, expect, it } from "vitest";
import { zonedToUtc } from "@/server/time";
import { demoReminders } from "./demo";

describe("demo sample reminders", () => {
  it("are always upcoming, whatever day the demo runs", () => {
    for (const now of [
      new Date("2026-10-21T08:00:00Z"),
      new Date("2026-12-31T22:30:00Z"),
      new Date("2027-03-15T17:00:00Z"),
    ]) {
      for (const reminder of demoReminders(now)) {
        const at = zonedToUtc(reminder.date, reminder.time, reminder.timezone);
        expect(at.getTime()).toBeGreaterThan(now.getTime());
      }
    }
  });

  it("are listed soonest first", () => {
    const keys = demoReminders(new Date("2026-10-21T08:00:00Z")).map((r) => `${r.date}T${r.time}`);
    expect(keys).toEqual([...keys].sort());
  });

  it("name the hosting date in its spoken source text", () => {
    const hosting = demoReminders(new Date("2026-10-21T08:00:00Z")).find((r) => r.id === "3")!;
    expect(hosting).toMatchObject({ date: "2026-10-24", time: "10:00" });
    expect(hosting.source).toBe(
      "Remind me to renew website hosting on 24 October at 10 AM.",
    );
  });
});
