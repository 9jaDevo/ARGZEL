import * as Sentry from '@sentry/nextjs';
import { env } from '../env';
import { ApiError } from '../http';

// Minimal client for Gemma on the Gemini API (generateContent), traced as a
// Sentry `gen_ai.chat` span (model, token usage, finish reason, attempts).
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 10_000;
const BACKOFF_MS = [400, 1200];
const MAX_OUTPUT_TOKENS = 1024;
const SPAN_STATUS_ERROR = 2;

export const aiUnavailable = () =>
  new ApiError(502, 'AI_UNAVAILABLE', "I couldn't understand that right now. Please try again, or type the reminder.");

type GenerateResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number };
  modelVersion?: string;
  responseId?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Timeouts, rate limits and Google's occasional "500 Internal error" are worth retrying.
const isTransient = (status: number) => status === 429 || status >= 500;

export async function generate(systemPrompt: string, userPrompt: string): Promise<string> {
  const model = env.gemmaModel;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    // Thinking off: about 3x faster, and the task is extraction, not reasoning.
    generationConfig: { temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS, thinkingConfig: { thinkingLevel: 'minimal' } },
  });

  return Sentry.startSpan(
    {
      op: 'gen_ai.chat',
      name: `chat ${model}`,
      attributes: {
        'gen_ai.operation.name': 'chat',
        'gen_ai.provider.name': 'gcp.gemini',
        'gen_ai.request.model': model,
        'gen_ai.request.temperature': 0,
        'gen_ai.request.max_tokens': MAX_OUTPUT_TOKENS,
      },
    },
    async (span) => {
      let failure = 'unknown';
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        span.setAttribute('argzel.attempts', attempt);
        const res = await fetch(`${API_BASE}/${model}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': env.geminiApiKey },
          body,
          signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        }).catch((err: Error) => {
          console.error(`[gemma] attempt ${attempt} failed:`, err.message);
          failure = err.name === 'TimeoutError' ? 'timeout' : 'network';
          return null;
        });

        if (res?.ok) {
          const data = (await res.json()) as GenerateResponse;
          const candidate = data.candidates?.[0];
          const usage = data.usageMetadata ?? {};
          span.setAttributes({
            'gen_ai.response.model': data.modelVersion ?? model,
            'gen_ai.response.id': data.responseId ?? '',
            'gen_ai.response.finish_reasons': JSON.stringify(candidate?.finishReason ? [candidate.finishReason] : []),
            'gen_ai.usage.input_tokens': usage.promptTokenCount ?? 0,
            'gen_ai.usage.output_tokens': (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
            'gen_ai.usage.total_tokens': usage.totalTokenCount ?? 0,
          });
          return (candidate?.content?.parts ?? [])
            .filter((part) => !part.thought)
            .map((part) => part.text ?? '')
            .join('');
        }
        if (res) {
          // Provider error bodies describe the key/model/quota problem, not the user's text.
          console.error(`[gemma] attempt ${attempt} HTTP ${res.status}:`, (await res.text()).slice(0, 1000));
          failure = `http_${res.status}`;
          if (!isTransient(res.status)) break;
        }
        if (attempt < ATTEMPTS) await sleep(BACKOFF_MS[attempt - 1]);
      }

      span.setStatus({ code: SPAN_STATUS_ERROR, message: failure });
      span.setAttribute('error.type', failure);
      Sentry.captureMessage('Gemma request failed', { level: 'error', tags: { provider: 'gemini', model, failure } });
      throw aiUnavailable();
    },
  );
}
