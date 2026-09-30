import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { createApp } from "../src/app";
import { loadConfig, type Config } from "../src/config";
import type { CheckoutSessionInput, Deps, ImageStore, PaymentsClient, ShippingDetails } from "../src/lib/services";
import { Order } from "../src/models/Order";
import { Product } from "../src/models/Product";
import { User } from "../src/models/User";

export const TEST_ENV = {
  NODE_ENV: "test",
  MONGODB_URI: "mongodb://placeholder",
  JWT_SECRET: "test-secret-test-secret-test-secret-123456",
  CLIENT_ORIGIN: "http://localhost:5173",
  DEMO_ADMIN_READONLY: "false",
};

/** Stands in for Stripe. `pay(sessionId)` simulates the customer finishing the hosted checkout. */
export class FakePayments implements PaymentsClient {
  sessions = new Map<string, CheckoutSessionInput>();
  paid = new Map<string, ShippingDetails | undefined>();
  fail = false;
  private n = 0;

  reset() {
    this.sessions.clear();
    this.paid.clear();
    this.fail = false;
    this.n = 0;
  }

  async createCheckoutSession(input: CheckoutSessionInput) {
    if (this.fail) throw new Error("stripe down");
    const id = `cs_test_${++this.n}`;
    this.sessions.set(id, input);
    return { id, url: `https://checkout.test/${id}` };
  }
  async retrieveSession(id: string) {
    return { id, paid: this.paid.has(id), shipping: this.paid.get(id) };
  }
  constructEvent(raw: Buffer, signature: string) {
    if (signature !== "valid-signature") throw new Error("bad signature");
    return JSON.parse(raw.toString());
  }
  pay(id: string, shipping?: ShippingDetails) {
    this.paid.set(id, shipping);
  }
}

export class FakeImages implements ImageStore {
  uploaded: Buffer[] = [];
  removed: string[] = [];
  async upload(buffer: Buffer) {
    this.uploaded.push(buffer);
    return { url: `https://images.test/p${this.uploaded.length}.png`, publicId: `nexacart/products/p${this.uploaded.length}` };
  }
  async remove(publicId: string) {
    this.removed.push(publicId);
  }
}

/**
 * Gives a test file its own database and a fresh app with fake Stripe and Cloudinary.
 * With TEST_MONGODB_URI set it uses that server and a uniquely named throwaway database that is dropped afterwards.
 * Without it, it starts an in-memory MongoDB (the binary is downloaded once, which needs internet access).
 */
export function useTestApp(envOverrides: Record<string, string> = {}) {
  const ctx = {
    mongod: undefined as MongoMemoryServer | undefined,
    config: undefined as unknown as Config,
    app: undefined as unknown as ReturnType<typeof createApp>,
    payments: new FakePayments(),
    images: new FakeImages(),
  };
  const external = process.env.TEST_MONGODB_URI;

  beforeAll(async () => {
    let uri: string;
    if (external) {
      uri = external;
      await mongoose.connect(uri, { dbName: `nexacart_test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, bufferCommands: false });
    } else {
      ctx.mongod = await MongoMemoryServer.create();
      uri = ctx.mongod.getUri();
      await mongoose.connect(uri, { bufferCommands: false });
    }
    await Promise.all([User.init(), Product.init(), Order.init()]); // make sure the unique indexes exist before any test runs
    ctx.config = loadConfig({ ...TEST_ENV, ...envOverrides, MONGODB_URI: uri });
    ctx.app = createApp(ctx.config, { payments: ctx.payments, images: ctx.images } as Deps);
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({})]);
    ctx.payments.reset();
    ctx.images.uploaded.length = 0;
    ctx.images.removed.length = 0;
  });
  afterAll(async () => {
    if (external) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await ctx.mongod?.stop();
  });
  return ctx;
}

export const api = (app: ReturnType<typeof createApp>) => request(app);

/** Signs up through the real endpoint, so the test exercises hashing, tokens and the refresh cookie. */
export async function signUp(app: ReturnType<typeof createApp>, email = "shopper@example.com", name = "Shopper") {
  const res = await request(app).post("/api/auth/register").send({ name, email, password: "Passw0rd!" });
  const cookie = ((res.headers["set-cookie"] as unknown as string[]) ?? []).find((c) => c.startsWith("nc_refresh=")) ?? "";
  return {
    token: res.body.accessToken as string,
    user: res.body.user as { id: string; email: string; role: string },
    cookie: cookie.split(";")[0] ?? "",
    status: res.status,
  };
}

/** Creates an admin directly in the database, then logs in through the API to get a real token. */
export async function signInAdmin(app: ReturnType<typeof createApp>, email = "boss@example.com") {
  await User.create({ name: "Boss", email, passwordHash: await bcrypt.hash("Adm1nPass!", 4), role: "admin" });
  const res = await request(app).post("/api/auth/login").send({ email, password: "Adm1nPass!" });
  return { token: res.body.accessToken as string, user: res.body.user as { id: string } };
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

let counter = 0;
export async function makeProduct(over: Record<string, unknown> = {}) {
  counter += 1;
  return Product.create({
    name: `Product ${counter}`,
    slug: `product-${counter}`,
    description: "A product for testing the store.",
    price: 1000,
    category: "Home",
    stock: 10,
    images: [{ url: `https://images.test/${counter}.png`, publicId: `p${counter}` }],
    ...over,
  });
}
