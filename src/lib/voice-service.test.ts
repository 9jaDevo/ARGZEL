import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiVoiceService,
  createInput,
  createMockVoiceService,
  draftError,
  draftFromParse,
  voiceSamples,
  VoiceServiceError,
} from "./voice-service";

const service = () =>
  createMockVoiceService({
    delay: 0,
    now: () => new Date("2070-01-01T12:00:00Z"),
  });
const signal = () => new AbortController().signal;
async function hostingDraft() {
  return draftFromParse(
    await service().parse(
      { text: voiceSamples.hosting, timezone: "Africa/Lagos" },
      signal(),
    ),
  );
}
afterEach(() => vi.unstubAllGlobals());

describe("voice preview boundary", () => {
  it("keeps an ambiguous time unset until the user resolves it", async () => {
    const result = await service().parse(
      { text: voiceSamples.call, timezone: "Africa/Lagos" },
      signal(),
    );
    expect(result.needs_clarification).toBe(true);
    expect(result.time).toBeNull();
    expect(result.scheduled_at).toBeNull();
    expect(() => createInput(draftFromParse(result))).toThrow(/specific time/);
    const edited = { ...draftFromParse(result), time: "09:30" };
    const input = createInput(edited);
    expect(input).toMatchObject({
      confirmed: true,
      date: "2070-01-02",
      time: "09:30",
      timezone: "Africa/Lagos",
      source_text: voiceSamples.call,
    });
    expect(input).not.toHaveProperty("scheduled_at");
  });
  it("does not guess a result for an arbitrary phrase in the mock adapter", async () => {
    await expect(
      service().parse(
        { text: "Something the mock does not understand" },
        signal(),
      ),
    ).rejects.toMatchObject({ code: "DEMO_PHRASE" });
  });
  it("rejects empty titles, impossible dates, past times and DST gaps", async () => {
    const draft = await hostingDraft();
    expect(draftError({ ...draft, title: " " })).toMatch(/title/);
    expect(draftError({ ...draft, date: "2070-02-30" })).toMatch(
      /specific time/,
    );
    expect(draftError({ ...draft, date: "2000-01-01" })).toMatch(/passed/);
    expect(draftError({ ...draft, timezone: "Not/AZone" })).toMatch(/timezone/);
    expect(
      draftError(
        {
          ...draft,
          date: "2030-03-10",
          time: "02:30",
          timezone: "America/New_York",
        },
        0,
      ),
    ).toMatch(/clocks change/);
  });
  it("aborts pending work instead of returning a late transcript", async () => {
    const controller = new AbortController();
    const pending = createMockVoiceService({ delay: 30 }).transcribe(
      { sample: "hosting" },
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
  it("requires confirmation and preserves the existing reminder identity/status", async () => {
    const input = createInput(await hostingDraft());
    const unconfirmed = { ...input };
    (unconfirmed as { confirmed: boolean }).confirmed = false;
    await expect(
      service().save(unconfirmed, { signal: signal() }),
    ).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
    const saved = await service().save(input, {
      signal: signal(),
      reminderId: "existing",
      status: "completed",
    });
    expect(saved).toMatchObject({
      id: "existing",
      status: "completed",
      timezone: "Africa/Lagos",
      date: "2070-01-02",
      time: "10:00",
      scheduled_at: "2070-01-02T09:00:00.000Z",
    });
  });
});

describe("real backend adapter contract (fetch mocked; no network)", () => {
  it("posts a MediaRecorder blob as multipart audio with the session cookie", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ text: "Hello" })));
    vi.stubGlobal("fetch", fetch);
    await apiVoiceService.transcribe(
      { audio: new Blob(["audio"], { type: "audio/webm" }), sample: "hosting" },
      signal(),
    );
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/voice/transcribe");
    expect(init.credentials).toBe("same-origin");
    expect(init.body.get("audio")).toBeInstanceOf(Blob);
    expect(init.headers).toBeUndefined();
  });
  it("sends parse input unchanged, including clarification context", async () => {
    const result = await service().parse(
      { text: voiceSamples.hosting, timezone: "Africa/Lagos" },
      signal(),
    );
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ result })));
    vi.stubGlobal("fetch", fetch);
    const input = {
      text: voiceSamples.call,
      timezone: "Africa/Lagos",
      clarification: { question: "What time?", answer: "9 AM" },
    };
    expect(await apiVoiceService.parse(input, signal())).toEqual(result);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(input);
  });
  it("uses confirmed POST for new reminders and compatible PATCH fields for edits", async () => {
    const input = createInput(await hostingDraft());
    const reminder = await service().save(input, { signal: signal() });
    const fetch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ reminder }))),
      );
    vi.stubGlobal("fetch", fetch);
    await apiVoiceService.save(input, { signal: signal() });
    expect(fetch.mock.calls[0][0]).toBe("/api/reminders");
    expect(fetch.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(fetch.mock.calls[0][1].body).confirmed).toBe(true);
    await apiVoiceService.save(input, {
      signal: signal(),
      reminderId: "existing/id",
    });
    expect(fetch.mock.calls[1][0]).toBe("/api/reminders/existing%2Fid");
    expect(fetch.mock.calls[1][1].method).toBe("PATCH");
    const patch = JSON.parse(fetch.mock.calls[1][1].body);
    expect(patch).not.toHaveProperty("confirmed");
    expect(patch).not.toHaveProperty("source_text");
    expect(patch).not.toHaveProperty("scheduled_at");
    expect(patch).toMatchObject({
      date: input.date,
      time: input.time,
      timezone: input.timezone,
    });
  });
  it("marks a lost save response as uncertain so it cannot be blindly retried", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Connection lost")),
    );
    await expect(
      apiVoiceService.save(createInput(await hostingDraft()), {
        signal: signal(),
      }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR", uncertain: true });
  });
  it("surfaces a known auth failure without inventing a mock success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "UNAUTHORIZED", message: "Please sign in" },
          }),
          { status: 401 },
        ),
      ),
    );
    await expect(
      apiVoiceService.parse({ text: "Reminder" }, signal()),
    ).rejects.toEqual(
      new VoiceServiceError("Please sign in", "UNAUTHORIZED", false),
    );
  });
  it("does not send anything when the audio blob is missing", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      apiVoiceService.transcribe({ sample: "hosting" }, signal()),
    ).rejects.toMatchObject({ code: "NO_AUDIO" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not show success when a save response omits the reminder", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    await expect(
      apiVoiceService.save(createInput(await hostingDraft()), {
        signal: signal(),
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE", uncertain: true });
  });
});
