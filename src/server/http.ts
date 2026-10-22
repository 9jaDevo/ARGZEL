import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import type { ApiErrorBody } from '@/types/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export const notFound = () => new ApiError(404, 'NOT_FOUND', 'Not found');

export function validationError(fields: Record<string, string[]>, message = 'Some fields are invalid') {
  return new ApiError(400, 'VALIDATION_ERROR', message, fields);
}

function issuesToFields(error: z.ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/** Validates `input` against `schema`, throwing a 400 with per-field messages. */
export function validate<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw validationError(issuesToFields(result.error));
  return result.data;
}

export async function readJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.output<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON');
  }
  return validate(schema, body);
}

export function json<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

/** Wraps a route handler so every failure becomes a `{ error }` JSON response. */
export function route<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        const body: ApiErrorBody = { error: { code: err.code, message: err.message, ...(err.fields && { fields: err.fields }) } };
        return json(body, err.status);
      }
      console.error('[api] unhandled error:', err instanceof Error ? err.message : err);
      Sentry.captureException(err);
      const body: ApiErrorBody = { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } };
      return json(body, 500);
    }
  };
}
