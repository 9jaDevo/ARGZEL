/** Browser-only capture. No disk storage, object URLs or background uploads. */
export class AudioCapture {
  private recorder?: MediaRecorder;
  private stream?: MediaStream;
  private generation = 0;
  private starting = false;
  private chunks: Blob[] = [];
  private bytes = 0;
  private pending?: Promise<Blob>;
  private rejectPending?: (error: Error) => void;
  constructor(private onError: (message: string) => void = () => {}) {}
  async start() {
    if (
      this.starting ||
      this.recorder?.state === "recording" ||
      this.recorder?.state === "paused"
    )
      return;
    if (
      !globalThis.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    )
      throw new Error(
        "Recording needs HTTPS and a browser with microphone support. You can type your reminder instead.",
      );
    const generation = ++this.generation;
    this.starting = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        throw new DOMException("Cancelled", "AbortError");
      }
      this.stream = stream;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      this.recorder = recorder;
      this.chunks = [];
      this.bytes = 0;
      this.pending = undefined;
      recorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        this.bytes += event.data.size;
        if (this.bytes > 10 * 1024 * 1024) {
          this.cancel();
          this.onError("Recording is too large. Try a shorter reminder.");
          return;
        }
        this.chunks.push(event.data);
      };
      recorder.onerror = () => {
        this.cancel();
        this.onError(
          "Recording was interrupted. Please try again or type your reminder.",
        );
      };
      recorder.start(250);
    } catch (cause) {
      this.release();
      if (cause instanceof DOMException && cause.name === "NotAllowedError")
        throw new Error(
          "Microphone access was denied. Allow it in your browser settings or type your reminder.",
        );
      if (cause instanceof DOMException && cause.name === "NotFoundError")
        throw new Error(
          "No microphone was found. You can type your reminder instead.",
        );
      throw cause;
    } finally {
      this.starting = false;
    }
  }
  pause() {
    if (this.recorder?.state === "recording") this.recorder.pause();
  }
  resume() {
    if (this.recorder?.state === "paused") this.recorder.resume();
  }
  finish(): Promise<Blob> {
    if (this.pending) return this.pending;
    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive")
      return Promise.reject(new Error("Record something first."));
    this.pending = new Promise((resolve, reject) => {
      this.rejectPending = reject;
      recorder.onstop = () => {
        this.release();
        this.rejectPending = undefined;
        const blob = new Blob(this.chunks, {
          type: recorder.mimeType || this.chunks[0]?.type || "audio/webm",
        });
        this.chunks = [];
        this.bytes = 0;
        if (blob.size) resolve(blob);
        else reject(new Error("No audio was recorded. Please try again."));
      };
      recorder.stop();
      this.release();
    });
    return this.pending;
  }
  private release() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
  }
  cancel() {
    this.generation++;
    if (this.recorder) {
      this.recorder.ondataavailable = null;
      this.recorder.onstop = null;
      this.recorder.onerror = null;
      if (this.recorder.state !== "inactive") this.recorder.stop();
    }
    this.release();
    this.rejectPending?.(new DOMException("Cancelled", "AbortError"));
    this.rejectPending = undefined;
    this.pending = undefined;
    this.chunks = [];
    this.bytes = 0;
  }
}
