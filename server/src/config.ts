import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  CLOUDINARY_CLOUD_NAME: z.string().default(""),
  CLOUDINARY_API_KEY: z.string().default(""),
  CLOUDINARY_API_SECRET: z.string().default(""),
  /** Comma separated list of browser origins allowed to call the API with credentials. */
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  /** When true, the public demo admin cannot create, edit or delete products. */
  DEMO_ADMIN_READONLY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  DEMO_ADMIN_EMAIL: z.string().default("admin@waleed.dev"),
});

export type Config = Omit<z.infer<typeof Env>, "CLIENT_ORIGIN"> & { clientOrigins: string[]; clientOrigin: string };

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${problems}`);
  }
  const { CLIENT_ORIGIN, ...rest } = parsed.data;
  const clientOrigins = CLIENT_ORIGIN.split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return { ...rest, clientOrigins, clientOrigin: clientOrigins[0] ?? "http://localhost:5173" };
}
