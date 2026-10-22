import { CalendarDays, CheckCheck, Mic } from "lucide-react";
import { Button } from "./ui";

export function EmptyState({
  completed = false,
  hasHistory = false,
  statusLabel,
  onCreate,
}: {
  completed?: boolean;
  hasHistory?: boolean;
  statusLabel?: string;
  onCreate: () => void;
}) {
  const Icon = completed ? CheckCheck : CalendarDays;
  return (
    <div
      className={`empty-state ${completed ? "empty-completed" : "empty-upcoming"}`}
    >
      <span className="empty-state-art" aria-hidden="true">
        <span className="empty-paper empty-paper-back" />
        <span className="empty-paper empty-paper-front">
          <Icon size={25} strokeWidth={1.5} />
          <span className="empty-paper-line" />
          <span className="empty-paper-line short" />
        </span>
        <span className="empty-art-seal">
          <CheckCheck size={15} />
        </span>
      </span>
      <span className="eyebrow">
        {statusLabel
          ? "YOUR REMINDER HISTORY"
          : completed
            ? "A LITTLE PROGRESS, KEPT"
            : hasHistory
              ? "ROOM FOR WHAT’S NEXT"
              : "YOUR FIRST LITTLE PLAN"}
      </span>
      <h3>
        {statusLabel
          ? `No ${statusLabel} reminders yet.`
          : completed
            ? "Good things take a little doing."
            : hasHistory
              ? "A little breathing room."
              : "A clear space. A fresh start."}
      </h3>
      <p>
        {statusLabel
          ? "Updates to your reminders will appear here. Your next little plan can start whenever you’re ready."
          : completed
            ? "Your completed reminders will appear here. For now, make a little plan for what’s next."
            : hasHistory
              ? "Nothing coming up. Enjoy the space, or give your next thought a place to land."
              : "A call to make. An idea to follow up. Say the first thing you’d like to remember."}
      </p>
      <Button variant="secondary" onClick={onCreate}>
        <Mic size={17} aria-hidden="true" />{" "}
        {completed || hasHistory || statusLabel
          ? "Create a reminder"
          : "Speak your first reminder"}
      </Button>
    </div>
  );
}
