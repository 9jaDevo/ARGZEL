"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioCapture } from "@/lib/audio-capture";
export function useAudioCapture() {
  const [state, setState] = useState<
    "ready" | "requesting" | "recording" | "paused" | "stopped"
  >("ready");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const capture = useRef<AudioCapture | null>(null);
  const blob = useRef<Blob | undefined>(undefined);
  const active = useRef(true);
  const ticks = useRef(0);
  const starting = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      capture.current?.cancel();
      blob.current = undefined;
    };
  }, []);
  const finish = useCallback(async () => {
    if (blob.current) return blob.current;
    try {
      const result = await capture.current?.finish();
      if (!active.current) return;
      blob.current = result;
      setState("stopped");
      return result;
    } catch (cause) {
      if (active.current) {
        setError(
          cause instanceof Error ? cause.message : "Couldn’t finish recording.",
        );
        setState("ready");
      }
    }
  }, []);
  useEffect(() => {
    if (state !== "recording") return;
    const timer = setInterval(() => {
      ticks.current++;
      setElapsed(ticks.current);
      if (ticks.current >= 60) {
        clearInterval(timer);
        void finish();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [state, finish]);
  const start = async () => {
    if (starting.current) return;
    starting.current = true;
    setError("");
    setState("requesting");
    blob.current = undefined;
    capture.current?.cancel();
    const recorder = new AudioCapture((message) => {
      if (active.current) {
        setError(message);
        setState("ready");
      }
    });
    capture.current = recorder;
    try {
      await recorder.start();
      if (active.current && capture.current === recorder) {
        ticks.current = 0;
        setElapsed(0);
        setState("recording");
      }
    } catch (cause) {
      if (active.current) {
        setError(
          cause instanceof Error ? cause.message : "Couldn’t start recording.",
        );
        setState("ready");
      }
    } finally {
      starting.current = false;
    }
  };
  const toggle = () => {
    if (state === "recording") {
      capture.current?.pause();
      setState("paused");
    } else if (state === "paused") {
      capture.current?.resume();
      setState("recording");
    } else void start();
  };
  return {
    state,
    error,
    elapsed,
    toggle,
    finish,
    cancel: () => capture.current?.cancel(),
  };
}
