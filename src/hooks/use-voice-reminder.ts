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
    if (!value.needs_clarification) {
      setResult(value);
      setDraft(draftFromParse(value));
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
    const validation = draftError(draft);
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
      const reminder = await service.save(createInput(draft), {
        signal: controller.signal,
        reminderId: draft.id,
        status: draft.status,
      });
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
    finish,
    retry,
    stop,
    confirm,
    updateDraft,
    chooseClarification,
    mode: service.mode,
  };
}
