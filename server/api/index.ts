import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { connectDb } from "../src/db";

// Vercel entry point. The Express app is built once per warm instance, and the database
// connection is opened lazily and reused (see src/db.ts).
let app: ReturnType<typeof createApp> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const config = loadConfig();
    await connectDb(config.MONGODB_URI);
    app ??= createApp(config);
    app(req, res);
  } catch (e) {
    console.error("Startup error:", e instanceof Error ? e.message : e);
    res.statusCode = 503;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "The service is starting up. Please retry in a moment." }));
  }
}
