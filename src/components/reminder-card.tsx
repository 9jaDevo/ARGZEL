import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Mail,
  Repeat2,
} from "lucide-react";
import { Card } from "./ui";
import { displayDate, displayTime, type Reminder } from "@/lib/demo";

export function ReminderRow({
  reminder: r,
  index,
  onOpen,
}: {
  reminder: Reminder;
  index: number;
  onOpen: (reminder: Reminder) => void;
}) {
  return (
    <button className="reminder-row" onClick={() => onOpen(r)}>
      <span className={`reminder-icon tone-${index % 3}`}>
        <CalendarDays size={20} />
      </span>
      <span className="reminder-copy">
        <strong>{r.title}</strong>
        {r.status !== "scheduled" && (
          <small className={`reminder-status status-${r.status}`}>
            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
          </small>
        )}
        <span>
          {displayDate(r.date)} <b>·</b> {displayTime(r.time)}
          {r.recurrence !== "none" && <Repeat2 size={12} />}
        </span>
      </span>
      <ChevronRight size={16} className="muted" />
    </button>
  );
}

export function ReminderSummary({ reminder: r }: { reminder: Reminder }) {
  return (
    <Card className="summary-card">
      <div className="summary-heading">
        <span className="eyebrow">YOUR REMINDER</span>
        <span className={`tag status-${r.status}`}>
          <span />
          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
        </span>
      </div>
      <h2>{r.title}</h2>
      {r.notes && <p>{r.notes}</p>}
      <div className="detail-grid">
        <span>
          <CalendarDays size={18} />
          <small>Date</small>
          <strong>{displayDate(r.date)}</strong>
        </span>
        <span>
          <Clock3 size={18} />
          <small>Time</small>
          <strong>{displayTime(r.time)}</strong>
        </span>
      </div>
      <div className="detail-line">
        <Repeat2 size={17} />
        <span>Repeat</span>
        <strong>
          {r.recurrence === "none"
            ? "Does not repeat"
            : r.recurrence === "daily"
              ? "Every day"
              : r.recurrence === "weekly"
                ? "Every week"
                : "Every month"}
        </strong>
      </div>
      <div className="detail-line">
        <Mail size={17} />
        <span>Delivery</span>
        <strong>Email</strong>
      </div>
      <div className="detail-line">
        <Clock3 size={17} />
        <span>Timezone</span>
        <strong>{r.timezone}</strong>
      </div>
    </Card>
  );
}
