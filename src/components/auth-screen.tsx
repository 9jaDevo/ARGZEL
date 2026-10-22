"use client";
import { useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { Brand, Button, Input } from "./ui";
import { appApi, ClientError } from "@/lib/app-api";
import type { ApiUser } from "@/types/api";

export function AuthScreen({
  screen,
  title,
  onNavigate,
  onNotice,
  onAuthenticated,
  onDemo,
}: {
  screen: "signin" | "signup";
  title: (text: string) => ReactNode;
  onNavigate: (screen: "signin" | "signup" | "home") => void;
  onNotice: (message: string) => void;
  onAuthenticated: (user: ApiUser) => Promise<void>;
  onDemo: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const signingIn = screen === "signin";
  return (
    <div className="flow-container auth">
      <span className="auth-symbol">
        <Brand compact />
      </span>
      <span className="eyebrow">YOUR THOUGHTS, IN GOOD HANDS</span>
      {title(signingIn ? "Welcome back." : "Make room for more.")}
      <p className="lead">
        {signingIn
          ? "A clear mind is just a little closer."
          : "Your everyday, a little more effortless."}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (lock.current) return;
          const fields = new FormData(e.currentTarget);
          lock.current = true;
          setBusy(true);
          setError("");
          try {
            const email = String(fields.get("email") ?? "").trim();
            const password = String(fields.get("password") ?? "");
            const input = signingIn
              ? { email, password }
              : {
                  email,
                  password,
                  name: String(fields.get("name") ?? "").trim(),
                  timezone:
                    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
                };
            const { user } = await appApi.auth(screen, input);
            await onAuthenticated(user);
          } catch (cause) {
            setError(
              cause instanceof ClientError
                ? cause.message
                : "Couldn’t connect. Please try again.",
            );
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        {error && (
          <p className="voice-alert" role="alert">
            {error}
          </p>
        )}
        <fieldset disabled={busy} className="auth-fields">
          {!signingIn && (
            <Input
              label="Your name"
              name="name"
              placeholder="Alex Okafor"
              maxLength={80}
              autoComplete="name"
              required
            />
          )}
          <Input
            label="Email address"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
          <div className="password-field">
            <Input
              label="Password"
              name="password"
              id="auth-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              minLength={signingIn ? 1 : 8}
              maxLength={128}
              autoComplete={signingIn ? "current-password" : "new-password"}
              required
              hint={signingIn ? undefined : "Use at least 8 characters."}
            />
            <button
              className="password-reveal icon-button"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              aria-controls="auth-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          </div>
          {signingIn && (
            <button
              type="button"
              className="text-button forgot"
              onClick={() =>
                onNotice(
                  "Password recovery is not available yet. Your password has not been changed.",
                )
              }
            >
              Forgot password?
            </button>
          )}
          <Button type="submit" className="full">
            {busy ? "Connecting…" : signingIn ? "Sign in" : "Create account"}
            <ArrowRight size={17} aria-hidden="true" />
          </Button>
        </fieldset>
      </form>
      <p className="auth-switch">
        {signingIn ? "New here?" : "Already have an account?"}{" "}
        <button
          disabled={busy}
          onClick={() => onNavigate(signingIn ? "signup" : "signin")}
        >
          {signingIn ? "Create an account" : "Sign in"}
        </button>
      </p>
      <div className="divider">
        <span />
        or take a look around
        <span />
      </div>
      <Button
        variant="secondary"
        className="full"
        disabled={busy}
        onClick={onDemo}
      >
        Explore the demo <ArrowUpRight size={16} aria-hidden="true" />
      </Button>
      <p className="fine-print auth-assurance">
        <ShieldCheck size={15} aria-hidden="true" />
        Secure sign-in. Demo access stays separate.
      </p>
    </div>
  );
}
