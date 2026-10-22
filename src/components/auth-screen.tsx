"use client";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { Brand, Button, Input } from "./ui";

export function AuthScreen({
  screen,
  title,
  onNavigate,
  onNotice,
}: {
  screen: "signin" | "signup";
  title: (text: string) => ReactNode;
  onNavigate: (screen: "signin" | "signup" | "home") => void;
  onNotice: (message: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
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
        onSubmit={(e) => {
          e.preventDefault();
          onNotice(
            "Authentication is not connected yet. Choose Explore the demo to try ARGZEL.",
          );
        }}
      >
        {!signingIn && (
          <Input
            label="Your name"
            name="name"
            placeholder="Alex Okafor"
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
            minLength={8}
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
                "Password recovery will be available when authentication is connected.",
              )
            }
          >
            Forgot password?
          </button>
        )}
        <Button type="submit" className="full">
          {signingIn ? "Sign in" : "Create account"}
          <ArrowRight size={17} aria-hidden="true" />
        </Button>
      </form>
      <p className="auth-switch">
        {signingIn ? "New here?" : "Already have an account?"}{" "}
        <button onClick={() => onNavigate(signingIn ? "signup" : "signin")}>
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
        onClick={() => onNavigate("home")}
      >
        Explore the demo <ArrowUpRight size={16} aria-hidden="true" />
      </Button>
      <p className="fine-print auth-assurance">
        <ShieldCheck size={15} aria-hidden="true" />
        Preview only. No account is created.
      </p>
    </div>
  );
}
