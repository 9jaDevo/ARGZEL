import mongoose from 'mongoose';
import { env } from './env';

// Reuse one connection across hot reloads (dev) and route invocations (prod).
type Cache = { target: string | null; conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const globalForMongoose = globalThis as typeof globalThis & { _argzelMongoose?: Cache };
const cache = (globalForMongoose._argzelMongoose ??= { target: null, conn: null, promise: null });

export async function connectDB() {
  const target = `${env.mongodbUri}|${env.mongodbDb}`;
  if ((cache.conn || cache.promise) && cache.target !== target) {
    // The env files changed under a running dev server: reconnect instead of
    // silently writing to the previous database.
    await mongoose.disconnect().catch(() => undefined);
    cache.conn = null;
    cache.promise = null;
  }
  cache.target = target;
  if (cache.conn) return cache.conn;
  cache.promise ??= mongoose.connect(env.mongodbUri, {
    dbName: env.mongodbDb,
    bufferCommands: false,
    serverSelectionTimeoutMS: 10_000,
  });
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
