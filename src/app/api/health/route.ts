import mongoose from 'mongoose';
import { connectDB } from '@/server/db';

// Render health check: 200 when the app can reach MongoDB, 503 otherwise.
// Reports no configuration details.
export const dynamic = 'force-dynamic';

export async function GET() {
  const commit = process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null;
  try {
    await connectDB();
    await mongoose.connection.db!.admin().ping();
    return Response.json({ status: 'ok', db: 'up', commit });
  } catch {
    return Response.json({ status: 'degraded', db: 'down', commit }, { status: 503 });
  }
}
