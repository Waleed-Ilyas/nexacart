import mongoose from "mongoose";

// Serverless functions can be frozen and reused, so the connection is cached on globalThis and shared by every
// request on the same instance. Without this each request would open a new connection and exhaust the Atlas M0 limit.
type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null; uri: string | null };
const g = globalThis as unknown as { __nexacartMongo?: Cache };
const cache: Cache = (g.__nexacartMongo ??= { conn: null, promise: null, uri: null });

export async function connectDb(uri: string): Promise<typeof mongoose> {
  if (cache.conn && cache.uri === uri) return cache.conn;
  if (!cache.promise || cache.uri !== uri) {
    cache.uri = uri;
    mongoose.set("strictQuery", true);
    cache.promise = mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 5, bufferCommands: false });
  }
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null;
    throw e;
  }
  return cache.conn;
}

export async function disconnectDb() {
  await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
  cache.uri = null;
}
