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
}) {
  return (
    <div className="flow-container settings">
      <span className="eyebrow">JUST THE WAY YOU LIKE IT</span>
      {title("Your space. Your rhythm.")}
      <p className="lead">A few little things that make it yours.</p>
      <Card className="settings-profile">
        <span className="avatar large" aria-hidden="true">
          AO
        </span>
        <div>
          <h2>Alex Okafor</h2>
          <p>alex@example.com</p>
          <span className="tag">Demo profile</span>
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
            <small>Used for new demo reminders</small>
          </span>
          <select
            aria-label="Timezone"
            value={timezone}
            onChange={(e) => onTimezone(e.target.value)}
          >
            {[
              "Africa/Lagos",
              "America/New_York",
              "Europe/London",
              "Asia/Dubai",
            ].map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </select>
        </label>
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
        Preferences apply to this demo session. Email delivery is not connected.
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
              "This demo keeps reminder changes in memory. Onboarding completion is saved on this device. No microphone audio is collected.",
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
      <Button variant="ghost" className="full" onClick={onLeave}>
        <LogOut size={17} aria-hidden="true" />
        Leave demo
      </Button>
      <p className="fine-print">ARGZEL · Speak it. Confirm it. Remember it.</p>
    </div>
  );
}
