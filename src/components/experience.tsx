"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
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
import {
  apiVoiceService,
  mockVoiceService,
  type VoiceDraft,
} from "@/lib/voice-service";
import { appApi, ClientError, initials, toReminder } from "@/lib/app-api";
import type { ApiReminder, ApiUser, Recurrence } from "@/types/api";
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
  const [items, setItems] = useState<Reminder[]>([]);
  const [selected, setSelected] = useState<Reminder>(demoReminders[0]);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isDemo, setDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [working, setWorking] = useState(false);
  const mutation = useRef(false);
  const epoch = useRef(0);
  const listRequest = useRef<AbortController | null>(null);
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
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!deleting) return;
    const trigger = deleteTrigger.current;
    return () => {
      if (trigger?.isConnected) trigger.focus();
    };
  }, [deleting]);
  const go = (s: Screen) => {
    setScreen(s);
    setNotice("");

    setDeleting(false);
  };
  const loadReminders = useCallback(async () => {
    const current = epoch.current;
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    setLoading(true);
    setListError("");
    try {
      const { reminders } = await appApi.reminders(controller.signal);
      if (!controller.signal.aborted && current === epoch.current)
        setItems(reminders.map(toReminder));
    } catch (cause) {
      if (controller.signal.aborted || current !== epoch.current) return;
      if (cause instanceof ClientError && cause.status === 401) {
        epoch.current++;
        setItems([]);
        setUser(null);
        setSelected(demoReminders[0]);
        setScreen("signin");
        setNotice("Your session ended. Please sign in again.");
      } else
        setListError(
          "Couldn’t load your reminders. Your existing reminders have not been changed.",
        );
    } finally {
      if (current === epoch.current && !controller.signal.aborted)
        setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let seen = false;
    try {
      seen = localStorage.getItem("argzel-onboarded") === "yes";
    } catch {}
    void appApi
      .me(controller.signal)
      .then(({ user: profile }) => {
        if (controller.signal.aborted) return;
        setUser(profile);
        setTimezone(profile.timezone);
        setScreen(profile.onboarding_completed ? "home" : "onboarding");
        void loadReminders();
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setScreen(seen ? "signin" : "onboarding");
        if (!(cause instanceof ClientError && cause.status === 401))
          setNotice(
            "Couldn’t restore your session. You can sign in again or explore the demo.",
          );
      });
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        try {
          setReadback(localStorage.getItem("argzel-readback") !== "off");
        } catch {}
      }
    });
    return () => {
      controller.abort();
      listRequest.current?.abort();
    };
  }, [loadReminders]);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    window.speechSynthesis?.cancel();
  }, [screen, slide]);
  const finishOnboarding = async () => {
    try {
      localStorage.setItem("argzel-onboarded", "yes");
    } catch {}
    if (user && !isDemo) {
      try {
        const result = await appApi.profile({ onboarding_completed: true });
        setUser(result.user);
        go("home");
      } catch {
        setNotice("Couldn’t save your welcome progress. Please try again.");
      }
    } else go(isDemo ? "home" : "signin");
  };
  const authenticated = async (profile: ApiUser) => {
    epoch.current++;
    listRequest.current?.abort();
    setDemo(false);
    setItems([]);
    setSelected(demoReminders[0]);
    setUser(profile);
    setTimezone(profile.timezone);
    setFilter("Upcoming");
    let seen = false;
    try {
      seen = localStorage.getItem("argzel-onboarded") === "yes";
    } catch {}
    if (seen && !profile.onboarding_completed) {
      try {
        const result = await appApi.profile({ onboarding_completed: true });
        setUser(result.user);
      } catch {
        setSlide(0);
        go("onboarding");
        return;
      }
    }
    go(seen || profile.onboarding_completed ? "home" : "onboarding");
    void loadReminders();
  };
  const enterDemo = () => {
    epoch.current++;
    listRequest.current?.abort();
    setUser(null);
    setDemo(true);
    setItems(demoReminders);
    setSelected(demoReminders[0]);
    setTimezone("Africa/Lagos");
    setEmailEnabled(true);
    setFilter("Upcoming");
    setLoading(false);
    setListError("");
    go("home");
  };
  const leave = async () => {
    if (mutation.current) return;
    mutation.current = true;
    setWorking(true);
    try {
      if (!isDemo) await appApi.logout();
      epoch.current++;
      listRequest.current?.abort();
      setUser(null);
      setDemo(false);
      setItems([]);
      setSelected(demoReminders[0]);
      setVoiceRequest(null);
      setLoading(false);
      setListError("");
      go("signin");
    } catch {
      setNotice(
        "Couldn’t sign out. Please try again; your session may still be active.",
      );
    } finally {
      mutation.current = false;
      setWorking(false);
    }
  };
  const changeTimezone = async (value: string) => {
    if (isDemo) {
      setTimezone(value);
      return;
    }
    if (mutation.current) return;
    mutation.current = true;
    const current = epoch.current;
    setWorking(true);
    try {
      const result = await appApi.profile({ timezone: value });
      if (current !== epoch.current) return;
      setUser(result.user);
      setTimezone(result.user.timezone);
    } catch {
      setNotice(
        "Couldn’t save the timezone. Your previous timezone is still selected.",
      );
    } finally {
      mutation.current = false;
      setWorking(false);
    }
  };
  const changeReadback = (value: boolean) => {
    setReadback(value);
    try {
      localStorage.setItem("argzel-readback", value ? "on" : "off");
    } catch {}
  };
  const startRecording = () => {
    setVoiceRequest({ timezone });
    go("voice");
  };
  const saveToList = (record: ApiReminder) => {
    const reminder = toReminder(record);
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
  const mutateReminder = async (action: "delete" | "status") => {
    const current = epoch.current;
    if (mutation.current) return;
    mutation.current = true;
    setWorking(true);
    setNotice("");
    try {
      if (action === "delete") {
        if (!isDemo) await appApi.remove(selected.id);
        if (current !== epoch.current) return;
        setItems((previous) =>
          previous.filter((item) => item.id !== selected.id),
        );
        go("reminders");
      } else {
        const status =
          selected.status === "completed" ? "scheduled" : "completed";
        const updated = isDemo
          ? ({ ...selected, status } as Reminder)
          : toReminder((await appApi.update(selected.id, { status })).reminder);
        if (current !== epoch.current) return;
        setItems((previous) =>
          previous.map((item) => (item.id === updated.id ? updated : item)),
        );
        setSelected(updated);
      }
    } catch (cause) {
      setDeleting(false);
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Couldn’t update the reminder. Please refresh before trying again.",
      );
    } finally {
      mutation.current = false;
      setWorking(false);
    }
  };
  const displayName = isDemo ? "Alex Okafor" : (user?.name ?? "Your account");
  const avatar = initials(displayName);
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
      <aside className="sidebar" inert={deleting}>
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
          <span className="avatar">{avatar}</span>
          <span>
            <strong>{displayName}</strong>
            <small>Personal workspace</small>
          </span>
          <MoreHorizontal size={18} />
        </button>
      </aside>
      <div className="main-wrap" inert={deleting}>
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
              <span />{" "}
              {isDemo
                ? "Interactive demo"
                : user
                  ? "Your account"
                  : "Speak. Confirm. Remember."}
            </span>
            <button
              className="icon-button"
              aria-label="Open settings"
              onClick={() => go("settings")}
            >
              <span className="avatar small">{avatar}</span>
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
              isDemo={isDemo}
              name={displayName}
              timezone={timezone}
              loading={loading}
              error={listError}
              onRefresh={() => {
                void loadReminders();
              }}
              filter={filter}
              setFilter={setFilter}
              onCreate={startRecording}
              onOpen={openDetails}
              onViewAll={() => {
                go("reminders");
                if (!isDemo) void loadReminders();
              }}
            />
          )}
          {screen === "splash" && (
            <div className="center-screen splash">
              <Brand />
              {title("A little less on your mind.")}
              <p>Speak it. Confirm it. Remember it.</p>
              <div className="loading-line" />
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
              onAuthenticated={authenticated}
              onDemo={enterDemo}
              onNotice={setNotice}
            />
          )}
          {screen === "voice" && voiceRequest && (
            <VoiceFlow
              timezone={voiceRequest.timezone}
              initial={voiceRequest.initial}
              readback={readback}
              service={isDemo ? mockVoiceService : apiVoiceService}
              onSaved={saveToList}
              onCancel={() => {
                go("home");
                if (!isDemo) void loadReminders();
              }}
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
                  disabled={working}
                  onClick={() => {
                    void mutateReminder("status");
                  }}
                >
                  <CheckCheck size={16} />
                  {selected.status === "completed" ? "Reopen" : "Complete"}
                </Button>
              </div>
              <Button
                variant="ghost"
                className="danger full"
                disabled={working}
                ref={deleteTrigger}
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
              onTimezone={(value) => {
                void changeTimezone(value);
              }}
              isDemo={isDemo}
              user={user}
              busy={working}
              emailEnabled={emailEnabled}
              onEmail={setEmailEnabled}
              readback={readback}
              onReadback={changeReadback}
              onReplay={() => {
                setSlide(0);
                go("onboarding");
              }}
              onLeave={() => {
                void leave();
              }}
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
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!working) setDeleting(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="delete-modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !working) setDeleting(false);
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
            <p>
              “{selected.title}” will be{" "}
              {isDemo
                ? "removed from this demo session"
                : "permanently deleted from your account"}
              .
            </p>
            <Button
              autoFocus
              disabled={working}
              variant="secondary"
              className="full"
              onClick={() => {
                if (!working) setDeleting(false);
              }}
            >
              Keep reminder
            </Button>
            <Button
              className="full danger-solid"
              disabled={working}
              onClick={() => {
                void mutateReminder("delete");
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
