import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Live checks against the real Gemma / Whisper APIs (`npm run test:live`).
// Kept out of `npm test` because they need keys in .env.local and use quota.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['src/**/*.live.ts'], testTimeout: 60_000, fileParallelism: false },
});
