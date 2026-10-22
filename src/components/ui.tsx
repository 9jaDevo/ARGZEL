"use client";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { useId } from "react";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M7 31 19 7h5l10 24h-7L20.7 15 13 31H7Z" fill="currentColor" />
        <path d="m15 26 12-6 2 5-12 6Z" fill="currentColor" />
      </svg>
      {!compact && <span>ARGZEL</span>}
    </span>
  );
}
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function Input({
  label,
  hint,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <label className="field" htmlFor={inputId}>
      <span>{label}</span>
      <input
        id={inputId}
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {hint && (
        <small id={`${inputId}-hint`} className="field-hint">
          {hint}
        </small>
      )}
    </label>
  );
}
export function Wave({ active = false }: { active?: boolean }) {
  return (
    <div className={`wave ${active ? "active" : ""}`} aria-hidden="true">
      {Array.from({ length: 35 }, (_, i) => (
        <i
          key={i}
          style={{
            height: `${10 + Math.abs(Math.sin(i * 1.74)) * 42}px`,
            animationDelay: `${i * 35}ms`,
          }}
        />
      ))}
    </div>
  );
}
