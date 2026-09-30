import path from "node:path";
import dotenv from "dotenv";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { connectDb } from "./db";

// Local development: reads the repo-root .env (git-ignored), connects, and listens.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
const config = loadConfig();

connectDb(config.MONGODB_URI)
  .then(() => {
    const port = Number(process.env.PORT ?? 4000);
    createApp(config).listen(port, () => console.log(`NexaCart API on http://localhost:${port}`));
  })
  .catch((e) => {
    console.error("Could not start:", e.message);
    process.exit(1);
  });
