import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { TEST_ENV, api, bearer, signUp, useTestApp } from "./helpers";

const t = useTestApp();

describe("register", () => {
  it("creates an account, returns a short-lived access token and sets an httpOnly refresh cookie", async () => {
    const res = await request(t.app).post("/api/auth/register").send({ name: "Ada", email: "Ada@Example.com", password: "Passw0rd!" });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: "Ada", email: "ada@example.com", role: "user" });
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookie = (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("nc_refresh="))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    const claims = jwt.verify(res.body.accessToken, TEST_ENV.JWT_SECRET) as jwt.JwtPayload;
    expect(claims.role).toBe("user");
    expect(claims.exp! - claims.iat!).toBe(15 * 60);
  });

  it("never lets a client choose its own role", async () => {
    const res = await request(t.app).post("/api/auth/register").send({ name: "Eve", email: "eve@example.com", password: "Passw0rd!", role: "admin" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("user");
  });

  it("rejects a duplicate email with 409", async () => {
    await signUp(t.app, "dup@example.com");
    const again = await signUp(t.app, "dup@example.com");
    expect(again.status).toBe(409);
  });

  it("reports which fields are wrong", async () => {
    const res = await request(t.app).post("/api/auth/register").send({ name: "", email: "nope", password: "short" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(["email", "name", "password"]);
  });

  it("requires a letter and a number in the password", async () => {
    const res = await request(t.app).post("/api/auth/register").send({ name: "A", email: "a@example.com", password: "onlyletters" });
    expect(res.status).toBe(400);
    expect(res.body.fields.password).toMatch(/number/);
  });
});

describe("login", () => {
  it("accepts the right password and rejects the wrong one with the same message as an unknown email", async () => {
    await signUp(t.app, "login@example.com");
    const ok = await request(t.app).post("/api/auth/login").send({ email: "login@example.com", password: "Passw0rd!" });
    expect(ok.status).toBe(200);
    const wrong = await request(t.app).post("/api/auth/login").send({ email: "login@example.com", password: "Wrong-pass1" });
    const unknown = await request(t.app).post("/api/auth/login").send({ email: "ghost@example.com", password: "Wrong-pass1" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });
});

describe("access tokens", () => {
  it("/me needs a valid bearer token", async () => {
    expect((await api(t.app).get("/api/auth/me")).status).toBe(401);
    expect((await api(t.app).get("/api/auth/me").set(bearer("garbage"))).status).toBe(401);
    const { token } = await signUp(t.app);
    const me = await api(t.app).get("/api/auth/me").set(bearer(token));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("shopper@example.com");
  });

  it("rejects expired tokens, tokens signed with another secret, and unsigned tokens", async () => {
    const { user } = await signUp(t.app);
    const expired = jwt.sign({ role: "user" }, TEST_ENV.JWT_SECRET, { subject: user.id, expiresIn: -10 });
    const foreign = jwt.sign({ role: "admin" }, "a-different-secret-a-different-secret-1", { subject: user.id, expiresIn: 60 });
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: user.id, role: "admin" })).toString("base64url")}.`;
    for (const token of [expired, foreign, none]) expect((await api(t.app).get("/api/auth/me").set(bearer(token))).status).toBe(401);
  });
});

describe("refresh tokens", () => {
  it("issues a new access token and rotates the cookie, so the old cookie stops working", async () => {
    const { cookie: first } = await signUp(t.app);
    const res = await request(t.app).post("/api/auth/refresh").set("Cookie", first);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    const second = (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("nc_refresh="))!.split(";")[0]!;
    expect(second).not.toBe(first);
    expect((await request(t.app).post("/api/auth/refresh").set("Cookie", first)).status).toBe(401);
    expect((await request(t.app).post("/api/auth/refresh").set("Cookie", second)).status).toBe(200);
  });

  it("returns 401 without a cookie", async () => {
    expect((await request(t.app).post("/api/auth/refresh")).status).toBe(401);
  });

  it("logout invalidates the refresh token", async () => {
    const { cookie } = await signUp(t.app);
    expect((await request(t.app).post("/api/auth/logout").set("Cookie", cookie)).status).toBe(200);
    expect((await request(t.app).post("/api/auth/refresh").set("Cookie", cookie)).status).toBe(401);
  });

  it("keeps at most 5 sessions per user", async () => {
    const { cookie, user } = await signUp(t.app, "many@example.com");
    void cookie;
    for (let i = 0; i < 7; i++) await request(t.app).post("/api/auth/login").send({ email: "many@example.com", password: "Passw0rd!" });
    const { User } = await import("../src/models/User");
    const doc = await User.findById(user.id).select("+refreshTokens");
    expect(doc!.refreshTokens.length).toBe(5);
  });
});
