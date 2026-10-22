"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CalendarDays,
  Clock3,
  Repeat2,
  Mail,
  Mic,
  MicOff,
  Square,
  X,
  ShieldCheck,
  RotateCcw,
  Pencil,
  Volume2,
  Plus,
  CircleHelp,
  LoaderCircle,
  StopCircle,
} from "lucide-react";
import { Brand, Button, Card, Wave } from "./ui";
import { displayDate, displayTime } from "@/lib/demo";
import {
  voiceSamples,
  type VoiceDraft,
  type VoiceSample,
} from "@/lib/voice-service";
import type { ApiReminder, ParseResult } from "@/types/api";

export function VoiceHeading({ children }: { children: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [children]);
  return (
    <h1 ref={heading} tabIndex={-1}>
      {children}
    </h1>
  );
}
export function VoiceFrame({
  step,
  eyebrow,
  title,
  description,
  onCancel,
  busy = false,
  children,
}: {
  step: 1 | 2 | 3;
  eyebrow: string;
  title: string;
  description: string;
  onCancel: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="voice-flow">
      <div className="voice-flow-top">
        <div className="voice-steps" aria-label={`Step ${step} of 3`}>
          {["Speak", "Review", "Remember"].map((label, i) => (
            <span
              key={label}
              aria-current={step === i + 1 ? "step" : undefined}
              className={step >= i + 1 ? "reached" : ""}
            >
              <b>{step > i + 1 ? <Check size={11} /> : i + 1}</b>
              {label}
            </span>
          ))}
        </div>
        <button
          className="icon-button"
          aria-label="Close reminder creation"
          disabled={busy}
          onClick={onCancel}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <header className="voice-heading">
        <span className="eyebrow">{eyebrow}</span>
        <VoiceHeading>{title}</VoiceHeading>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}
export function ListeningScreen({
  elapsed,
  paused,
  onPause,
  sample,
  onSample,
  onFinish,
  onCancel,
}: {
  elapsed: number;
  paused: boolean;
  onPause: () => void;
  sample: VoiceSample;
  onSample: (sample: VoiceSample) => void;
  onFinish: () => void;
  onCancel: () => void;
}) {
  return (
    <VoiceFrame
      step={1}
      eyebrow="A LITTLE THOUGHT, CAPTURED"
      title={paused ? "Take your time." : "What’s on your mind?"}
      description="Big plans or little things. Say it naturally."
      onCancel={onCancel}
    >
      <div className={`listening-visual ${paused ? "is-paused" : ""}`}>
        <span className="listening-ring ring-outer" />
        <span className="listening-ring ring-inner" />
        <button
          className="listening-mic"
          aria-label={
            paused ? "Resume listening preview" : "Pause listening preview"
          }
          aria-pressed={paused}
          onClick={onPause}
        >
          {paused ? (
            <MicOff size={49} strokeWidth={1.3} />
          ) : (
            <Mic size={49} strokeWidth={1.3} />
          )}
        </button>
        <span className="listening-glint" />
      </div>
      <div className="listening-meta">
        <span className={`listening-badge ${paused ? "paused" : ""}`}>
          <i />
          {paused ? "Paused" : "Listening preview"}
        </span>
        <span
          className="recording-clock"
          role="timer"
          aria-label="Preview elapsed time"
        >
          {Math.floor(elapsed / 60)
            .toString()
            .padStart(2, "0")}
          :{(elapsed % 60).toString().padStart(2, "0")}
        </span>
      </div>
      <Wave active={!paused} />
      <div className="voice-phrase">
        <span className="eyebrow">TRY SAYING</span>
        <blockquote>“{voiceSamples[sample]}”</blockquote>
        <div className="voice-examples" role="group" aria-label="Demo example">
          {(
            [
              ["hosting", "Hosting"],
              ["call", "Call James"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              aria-pressed={sample === id}
              onClick={() => onSample(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="voice-actions">
        <Button className="full voice-stop" onClick={onFinish}>
          <Square size={15} fill="currentColor" aria-hidden="true" />
          Finish speaking
          <ArrowRight size={17} aria-hidden="true" />
        </Button>
        <p className="voice-disclosure">
          <ShieldCheck size={14} aria-hidden="true" />
          Demo preview · Your microphone is off.
        </p>
      </div>
    </VoiceFrame>
  );
}
export function ProcessingScreen({
  stage,
  onCancel,
}: {
  stage: "transcribing" | "parsing";
  onCancel: () => void;
}) {
  return (
    <VoiceFrame
      step={1}
      eyebrow="FROM A THOUGHT TO A PLAN"
      title="A little clarity, coming up."
      description="We’ll have the details ready for your review."
      onCancel={onCancel}
    >
      <div className="voice-processing-mark" aria-hidden="true">
        <span />
        <span />
        <Brand compact />
      </div>
      <div className="voice-progress" aria-busy="true">
        <p role="status">
          {stage === "transcribing"
            ? "Preparing the sample transcript…"
            : "Arranging the sample reminder…"}
        </p>
        <ol>
          {[
            {
              label: "Prepare your words",
              done: stage === "parsing",
              active: stage === "transcribing",
            },
            {
              label: "Arrange the details",
              done: false,
              active: stage === "parsing",
            },
            {
              label: "Your review, your final say",
              done: false,
              active: false,
            },
          ].map((item) => (
            <li
              key={item.label}
              className={item.done ? "done" : item.active ? "current" : ""}
            >
              {item.done ? (
                <Check size={17} aria-hidden="true" />
              ) : item.active ? (
                <LoaderCircle className="spin" size={17} aria-hidden="true" />
              ) : (
                <span className="pending-dot" />
              )}
              <span>{item.label}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="voice-disclosure">
        Demo processing · Nothing is saved at this step.
      </p>
      <Button className="full" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </VoiceFrame>
  );
}
export function repeatLabel(draft: Pick<VoiceDraft, "recurrence" | "date">) {
  if (draft.recurrence === "none") return "Does not repeat";
  if (draft.recurrence === "daily") return "Every day";
  if (draft.recurrence === "weekly" && draft.date)
    return `Every ${new Date(`${draft.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })}`;
  if (draft.recurrence === "monthly" && draft.date)
    return `Monthly · day ${Number(draft.date.slice(8))}`;
  return draft.recurrence === "weekly" ? "Every week" : "Every month";
}
export function VoiceSummary({
  draft,
  saved = false,
}: {
  draft: VoiceDraft;
  saved?: boolean;
}) {
  return (
    <Card className="voice-summary">
      <div className="voice-summary-kicker">
        <span className="eyebrow">
          {saved ? "YOUR REMINDER" : "HERE’S WHAT WILL BE SAVED"}
        </span>
        <span className={saved ? "voice-verified" : "voice-review-tag"}>
          {saved ? <Check size={12} /> : <Pencil size={11} />}{" "}
          {saved ? "Confirmed" : "Your review"}
        </span>
      </div>
      <h2>{draft.title || "Your reminder"}</h2>
      {draft.notes && <p className="voice-summary-notes">{draft.notes}</p>}
      <div className="voice-schedule">
        <div>
          <CalendarDays size={21} aria-hidden="true" />
          <span>
            Date
            <strong>
              {draft.date ? displayDate(draft.date) : "Choose a date"}
            </strong>
          </span>
        </div>
        <div>
          <Clock3 size={21} aria-hidden="true" />
          <span>
            Time
            <strong>
              {draft.time ? displayTime(draft.time) : "Choose a time"}
            </strong>
          </span>
        </div>
      </div>
      <div className="voice-fact">
        <Repeat2 size={17} aria-hidden="true" />
        <span>Repeat</span>
        <strong>{repeatLabel(draft)}</strong>
      </div>
      <div className="voice-fact">
        <Mail size={17} aria-hidden="true" />
        <span>Notify by</span>
        <strong>Email</strong>
      </div>
      <p className="voice-timezone">
        <Clock3 size={13} aria-hidden="true" />
        Times shown in {draft.timezone}
      </p>
    </Card>
  );
}
function ReadBack({ draft, enabled }: { draft: VoiceDraft; enabled: boolean }) {
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );
  const listen = () => {
    if (!enabled) {
      setNotice("Spoken read-back is off in Settings.");
      return;
    }
    if (!("speechSynthesis" in window)) {
      setNotice(
        "Read-back isn’t available in this browser. You can review every detail above.",
      );
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const speech = new SpeechSynthesisUtterance(
      `${draft.title}. ${draft.date ? displayDate(draft.date) : "Date not set"} at ${draft.time ? displayTime(draft.time) : "time not set"}. ${repeatLabel(draft)}. Timezone ${draft.timezone}. Please confirm the details before saving.`,
    );
    speech.lang = "en-GB";
    speech.onend = () => setSpeaking(false);
    speech.onerror = () => {
      setSpeaking(false);
      setNotice(
        "Couldn’t play the read-back. Please review the details visually.",
      );
    };
    window.speechSynthesis.cancel();
    setSpeaking(true);
    window.speechSynthesis.speak(speech);
  };
  return (
    <>
      <button
        className="voice-readback"
        onClick={listen}
        aria-pressed={speaking}
      >
        {speaking ? <StopCircle size={21} /> : <Volume2 size={21} />}
        <span>
          {speaking ? "Stop read-back" : "Hear it back"}
          <small>
            {enabled
              ? "A little peace of mind before you confirm"
              : "Spoken read-back is off"}
          </small>
        </span>
        <span className="readback-play" aria-hidden="true">
          {speaking ? "■" : "▶"}
        </span>
      </button>
      {notice && (
        <p className="voice-inline-status" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
export function PreviewScreen({
  draft,
  result,
  saving,
  error,
  uncertain,
  readback,
  onEdit,
  onRetry,
  onConfirm,
  onCancel,
}: {
  draft: VoiceDraft;
  result: ParseResult | null;
  saving: boolean;
  error: string;
  uncertain: boolean;
  readback: boolean;
  onEdit: () => void;
  onRetry: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const clarify = !!result?.needs_clarification;
  return (
    <VoiceFrame
      step={2}
      eyebrow="YOU HAVE THE FINAL SAY"
      title={
        saving
          ? "Keeping that thought…"
          : clarify
            ? "One little detail."
            : "Sound about right?"
      }
      description={
        clarify
          ? "Let’s make sure this reminder is exactly what you meant."
          : "Check the details. We’ll only save when you confirm."
      }
      onCancel={onCancel}
      busy={saving}
    >
      {error && (
        <p className="voice-alert" role="alert">
          {error}
        </p>
      )}
      {clarify && (
        <div className="voice-clarification" role="status">
          <CircleHelp size={23} aria-hidden="true" />
          <div>
            <strong>{result?.clarification_question}</strong>
            <p>Set the missing details below. We won’t guess.</p>
            <Button variant="secondary" onClick={onEdit}>
              Choose the details
              <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      )}
      <VoiceSummary draft={draft} />
      {!saving && <ReadBack draft={draft} enabled={readback} />}
      <details className="voice-source">
        <summary>Your original words</summary>
        <p>“{draft.source_text}”</p>
      </details>
      <div className="voice-actions">
        <Button
          className="full"
          disabled={saving || clarify || uncertain}
          onClick={onConfirm}
        >
          {saving ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Check size={18} />
          )}{" "}
          {saving ? "Confirming…" : "Confirm reminder"}
        </Button>
        {uncertain ? (
          <Button className="full" variant="secondary" onClick={onCancel}>
            Check my reminders
            <ArrowRight size={16} />
          </Button>
        ) : (
          <div className="voice-button-pair">
            <Button variant="ghost" onClick={onEdit} disabled={saving}>
              <Pencil size={16} />
              Edit details
            </Button>
            <Button variant="ghost" onClick={onRetry} disabled={saving}>
              <RotateCcw size={16} />
              Record again
            </Button>
          </div>
        )}
        <p className="voice-disclosure">
          Demo session only · No email will be sent.
        </p>
      </div>
    </VoiceFrame>
  );
}
export function SuccessScreen({
  saved,
  onHome,
  onAnother,
  onDetails,
}: {
  saved: ApiReminder;
  onHome: () => void;
  onAnother: () => void;
  onDetails: () => void;
}) {
  const draft: VoiceDraft = {
    ...saved,
    source_text: saved.source_text,
    confidence: saved.ai_confidence,
  };
  return (
    <VoiceFrame
      step={3}
      eyebrow="ONE LESS THING TO CARRY"
      title="Consider it remembered."
      description="A little more room for the rest of your day."
      onCancel={onHome}
    >
      <div className="voice-success-seal" aria-hidden="true">
        <span />
        <Check size={43} strokeWidth={1.5} />
      </div>
      <p className="voice-saved-label" role="status">
        <Check size={14} aria-hidden="true" />
        Added to this demo session
      </p>
      <VoiceSummary draft={draft} saved />
      <button className="text-button voice-details-link" onClick={onDetails}>
        View reminder details
        <ArrowRight size={15} />
      </button>
      <div className="voice-actions">
        <Button className="full" onClick={onHome}>
          Back to my day
          <ArrowRight size={17} />
        </Button>
        <Button className="full" variant="ghost" onClick={onAnother}>
          <Plus size={17} />
          Create another reminder
        </Button>
        <p className="voice-disclosure">No email is sent in this preview.</p>
      </div>
    </VoiceFrame>
  );
}
export function VoiceErrorScreen({
  message,
  onRetry,
  onCancel,
}: {
  message: string;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <VoiceFrame
      step={1}
      eyebrow="LET’S GIVE THAT ANOTHER TRY"
      title="A little pause."
      description="Your reminder hasn’t been saved."
      onCancel={onCancel}
    >
      <div className="voice-error-mark">
        <MicOff size={38} strokeWidth={1.4} />
      </div>
      <p className="voice-alert" role="alert">
        {message}
      </p>
      <div className="voice-actions">
        <Button className="full" onClick={onRetry}>
          <RotateCcw size={17} />
          Try again
        </Button>
        <Button className="full" variant="ghost" onClick={onCancel}>
          <ArrowLeft size={16} />
          Back to my day
        </Button>
      </div>
    </VoiceFrame>
  );
}
