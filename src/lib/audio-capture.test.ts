import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioCapture } from "./audio-capture";
const stopTrack = vi.fn();
const stream = {
  getTracks: () => [{ stop: stopTrack }],
} as unknown as MediaStream;
class Recorder {
  static isTypeSupported(type: string) {
    return type === "audio/mp4";
  }
  static last: Recorder;
  state = "inactive";
  mimeType = "audio/mp4";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    Recorder.last = this;
  }
  start() {
    this.state = "recording";
  }
  pause() {
    this.state = "paused";
  }
  resume() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => {
      this.ondataavailable?.({
        data: new Blob(["audio"], { type: this.mimeType }),
      });
      this.onstop?.();
    });
  }
}
beforeEach(() => {
  stopTrack.mockClear();
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("microphone lifecycle", () => {
  it("finishes one Blob, supports pause/resume, and releases every track", async () => {
    const capture = new AudioCapture();
    await capture.start();
    capture.pause();
    expect(Recorder.last.state).toBe("paused");
    capture.resume();
    expect(Recorder.last.state).toBe("recording");
    const first = capture.finish();
    expect(capture.finish()).toBe(first);
    const blob = await first;
    expect(blob.type).toBe("audio/mp4");
    expect(await blob.text()).toBe("audio");
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });
  it("releases permission results that arrive after cancellation", async () => {
    let grant!: (value: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(
      () =>
        new Promise((resolve) => {
          grant = resolve;
        }),
    );
    const capture = new AudioCapture();
    const pending = capture.start();
    capture.cancel();
    grant(stream);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });
  it("rejects denied permission without a simulated recording", async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
      new DOMException("Denied", "NotAllowedError"),
    );
    await expect(new AudioCapture().start()).rejects.toThrow(
      "Microphone access was denied",
    );
  });
  it("releases resources when recorder construction fails", async () => {
    class Broken extends Recorder {
      constructor() {
        super();
        throw new Error("Unsupported");
      }
    }
    vi.stubGlobal("MediaRecorder", Broken);
    await expect(new AudioCapture().start()).rejects.toThrow("Unsupported");
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });
  it("cancels a pending finish without returning late audio", async () => {
    const capture = new AudioCapture();
    await capture.start();
    const pending = capture.finish();
    capture.cancel();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });
});
