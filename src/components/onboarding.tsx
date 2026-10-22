"use client";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Mic,
  CalendarDays,
  Mail,
} from "lucide-react";
import { Brand, Button } from "./ui";
const slides = [
  {
    label: "A little less on your mind.",
    copy: "Life moves fast. Say what you need to remember, and make room for what matters.",
  },
  {
    label: "Your words. A clear plan.",
    copy: "Speak. Preview. Confirm. Save. Nothing is remembered until you’ve checked the details and said yes.",
  },
  {
    label: "Be there for what matters.",
    copy: "From the everyday to the important. A timely email, a calmer day.",
  },
];
export function Onboarding({
  slide,
  setSlide,
  finishOnboarding,
  title,
}: {
  slide: number;
  setSlide: (slide: number) => void;
  finishOnboarding: () => void;
  title: (text: string) => ReactNode;
}) {
  return (
    <div className="flow-container onboarding">
      <div className="flow-top">
        <span className="eyebrow">A CALMER EVERYDAY · {slide + 1} / 3</span>
        <button className="text-button" onClick={finishOnboarding}>
          Skip <ArrowRight size={15} />
        </button>
      </div>
      <div className="onboard-art" key={slide} aria-hidden="true">
        <div className="orbit" />
        <div className={`onboard-mark onboard-step-${slide}`}>
          {slide === 0 ? (
            <Brand compact />
          ) : slide === 1 ? (
            <CalendarDays size={44} strokeWidth={1.3} />
          ) : (
            <Mail size={44} strokeWidth={1.3} />
          )}
        </div>
        {slide === 0 && (
          <span className="onboard-voice">
            <Mic size={18} />
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
        )}
        <div className="sample-note">
          <span className="mini-check">
            <Check size={13} />
          </span>
          <div>
            <strong>
              {
                [
                  "Call Mum",
                  "Review. Confirm. Relax.",
                  "A moment that matters",
                ][slide]
              }
            </strong>
            <small>
              {
                ["Tomorrow, 9:00 AM", "Always on your terms", "Right on time"][
                  slide
                ]
              }
            </small>
          </div>
          <span className="note-time">{["09:00", "✓", "17:30"][slide]}</span>
        </div>
      </div>
      <span className="eyebrow">
        {["SPEAK YOUR MIND", "YOU’RE IN CONTROL", "MAKE ROOM FOR LIFE"][slide]}
      </span>
      {title(slides[slide].label)}
      <p className="lead">{slides[slide].copy}</p>
      <span className="sr-only" role="status">
        Step {slide + 1} of 3: {slides[slide].label}
      </span>
      <div className="onboarding-bottom">
        <div className="pagination" aria-label={`Step ${slide + 1} of 3`}>
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to step ${i + 1}`}
              aria-current={i === slide ? "step" : undefined}
              className={i === slide ? "active" : ""}
              onClick={() => setSlide(i)}
            />
          ))}
        </div>
        <Button
          onClick={() => (slide < 2 ? setSlide(slide + 1) : finishOnboarding())}
        >
          {slide === 2 ? "Get started" : "Continue"}
          <ArrowRight size={17} />
        </Button>
      </div>
      {slide > 0 && (
        <Button
          className="onboarding-back"
          variant="ghost"
          onClick={() => setSlide(slide - 1)}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </Button>
      )}
    </div>
  );
}
