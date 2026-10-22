import type {
  ApiErrorBody,
  ApiReminder,
  CreateReminderInput,
  ParseInput,
  ParseResponse,
  ParseResult,
  Recurrence,
  ReminderResponse,
  TranscribeResponse,
} from "@/types/api";
// This module contains only Intl/date helpers, with no server I/O or credentials.
import {
  addDays,
  isRealDate,
  isValidTimeZone,
  utcToZoned,
  zonedToUtc,
} from "@/server/time";

export type VoiceSample = "hosting" | "call";
export const voiceSamples: Record<VoiceSample, string> = {
  hosting: "Remind me to renew my website hosting tomorrow at 10 AM.",
  call: "Remind me to call James tomorrow morning.",
};
export interface VoiceDraft {
  id?: string;
  status?: ApiReminder["status"];
  title: string;
  notes: string;
  date: string;
  time: string;
  timezone: string;
  recurrence: Recurrence;
  source_text: string;
  confidence: number | null;
}
export class VoiceServiceError extends Error {
  constructor(
    message: string,
    public readonly code = "SERVICE_ERROR",
    public readonly uncertain = false,
  ) {
    super(message);
    this.name = "VoiceServiceError";
  }
}
export interface VoiceService {
  readonly mode: "demo" | "api";
  transcribe(
    input: { audio?: Blob; sample: VoiceSample },
    signal: AbortSignal,
  ): Promise<string>;
  parse(input: ParseInput, signal: AbortSignal): Promise<ParseResult>;
  save(
    input: CreateReminderInput,
    options: {
      signal: AbortSignal;
      reminderId?: string;
      status?: ApiReminder["status"];
      scheduleUnchanged?: boolean;
    },
  ): Promise<ApiReminder>;
}
export function draftFromParse(result: ParseResult): VoiceDraft {
  return {
    title: result.title,
    notes: result.notes,
    date: result.date ?? "",
    time: result.time ?? "",
    timezone: result.timezone,
    recurrence: result.recurrence,
    source_text: result.source_text,
    confidence: result.confidence,
  };
}
export function draftError(
  draft: VoiceDraft,
  now = Date.now(),
  allowPast = false,
): string | null {
  if (!draft.title.trim() || draft.title.trim().length > 200)
    return "Give your reminder a title of 1–200 characters.";
  if (draft.notes.length > 1000)
    return "Keep your notes under 1,000 characters.";
  if (!isValidTimeZone(draft.timezone)) return "Choose a valid timezone.";
  if (!isRealDate(draft.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))
    return "Choose a date and a specific time before confirming.";
  if (!["none", "daily", "weekly", "monthly"].includes(draft.recurrence))
    return "Choose a supported repeat setting.";
  const instant = zonedToUtc(draft.date, draft.time, draft.timezone);
  const roundTrip = utcToZoned(instant, draft.timezone);
  if (roundTrip.date !== draft.date || roundTrip.time !== draft.time)
    return "That time doesn’t exist because the clocks change. Choose another time.";
  if (!allowPast && instant.getTime() <= now)
    return "That time has passed. Choose a future date and time.";
  return null;
}
export function createInput(
  draft: VoiceDraft,
  allowPast = false,
): CreateReminderInput {
  const error = draftError(draft, Date.now(), allowPast);
  if (error) throw new VoiceServiceError(error, "INVALID_DRAFT");
  return {
    confirmed: true,
    title: draft.title.trim(),
    notes: draft.notes.trim(),
    date: draft.date,
    time: draft.time,
    timezone: draft.timezone,
    recurrence: draft.recurrence,
    source_text: draft.source_text,
    ai_confidence: draft.confidence,
  };
}
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
export function createMockVoiceService({
  delay = 450,
  now = () => new Date(),
}: { delay?: number; now?: () => Date } = {}): VoiceService {
  return {
    mode: "demo",
    async transcribe({ sample }, signal) {
      await wait(delay, signal);
      return voiceSamples[sample];
    },
    async parse(input, signal) {
      await wait(delay, signal);
      const timezone = input.timezone ?? "Africa/Lagos";
      const date = addDays(utcToZoned(now(), timezone).date, 1);
      const isCall = input.text === voiceSamples.call;
      if (!isCall && input.text !== voiceSamples.hosting)
        throw new VoiceServiceError(
          "This preview uses the example phrases. Try an example, then edit its details.",
          "DEMO_PHRASE",
        );
      const title = isCall ? "Call James" : "Renew website hosting";
      const base: ParseResult = {
        title,
        notes: "",
        source_text: input.text,
        timezone,
        recurrence: "none",
        scheduled_at: null,
        date,
        time: isCall ? null : "10:00",
        confidence: isCall ? 0.5 : 0.97,
        needs_clarification: isCall,
        clarification_question: isCall
          ? "What time tomorrow should I remind you?"
          : null,
        ambiguities: isCall ? ["missing_time"] : [],
        options: [],
        preview: {
          title,
          day_label: "Tomorrow",
          time_label: isCall ? null : "10:00 AM",
          recurrence_label: "Does not repeat",
          channel_label: "Email",
          summary: title,
          speech: isCall
            ? "What time tomorrow should I remind you?"
            : `Remind you to ${title.toLowerCase()} tomorrow at 10 AM. Does that sound right?`,
        },
      };
      if (!isCall)
        base.scheduled_at = zonedToUtc(date, "10:00", timezone).toISOString();
      return base;
    },
    async save(input, { signal, reminderId, status }) {
      // The same confirmation flag is required by the actual reminder endpoint.
      if (input.confirmed !== true)
        throw new VoiceServiceError(
          "Confirm the reminder before saving.",
          "CONFIRMATION_REQUIRED",
        );
      await wait(delay, signal);
      const instant = input.scheduled_at
        ? new Date(input.scheduled_at)
        : zonedToUtc(input.date!, input.time!, input.timezone);
      const wall = utcToZoned(instant, input.timezone);
      const stamp = now().toISOString();
      return {
        id: reminderId ?? crypto.randomUUID(),
        title: input.title,
        notes: input.notes ?? "",
        ...wall,
        timezone: input.timezone,
        scheduled_at: instant.toISOString(),
        recurrence: input.recurrence ?? "none",
        source_text: input.source_text ?? "",
        ai_confidence: input.ai_confidence ?? null,
        status: status ?? "scheduled",
        delivery_channel: "email",
        created_at: stamp,
        updated_at: stamp,
      };
    },
  };
}
export const mockVoiceService = createMockVoiceService();

async function request<T>(
  url: string,
  init: RequestInit,
  save = false,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { credentials: "same-origin", ...init });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new VoiceServiceError(
      save
        ? "We couldn’t verify whether your reminder was saved. Check your reminders before trying again."
        : "Couldn’t connect. Please try again.",
      "NETWORK_ERROR",
      save,
    );
  }
  let body: T | ApiErrorBody;
  try {
    body = await response.json();
  } catch {
    throw new VoiceServiceError(
      "The service returned an unreadable response.",
      "INVALID_RESPONSE",
      save,
    );
  }
  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new VoiceServiceError(
      error?.message ?? "The request could not be completed.",
      error?.code ?? "SERVICE_ERROR",
      save && response.status >= 500,
    );
  }
  return body as T;
}
/** Integration adapter. Requires real authentication and a MediaRecorder Blob.
 * Not selected by the demo UI; no silent fallback from API errors to mock data. */
export const apiVoiceService: VoiceService = {
  mode: "api",
  async transcribe({ audio }, signal) {
    if (!audio?.size)
      throw new VoiceServiceError("Record a reminder first.", "NO_AUDIO");
    const form = new FormData();
    form.append("audio", audio, "reminder");
    const response = await request<TranscribeResponse>(
      "/api/voice/transcribe",
      {
        method: "POST",
        body: form,
        signal,
      },
    );
    if (typeof response?.text !== "string" || !response.text.trim())
      throw new VoiceServiceError(
        "No speech was returned. Please record again or type your reminder.",
        "INVALID_RESPONSE",
      );
    return response.text;
  },
  async parse(input, signal) {
    const response = await request<ParseResponse>("/api/voice/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
    if (
      !response?.result ||
      typeof response.result.title !== "string" ||
      typeof response.result.source_text !== "string"
    )
      throw new VoiceServiceError(
        "The service returned an incomplete reminder. Please try again.",
        "INVALID_RESPONSE",
      );
    return response.result;
  },
  async save(input, { signal, reminderId, status, scheduleUnchanged }) {
    if (input.confirmed !== true)
      throw new VoiceServiceError(
        "Confirm the reminder before saving.",
        "CONFIRMATION_REQUIRED",
      );
    const body = reminderId
      ? {
          title: input.title,
          notes: input.notes,
          timezone: input.timezone,
          recurrence: input.recurrence,
          ...(status === "completed" || status === "cancelled"
            ? { status }
            : {}),
          ...(scheduleUnchanged
            ? {}
            : input.scheduled_at
              ? { scheduled_at: input.scheduled_at }
              : { date: input.date, time: input.time }),
        }
      : input;
    const response = await request<ReminderResponse>(
      reminderId
        ? `/api/reminders/${encodeURIComponent(reminderId)}`
        : "/api/reminders",
      {
        method: reminderId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      },
      true,
    );
    if (!response?.reminder?.id)
      throw new VoiceServiceError(
        "We couldn’t verify the saved reminder. Check your reminders before trying again.",
        "INVALID_RESPONSE",
        true,
      );
    return response.reminder;
  },
};
