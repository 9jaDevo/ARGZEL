import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Mic,
  Check,
  ShieldCheck,
  Headphones,
} from "lucide-react";
import { Brand, Button, Card } from "./ui";
import { ReminderRow } from "./reminder-card";
import { EmptyState } from "./empty-state";
import type { Reminder } from "@/lib/demo";
export function Dashboard({
  screen,
  title,
  items,
  filter,
  setFilter,
  onCreate,
  onOpen,
  onViewAll,
  isDemo = true,
  name = "Alex",
  timezone = "Africa/Lagos",
  loading = false,
  error = "",
  onRefresh,
}: {
  screen: "home" | "reminders";
  title: (text: string) => ReactNode;
  items: Reminder[];
  filter: string;
  setFilter: (value: string) => void;
  onCreate: () => void;
  onOpen: (reminder: Reminder) => void;
  onViewAll: () => void;
  isDemo?: boolean;
  name?: string;
  timezone?: string;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
}) {
  const completedCount = items.filter((r) => r.status === "completed").length;
  const visible = items.filter(
    (r) =>
      r.status === (filter === "Upcoming" ? "scheduled" : filter.toLowerCase()),
  );
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date());
  // The demo's sample reminders are dated from today, so the demo shows today too.
  const dayLabel = isDemo ? `${today} · DEMO DAY` : today;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{dayLabel}</span>
          {title(
            screen === "home"
              ? "A little less on your mind."
              : "Everything, in its time.",
          )}
          <p>
            {screen === "home" ? (
              <>Hello, {name.split(" ")[0]}. Make room for what matters.</>
            ) : (
              "Your plans, neatly remembered."
            )}
          </p>
        </div>
        <span className="heading-flower" aria-hidden="true">
          ✳
        </span>
      </div>
      {screen === "home" && (
        <section className="voice-hero">
          <div className="hero-content">
            <span className="hero-kicker">
              <span /> A THOUGHT. A WORD. A REMINDER.
            </span>
            <h2>
              Say it.
              <br />
              <span>Consider it remembered.</span>
            </h2>
            <p>
              Big plans or little things. Just speak your mind,
              <br className="desktop-only" /> and we’ll help you keep it.
            </p>
            <Button onClick={onCreate}>
              <Mic size={18} /> Create a voice reminder{" "}
              <ArrowUpRight size={17} />
            </Button>
            <span className="hero-footnote">
              Speak it. Confirm it. Remember it.
            </span>
          </div>
          <div className="voice-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="mic-orb">
              <Mic size={45} strokeWidth={1.5} />
            </div>
            <div className="floating-label">
              <span className="mini-check">
                <Check size={12} />
              </span>{" "}
              A clearer mind starts here
            </div>
            <span className="art-dot dot-one" />
            <span className="art-dot dot-two" />
          </div>
        </section>
      )}
      <div className="dashboard-grid">
        <section className="reminders-panel">
          <div className="section-heading">
            <h2>
              {filter !== "Upcoming"
                ? filter
                : screen === "home"
                  ? "Coming up"
                  : "My reminders"}{" "}
              <span>{visible.length.toString().padStart(2, "0")}</span>
            </h2>
            <button
              className="text-button"
              onClick={screen === "home" ? onViewAll : onCreate}
            >
              {screen === "home" ? "View all" : "New reminder"}{" "}
              <ArrowRight size={15} />
            </button>
          </div>
          <div className="tabs" role="group" aria-label="Reminder filter">
            {["Upcoming", "Completed", "Delivered", "Cancelled", "Failed"].map(
              (t) => (
                <button
                  key={t}
                  aria-pressed={filter === t}
                  className={filter === t ? "active" : ""}
                  onClick={() => setFilter(t)}
                >
                  {t}
                </button>
              ),
            )}
          </div>
          <Card className="reminder-list">
            {loading && (
              <p className="list-status" role="status">
                Loading your reminders…
              </p>
            )}
            {error && (
              <div className="list-status" role="alert">
                <p>{error}</p>
                <Button variant="secondary" onClick={onRefresh}>
                  Try again
                </Button>
              </div>
            )}
            {visible.length ? (
              visible.map((r, i) => (
                <ReminderRow
                  key={r.id}
                  reminder={r}
                  index={i}
                  onOpen={onOpen}
                />
              ))
            ) : !loading && !error ? (
              <EmptyState
                completed={filter === "Completed"}
                statusLabel={
                  !["Upcoming", "Completed"].includes(filter)
                    ? filter.toLowerCase()
                    : undefined
                }
                hasHistory={completedCount > 0}
                onCreate={onCreate}
              />
            ) : null}
          </Card>
          {!isDemo && (
            <button
              className="text-button"
              disabled={loading}
              onClick={onRefresh}
            >
              Refresh reminders
            </button>
          )}
          {!isDemo && items.length === 200 && (
            <p className="subtle-caption">
              Showing up to 200 reminders. More may be available.
            </p>
          )}
          <div className="subtle-caption">
            <ShieldCheck size={14} /> Always reviewed by you. Only saved when
            you confirm.
          </div>
        </section>
        <aside className="day-panel">
          <div className="section-heading">
            <h2>A moment of clarity</h2>
            <Headphones size={17} />
          </div>
          <Card className="quote-card">
            <span className="quote-mark">“</span>
            <p>
              Your mind is for having ideas,
              <br />
              not holding them.
            </p>
            <span>DAVID ALLEN</span>
            <div className="quote-bottom">
              <span className="little-line" /> A little philosophy for your day
            </div>
          </Card>
          <div className="activity">
            <span className="activity-dot" />
            <div>
              <strong>
                {completedCount
                  ? `${completedCount} reminder${completedCount === 1 ? "" : "s"} completed.`
                  : "Your plans have a home."}
              </strong>
              <p>
                {items.some((r) => r.status === "scheduled")
                  ? "Upcoming reminders are ready for your review."
                  : "A little room for whatever comes next."}
              </p>
            </div>
          </div>
        </aside>
      </div>
      <footer className="page-footer">
        <span>Thoughtfully made for your everyday.</span>
        <Brand compact />
      </footer>
    </>
  );
}
