import { CalendarDays, CheckCheck, Mic } from "lucide-react";
import { Button } from "./ui";

export function EmptyState({
  completed = false,
  onCreate,
}: {
  completed?: boolean;
  onCreate: () => void;
}) {
  const Icon = completed ? CheckCheck : CalendarDays;
  return (
    <div className="empty-state">
      <span className="empty-state-art" aria-hidden="true">
        <Icon size={30} />
        <i />
        <i />
      </span>
      <h3>
        {completed
          ? "Good things take a little doing."
          : "A clear space. A fresh start."}
      </h3>
      <p>
        {completed
          ? "Your completed reminders will appear here. For now, make a little plan for what’s next."
          : "A call to make. An idea to follow up. Say the first thing you’d like to remember."}
      </p>
      <Button variant="secondary" onClick={onCreate}>
        <Mic size={17} aria-hidden="true" />{" "}
        {completed ? "Create a reminder" : "Speak your first reminder"}
      </Button>
    </div>
  );
}
