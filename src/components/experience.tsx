"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Home,
  CalendarDays,
  Settings,
  ChevronRight,
  X,
  MoreHorizontal,
  Trash2,
  Pencil,
  CheckCheck,
} from "lucide-react";
import { Brand, Button, Wave } from "./ui";
import { ReminderSummary } from "./reminder-card";
import { Onboarding } from "./onboarding";
import { VoiceFlow } from "./voice-flow";
import type { VoiceDraft } from "@/lib/voice-service";
import type { ApiReminder, Recurrence } from "@/types/api";
import { Dashboard } from "./dashboard";
import { AuthScreen } from "./auth-screen";
import { SettingsScreen } from "./settings-screen";
import { MobileNavigation } from "./mobile-navigation";
import { demoReminders, type Reminder } from "@/lib/demo";
type Screen =
  | "home"
  | "splash"
  | "onboarding"
  | "signin"
  | "signup"
  | "voice"
  | "details"
  | "settings"
  | "reminders";
export default function Experience() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [slide, setSlide] = useState(0);
  const [items, setItems] = useState<Reminder[]>(demoReminders);
  const [selected, setSelected] = useState<Reminder>(demoReminders[0]);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState("Upcoming");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [readback, setReadback] = useState(true);
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [notice, setNotice] = useState("");
  const [voiceRequest, setVoiceRequest] = useState<{
    timezone: string;
    initial?: VoiceDraft;
  } | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const go = (s: Screen) => {
    setScreen(s);
    setNotice("");

    setDeleting(false);
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setScreen(
          localStorage.getItem("argzel-onboarded") === "yes"
            ? "home"
            : "onboarding",
        );
      } catch {
        setScreen("onboarding");
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    window.speechSynthesis?.cancel();
  }, [screen, slide]);
  const finishOnboarding = () => {
    try {
      localStorage.setItem("argzel-onboarded", "yes");
    } catch {
      // Storage may be disabled; the walkthrough still completes for this visit.
    }
    go("signin");
  };
  const startRecording = () => {
    setVoiceRequest({ timezone });
    go("voice");
  };
  const saveToDemo = (record: ApiReminder) => {
    const reminder: Reminder = {
      id: record.id,
      title: record.title,
      notes: record.notes,
      date: record.date,
      time: record.time,
      timezone: record.timezone,
      recurrence: record.recurrence,
      status: record.status === "completed" ? "completed" : "scheduled",
      source: record.source_text,
    };
    setItems((previous) =>
      previous.some((item) => item.id === reminder.id)
        ? previous.map((item) => (item.id === reminder.id ? reminder : item))
        : [reminder, ...previous],
    );
    setSelected(reminder);
  };
  const openDetails = (r: Reminder) => {
    setSelected(r);
    go("details");
  };
  const title = (text: string) => (
    <h1 ref={titleRef} tabIndex={-1}>
      {text}
    </h1>
  );
  return (
    <div
      className={`workspace ${["splash", "onboarding", "signin", "signup"].includes(screen) ? "entry-mode" : screen === "voice" ? "voice-mode" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label">YOUR PERSONAL SPACE</div>
        <nav aria-label="Main navigation">
          {(
            [
              { id: "home", label: "Overview", icon: Home },
              { id: "reminders", label: "My reminders", icon: CalendarDays },
              { id: "settings", label: "Settings", icon: Settings },
            ] as const
          ).map((n) => (
            <button
              key={n.id}
              className={screen === n.id ? "selected" : ""}
              aria-current={screen === n.id ? "page" : undefined}
              onClick={() => go(n.id)}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === "reminders" && (
                <span className="nav-count">
                  {items.filter((i) => i.status === "scheduled").length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="tiny-wave">
            <Wave />
          </div>
          <h3>
            Less remembering.
            <br />
            More living.
          </h3>
          <p>Your voice is all it takes.</p>
          <button onClick={startRecording}>
            Create a reminder <ArrowUpRight size={16} />
          </button>
        </div>
        <button className="profile" onClick={() => go("settings")}>
          <span className="avatar">AO</span>
          <span>
            <strong>Alex Okafor</strong>
            <small>Personal workspace</small>
          </span>
          <MoreHorizontal size={18} />
        </button>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <span className="desktop-only breadcrumb">
            Your space <ChevronRight size={13} />{" "}
            {screen === "home"
              ? "Overview"
              : screen.charAt(0).toUpperCase() + screen.slice(1)}
          </span>
          <div className="topbar-right">
            <span className="demo-pill">
              <span /> Interactive demo
            </span>
            <button
              className="icon-button"
              aria-label="Open settings"
              onClick={() => go("settings")}
            >
              <span className="avatar small">AO</span>
            </button>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={`main-content screen-${screen}`}
          key={screen}
        >
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                className="icon-button"
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {(screen === "home" || screen === "reminders") && (
            <Dashboard
              screen={screen}
              title={title}
              items={items}
              filter={filter}
              setFilter={setFilter}
              onCreate={startRecording}
              onOpen={openDetails}
              onViewAll={() => go("reminders")}
            />
          )}
          {screen === "splash" && (
            <div className="center-screen splash">
              <Brand />
              {title("A little less on your mind.")}
              <p>Speak it. Confirm it. Remember it.</p>
              <div className="loading-line" />
              <Button variant="ghost" onClick={() => go("onboarding")}>
                Welcome to your space <ArrowRight size={16} />
              </Button>
            </div>
          )}
          {screen === "onboarding" && (
            <Onboarding
              slide={slide}
              setSlide={setSlide}
              finishOnboarding={finishOnboarding}
              title={title}
            />
          )}
          {(screen === "signin" || screen === "signup") && (
            <AuthScreen
              screen={screen}
              title={title}
              onNavigate={go}
              onNotice={setNotice}
            />
          )}
          {screen === "voice" && voiceRequest && (
            <VoiceFlow
              timezone={voiceRequest.timezone}
              initial={voiceRequest.initial}
              readback={readback}
              onSaved={saveToDemo}
              onCancel={() => go("home")}
              onDetails={() => go("details")}
            />
          )}
          {screen === "details" && (
            <div className="flow-container">
              <button className="back-link" onClick={() => go("reminders")}>
                <ArrowLeft size={17} />
                My reminders
              </button>
              <span className="eyebrow">ALL THE LITTLE DETAILS</span>
              {title("A plan, in place.")}
              <p className="lead">
                Everything you need. Nothing to hold in your head.
              </p>
              <ReminderSummary reminder={selected} />
              <div className="source-text">
                <span className="eyebrow">ORIGINAL WORDS</span>
                <p>“{selected.source}”</p>
              </div>
              <div className="button-row">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setVoiceRequest({
                      timezone: selected.timezone,
                      initial: {
                        id: selected.id,
                        status: selected.status,
                        title: selected.title,
                        notes: selected.notes,
                        date: selected.date,
                        time: selected.time,
                        timezone: selected.timezone,
                        recurrence: selected.recurrence as Recurrence,
                        source_text: selected.source,
                        confidence: null,
                      },
                    });

                    go("voice");
                  }}
                >
                  <Pencil size={16} />
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const updated = {
                      ...selected,
                      status:
                        selected.status === "completed"
                          ? "scheduled"
                          : "completed",
                    } as Reminder;
                    setItems(
                      items.map((r) => (r.id === selected.id ? updated : r)),
                    );
                    setSelected(updated);
                  }}
                >
                  <CheckCheck size={16} />
                  {selected.status === "completed" ? "Reopen" : "Complete"}
                </Button>
              </div>
              <Button
                variant="ghost"
                className="danger full"
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={16} />
                Delete reminder
              </Button>
            </div>
          )}
          {screen === "settings" && (
            <SettingsScreen
              title={title}
              timezone={timezone}
              onTimezone={setTimezone}
              emailEnabled={emailEnabled}
              onEmail={setEmailEnabled}
              readback={readback}
              onReadback={setReadback}
              onReplay={() => {
                setSlide(0);
                go("onboarding");
              }}
              onLeave={() => go("signin")}
              onNotice={setNotice}
            />
          )}
        </main>
        <MobileNavigation
          screen={screen}
          onNavigate={go}
          onCreate={startRecording}
        />
      </div>
      {deleting && (
        <div className="modal-backdrop" onClick={() => setDeleting(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="delete-modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDeleting(false);
              if (e.key === "Tab") {
                const controls =
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <Trash2 size={25} />
            <h2 id="delete-title">Let this one go?</h2>
            <p>“{selected.title}” will be removed from this demo session.</p>
            <Button
              autoFocus
              variant="secondary"
              className="full"
              onClick={() => setDeleting(false)}
            >
              Keep reminder
            </Button>
            <Button
              className="full danger-solid"
              onClick={() => {
                setItems(items.filter((r) => r.id !== selected.id));
                go("reminders");
              }}
            >
              Delete reminder
            </Button>
          </section>
        </div>
      )}
    </div>
  );
}
