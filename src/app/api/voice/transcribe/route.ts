import { requireUserId } from '@/server/auth';
import { ApiError, json, route, validationError } from '@/server/http';
import { MAX_AUDIO_BYTES, audioExtension, transcribe } from '@/server/voice/transcribe';
import type { TranscribeResponse } from '@/types/api';

/** multipart/form-data with an `audio` file (a MediaRecorder blob) -> { text }. */
export const POST = route(async (req: Request) => {
  await requireUserId();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw validationError({ audio: ['Send the recording as multipart/form-data in an "audio" field'] });
  }

  const audio = form.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) throw validationError({ audio: ['Attach a recording'] });
  if (audio.size > MAX_AUDIO_BYTES) throw validationError({ audio: ['Recording is too long. Keep it under a minute.'] });
  const extension = audioExtension(audio.type);
  if (!extension) throw validationError({ audio: [`Unsupported audio format: ${audio.type || 'unknown'}`] });

  const text = await transcribe(audio, extension);
  if (!text) throw new ApiError(422, 'NO_SPEECH', "I didn't catch that. Try again a little closer to the mic.");
  return json<TranscribeResponse>({ text });
});
