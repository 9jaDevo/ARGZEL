import { env } from '../env';
import { ApiError } from '../http';

// Whisper speech-to-text via an OpenAI-compatible /audio/transcriptions endpoint.
// Audio is forwarded from memory and never written to disk (spec §12).

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'video/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/aac': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/flac': 'flac',
};

/** File extension for a recording's MIME type ("audio/webm;codecs=opus" -> "webm"), or null if unsupported. */
export function audioExtension(mimeType: string) {
  return EXTENSIONS[mimeType.split(';')[0].trim().toLowerCase()] ?? null;
}

export async function transcribe(audio: Blob, extension: string): Promise<string> {
  const form = new FormData();
  // The provider detects the format from the file name.
  form.append('file', audio, `recording.${extension}`);
  form.append('model', env.sttModel);
  form.append('language', 'en');
  form.append('response_format', 'json');
  form.append('temperature', '0');

  const res = await fetch(env.sttApiUrl, {
    method: 'POST',
    headers: env.sttApiKey ? { authorization: `Bearer ${env.sttApiKey}` } : {},
    body: form,
    signal: AbortSignal.timeout(30_000),
  }).catch((err: Error) => {
    console.error('[stt] request failed:', err.message);
    return null;
  });
  if (!res?.ok) {
    if (res) console.error(`[stt] HTTP ${res.status}:`, (await res.text()).slice(0, 300));
    throw new ApiError(502, 'STT_UNAVAILABLE', "I couldn't transcribe that right now. Please try again.");
  }
  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}
