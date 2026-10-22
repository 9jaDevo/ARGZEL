import { env } from '../env';
import { ApiError } from '../http';

// Minimal client for Gemma on the Gemini API (generateContent).
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 10_000;
const BACKOFF_MS = [400, 1200];

export const aiUnavailable = () =>
  new ApiError(502, 'AI_UNAVAILABLE', "I couldn't understand that right now. Please try again, or type the reminder.");

type GenerateResponse = { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Timeouts, rate limits and Google's occasional "500 Internal error" are worth retrying.
const isTransient = (status: number) => status === 429 || status >= 500;

export async function generate(systemPrompt: string, userPrompt: string): Promise<string> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    // Thinking off: about 3x faster, and the task is extraction, not reasoning.
    generationConfig: { temperature: 0, maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: 'minimal' } },
  });

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const res = await fetch(`${API_BASE}/${env.gemmaModel}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.geminiApiKey },
      body,
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    }).catch((err: Error) => {
      console.error(`[gemma] attempt ${attempt} failed:`, err.message);
      return null;
    });

    if (res?.ok) {
      const data = (await res.json()) as GenerateResponse;
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      return parts
        .filter((part) => !part.thought)
        .map((part) => part.text ?? '')
        .join('');
    }
    if (res) {
      // Provider error bodies describe the key/model/quota problem, not the user's text.
      console.error(`[gemma] attempt ${attempt} HTTP ${res.status}:`, (await res.text()).slice(0, 1000));
      if (!isTransient(res.status)) break;
    }
    if (attempt < ATTEMPTS) await sleep(BACKOFF_MS[attempt - 1]);
  }
  throw aiUnavailable();
}
