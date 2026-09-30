import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { Config } from "./config";
import { errorHandler, notFound } from "./lib/errors";
import { createCloudinaryStore, createStripePayments, type Deps } from "./lib/services";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { checkoutRouter, webhookRouter } from "./routes/checkout";
import { ordersRouter } from "./routes/orders";
import { productsRouter } from "./routes/products";

export function createApp(config: Config, deps?: Partial<Deps>) {
  const services: Deps = {
    payments: deps?.payments ?? createStripePayments(config),
    images: deps?.images ?? createCloudinaryStore(config),
  };
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // behind Vercel's proxy, so rate limits see the real client address

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.clientOrigins.includes(origin)),
      credentials: true,
    }),
  );

  // The Stripe webhook needs the raw request body, so it is mounted before the JSON parser.
  app.use("/api/webhooks", webhookRouter(services));

  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter(config));
  app.use("/api/products", productsRouter());
  app.use("/api/checkout", checkoutRouter(config, services));
  app.use("/api/orders", ordersRouter(config));
  app.use("/api/admin", adminRouter(config, services));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
