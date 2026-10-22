import { endSession } from '@/server/auth';
import { json, route } from '@/server/http';
import type { OkResponse } from '@/types/api';

export const POST = route(async () => {
  await endSession();
  return json<OkResponse>({ ok: true });
});
