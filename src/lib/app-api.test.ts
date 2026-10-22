import { afterEach, describe, expect, it, vi } from "vitest";
import { appApi, appRequest, toReminder } from "./app-api";
import type { ApiReminder } from "@/types/api";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("frontend API integration", () => {
  it("uses same-origin cookies and sends real auth input", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ user: { id: "user" } })),
      );
    vi.stubGlobal("fetch", fetch);
    await appApi.auth("signin", {
      email: "test@example.com",
      password: "test-password",
    });
    expect(fetch.mock.calls[0][0]).toBe("/api/auth/signin");
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      email: "test@example.com",
      password: "test-password",
    });
  });
  it("preserves auth errors instead of returning demo data", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { message: "Sign in again" } }),
            { status: 401 },
          ),
        ),
    );
    await expect(appApi.me()).rejects.toMatchObject({
      status: 401,
      message: "Sign in again",
    });
  });
  it("preserves every backend reminder status", () => {
    for (const status of [
      "scheduled",
      "delivered",
      "completed",
      "cancelled",
      "failed",
    ] as const) {
      expect(
        toReminder({ status, source_text: "original" } as ApiReminder),
      ).toMatchObject({ status, source: "original" });
    }
  });
  it("encodes identifiers and does not discard failed mutation responses", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response("null", { status: 500 }));
    vi.stubGlobal("fetch", fetch);
    await expect(appApi.remove("a/b")).rejects.toMatchObject({ status: 500 });
    expect(fetch.mock.calls[0][0]).toBe("/api/reminders/a%2Fb");
  });
  it("bounds stalled requests and warns that a mutation may have applied", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_path, options) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );
    const pending = expect(
      appRequest("/api/me", "PATCH", { timezone: "UTC" }),
    ).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("couldn’t verify"),
    });
    await vi.advanceTimersByTimeAsync(15001);
    await pending;
  });
});
