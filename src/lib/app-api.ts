import type {
  ApiUser,
  ApiReminder,
  SignInInput,
  SignUpInput,
  UpdateMeInput,
  UpdateReminderInput,
} from "@/types/api";
import type { Reminder } from "./demo";

export class ClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}
/** Same-origin sessions stay in httpOnly cookies; never store credentials in browser storage. */
export async function appRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 15_000);
  try {
    const response = await fetch(path, {
      method,
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok)
      throw new ClientError(
        data?.error?.message ?? "The request failed. Please try again.",
        response.status,
        data?.error?.fields,
      );
    if (data === null)
      throw new ClientError(
        "The service returned an unreadable response.",
        response.status,
      );
    return data as T;
  } catch (cause) {
    if (signal?.aborted || cause instanceof ClientError) throw cause;
    throw new ClientError(
      method === "GET"
        ? "Couldn’t connect. Please try again."
        : "We couldn’t verify that change. Refresh your account before trying again.",
      0,
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
export const appApi = {
  me: (signal?: AbortSignal) =>
    appRequest<{ user: ApiUser }>("/api/me", "GET", undefined, signal),
  auth: (kind: "signin" | "signup", input: SignInInput | SignUpInput) =>
    appRequest<{ user: ApiUser }>(`/api/auth/${kind}`, "POST", input),
  logout: () => appRequest("/api/auth/signout", "POST"),
  profile: (input: UpdateMeInput) =>
    appRequest<{ user: ApiUser }>("/api/me", "PATCH", input),
  reminders: (signal?: AbortSignal) =>
    appRequest<{ reminders: ApiReminder[] }>(
      "/api/reminders?limit=200",
      "GET",
      undefined,
      signal,
    ),
  update: (id: string, input: UpdateReminderInput) =>
    appRequest<{ reminder: ApiReminder }>(
      `/api/reminders/${encodeURIComponent(id)}`,
      "PATCH",
      input,
    ),
  remove: (id: string) =>
    appRequest(`/api/reminders/${encodeURIComponent(id)}`, "DELETE"),
};
export function toReminder(record: ApiReminder): Reminder {
  return {
    id: record.id,
    title: record.title,
    notes: record.notes,
    date: record.date,
    time: record.time,
    timezone: record.timezone,
    recurrence: record.recurrence,
    status: record.status,
    source: record.source_text,
  };
}
export function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "A"
  );
}
