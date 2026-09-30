import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In development the API runs on :4000 and is reached through the same origin, so the refresh cookie behaves exactly
// as it does in production, where Vercel rewrites /api to the API deployment.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { "/api": { target: "http://localhost:4000", changeOrigin: false } } },
  test: { environment: "jsdom", globals: false, include: ["src/**/*.test.{ts,tsx}"], setupFiles: ["./src/test-setup.ts"] },
});
