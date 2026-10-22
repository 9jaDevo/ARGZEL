"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button, Input } from "./ui";
import { draftError, type VoiceDraft } from "@/lib/voice-service";
import type { Recurrence } from "@/types/api";
import { timezones } from "@/lib/timezones";

export function ReminderEditor({
  draft,
  onReview,
  onCancel,
}: {
  draft: VoiceDraft;
  onReview: (draft: VoiceDraft) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(draft);
  const [error, setError] = useState("");
  return (
    <form
      className="voice-editor"
      onSubmit={(e) => {
        e.preventDefault();
        const fields = new FormData(e.currentTarget);
        const reviewed = {
          ...value,
          title: String(fields.get("title") ?? "").trim(),
          notes: String(fields.get("notes") ?? "").trim(),
          date: String(fields.get("date") ?? ""),
          time: String(fields.get("time") ?? ""),
          recurrence: String(fields.get("recurrence") ?? "none") as Recurrence,
          timezone: String(fields.get("timezone") ?? ""),
        };
        const unchanged =
          !!draft.id &&
          reviewed.date === draft.date &&
          reviewed.time === draft.time &&
          reviewed.timezone === draft.timezone;
        const issue = draftError(reviewed, Date.now(), unchanged);
        if (issue) {
          setError(issue);
          return;
        }
        onReview(reviewed);
      }}
    >
      <p className="voice-editor-note">
        Make any changes, then review before confirming.
      </p>
      {error && (
        <p className="voice-alert" role="alert">
          {error}
        </p>
      )}
      <Input
        label="Task"
        name="title"
        required
        maxLength={200}
        value={value.title}
        onChange={(e) => setValue({ ...value, title: e.target.value })}
      />
      <Input
        label="Notes (optional)"
        name="notes"
        maxLength={1000}
        value={value.notes}
        onChange={(e) => setValue({ ...value, notes: e.target.value })}
      />
      <div className="form-row">
        <Input
          label="Date"
          name="date"
          type="date"
          required
          value={value.date}
          onChange={(e) => setValue({ ...value, date: e.target.value })}
        />
        <Input
          label="Time"
          name="time"
          type="time"
          required
          value={value.time}
          onChange={(e) => setValue({ ...value, time: e.target.value })}
        />
      </div>
      <label className="field">
        <span>Repeat</span>
        <select
          name="recurrence"
          value={value.recurrence}
          onChange={(e) =>
            setValue({ ...value, recurrence: e.target.value as Recurrence })
          }
        >
          <option value="none">Does not repeat</option>
          <option value="daily">Every day</option>
          <option value="weekly">Every week</option>
          <option value="monthly">Every month</option>
        </select>
      </label>
      <label className="field">
        <span>Timezone</span>
        <select
          name="timezone"
          value={value.timezone}
          onChange={(e) => setValue({ ...value, timezone: e.target.value })}
        >
          {timezones(draft.timezone).map((zone) => (
            <option key={zone}>{zone}</option>
          ))}
        </select>
      </label>
      <div className="voice-actions">
        <Button type="submit" className="full">
          Review changes <ArrowRight size={17} aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="full"
          onClick={onCancel}
        >
          Discard changes
        </Button>
      </div>
    </form>
  );
}
