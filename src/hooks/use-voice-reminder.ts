"use client";
import { useEffect, useRef, useState } from "react";
import type { ApiReminder, ParseResult } from "@/types/api";
import {
  createInput,
  draftError,
  draftFromParse,
  mockVoiceService,
  type VoiceDraft,
  type VoiceSample,
  type VoiceService,
  VoiceServiceError,
} from "@/lib/voice-service";
export type VoiceStage =
  | "recording"
  | "transcribing"
  | "parsing"
  | "preview"
  | "saving"
  | "success"
  | "error";
export function useVoiceReminder({
  timezone,
  initial,
  service = mockVoiceService,
}: {
  timezone: string;
  initial?: VoiceDraft;
  service?: VoiceService;
}) {
  const [stage, setStage] = useState<VoiceStage>(
    initial ? "preview" : "recording",
  );
  const [draft, setDraft] = useState<VoiceDraft | null>(initial ?? null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [sample, setSample] = useState<VoiceSample>("hosting");
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [saved, setSaved] = useState<ApiReminder | null>(null);
  const operation = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const confirmed = useRef(false);
  useEffect(
    () => () => {
      operation.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (stage !== "recording" || paused) return;
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [stage, paused]);
  function stop() {
    operation.current?.abort();
    operation.current = null;
    busy.current = false;
  }
  function retry() {
    stop();
    confirmed.current = false;
    setDraft(null);
    setTranscript("");
    setResult(null);
    setError("");
    setUncertain(false);
    setElapsed(0);
    setPaused(false);
    setStage("recording");
  }
  async function finish(audio?: Blob) {
    if (busy.current || stage !== "recording") return;
    busy.current = true;
    const controller = new AbortController();
    operation.current = controller;
    setError("");
    setStage("transcribing");
    try {
      const text = await service.transcribe(
        { audio, sample },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setTranscript(text);
      setStage("parsing");
      const parsed = await service.parse({ text, timezone }, controller.signal);
      if (controller.signal.aborted) return;
      setResult(parsed);
      setDraft(draftFromParse(parsed));
      setStage("preview");
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(
          e instanceof Error
            ? e.message
            : "Something went wrong. Please try again.",
        );
        setStage("error");
      }
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        busy.current = false;
      }
    }
  }
  function updateDraft(value: VoiceDraft) {
    setDraft({ ...value, confidence: null });
    setError("");
    setResult(null);
  }
  function chooseClarification(value: ParseResult) {
    setResult(value);
    setDraft(draftFromParse(value));
    setError("");
  }
  async function parseText(text: string, answer?: string) {
    if (busy.current || uncertain) return;
    if (!text.trim() || text.trim().length > 500) {
      setError("Enter a reminder of 1–500 characters.");
      return;
    }
    busy.current = true;
    const controller = new AbortController();
    operation.current = controller;
    setError("");
    setStage("parsing");
    setTranscript(text);
    try {
      const parsed = await service.parse(
        {
          text: text.trim(),
          timezone,
          ...(answer && result?.clarification_question
            ? {
                clarification: {
                  question: result.clarification_question,
                  answer,
                },
              }
            : {}),
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setResult(parsed);
      setDraft(draftFromParse(parsed));
      setStage("preview");
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn’t understand that reminder.",
        );
        setStage("error");
      }
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        busy.current = false;
      }
    }
  }
  async function confirm(): Promise<ApiReminder | null> {
    if (
      busy.current ||
      confirmed.current ||
      stage !== "preview" ||
      !draft ||
      uncertain
    )
      return null;
    const scheduleUnchanged =
      !!initial?.id &&
      initial.id === draft.id &&
      initial.date === draft.date &&
      initial.time === draft.time &&
      initial.timezone === draft.timezone;
    const validation = draftError(draft, Date.now(), scheduleUnchanged);
    if (validation) {
      setError(validation);
      return null;
    }
    if (result?.needs_clarification) {
      setError("Confirm the missing details before saving.");
      return null;
    }
    busy.current = true;
    const controller = new AbortController();
    operation.current = controller;
    setError("");
    setStage("saving");
    try {
      const reminder = await service.save(
        createInput(draft, scheduleUnchanged),
        {
          signal: controller.signal,
          reminderId: draft.id,
          status: draft.status,
          scheduleUnchanged,
        },
      );
      if (controller.signal.aborted) return null;
      confirmed.current = true;
      setSaved(reminder);
      setStage("success");
      return reminder;
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(
          e instanceof Error
            ? e.message
            : "Couldn’t save your reminder. Please try again.",
        );
        setUncertain(e instanceof VoiceServiceError && e.uncertain);
        setStage("preview");
      }
      return null;
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        busy.current = false;
      }
    }
  }
  return {
    stage,
    draft,
    result,
    sample,
    setSample,
    elapsed,
    paused,
    setPaused,
    error,
    uncertain,
    saved,
    transcript,
    parseText,
    finish,
    retry,
    stop,
    confirm,
    updateDraft,
    chooseClarification,
    mode: service.mode,
  };
}
