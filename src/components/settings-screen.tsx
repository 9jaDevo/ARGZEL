import type { ApiUser } from "@/types/api";
import { initials } from "@/lib/app-api";
import { timezones } from "@/lib/timezones";
import type { ReactNode } from "react";
import {
  Clock3,
  Mail,
  Volume2,
  ChevronRight,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { Brand, Button, Card } from "./ui";

export function PreferenceToggle({
  label,
  description,
  enabled,
  onChange,
  icon,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  icon: ReactNode;
}) {
  return (
    <div className="setting-row">
      <span className="setting-icon" aria-hidden="true">
        {icon}
      </span>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        className={`toggle ${enabled ? "on" : ""}`}
        onClick={() => onChange(!enabled)}
      >
        <span />
      </button>
    </div>
  );
}
export function SettingsScreen({
  title,
  timezone,
  onTimezone,
  emailEnabled,
  onEmail,
  readback,
  onReadback,
  onReplay,
  onLeave,
  onNotice,
  isDemo = true,
  user,
  busy = false,
}: {
  title: (text: string) => ReactNode;
  timezone: string;
  onTimezone: (value: string) => void;
  emailEnabled: boolean;
  onEmail: (value: boolean) => void;
  readback: boolean;
  onReadback: (value: boolean) => void;
  onReplay: () => void;
  onLeave: () => void;
  onNotice: (message: string) => void;
  isDemo?: boolean;
  user?: ApiUser | null;
  busy?: boolean;
}) {
  return (
    <div className="flow-container settings">
      <span className="eyebrow">JUST THE WAY YOU LIKE IT</span>
      {title("Your space. Your rhythm.")}
      <p className="lead">A few little things that make it yours.</p>
      <Card className="settings-profile">
        <span className="avatar large" aria-hidden="true">
          {initials(user?.name ?? "Alex Okafor")}
        </span>
        <div>
          <h2>{user?.name ?? "Alex Okafor"}</h2>
          <p>{user?.email ?? "alex@example.com"}</p>
          <span className="tag">
            {isDemo ? "Demo profile" : "Your account"}
          </span>
        </div>
      </Card>
      <h2 className="eyebrow settings-label">PREFERENCES</h2>
      <Card>
        <label className="setting-row timezone-row">
          <span className="setting-icon" aria-hidden="true">
            <Clock3 size={20} />
          </span>
          <span>
            <strong>Timezone</strong>
            <small>
              {isDemo
                ? "Used for new demo reminders"
                : "Saved to your profile for new reminders"}
            </small>
          </span>
          <select
            disabled={busy}
            aria-label="Timezone"
            value={timezone}
            onChange={(e) => onTimezone(e.target.value)}
          >
            {timezones(timezone).map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </select>
        </label>
        {isDemo ? (
          <PreferenceToggle
            label="Email reminders"
            description={
              emailEnabled
                ? "On · delivery preview only"
                : "Off · delivery preview only"
            }
            enabled={emailEnabled}
            onChange={onEmail}
            icon={<Mail size={20} />}
          />
        ) : (
          <div className="setting-row">
            <Mail size={20} aria-hidden="true" />
            <span>
              <strong>Email reminders</strong>
              <small>
                Each confirmed reminder uses email delivery. Account-wide
                opt-out is not available yet.
              </small>
            </span>
          </div>
        )}
        <PreferenceToggle
          label="Spoken read-back"
          description={
            readback
              ? "On · listen before you confirm"
              : "Off · review your reminder visually"
          }
          enabled={readback}
          onChange={onReadback}
          icon={<Volume2 size={20} />}
        />
      </Card>
      <p className="settings-caption">
        {isDemo
          ? "Preferences apply to this demo session. No email is sent."
          : "Timezone is saved to your account. Spoken read-back is saved on this device."}
      </p>
      <h2 className="eyebrow settings-label">YOUR EXPERIENCE</h2>
      <Card>
        <button className="setting-row" onClick={onReplay}>
          <Brand compact />
          <span>
            <strong>Replay the welcome</strong>
            <small>A quick introduction to ARGZEL</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button
          className="setting-row"
          onClick={() =>
            onNotice(
              isDemo
                ? "Demo changes stay in memory. No microphone audio is collected in demo mode."
                : "Recordings are sent to the transcription provider. ARGZEL does not store raw audio; confirmed reminders retain their original text. You control when recording starts.",
            )
          }
        >
          <ShieldCheck size={20} aria-hidden="true" />
          <span>
            <strong>Privacy, by design</strong>
            <small>Your thoughts deserve their space</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </Card>
      <Button
        disabled={busy}
        variant="ghost"
        className="full"
        onClick={onLeave}
      >
        <LogOut size={17} aria-hidden="true" />
        {isDemo ? "Leave demo" : busy ? "Signing out…" : "Sign out"}
      </Button>
      <p className="fine-print">ARGZEL · Speak it. Confirm it. Remember it.</p>
    </div>
  );
}
