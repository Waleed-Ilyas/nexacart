import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { CookieOptions } from "express";

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const REFRESH_COOKIE = "nc_refresh";

export type AccessClaims = { sub: string; role: "user" | "admin" };

export function signAccessToken(secret: string, userId: string, role: "user" | "admin"): string {
  return jwt.sign({ role }, secret, { subject: userId, expiresIn: ACCESS_TTL_SECONDS, algorithm: "HS256" });
}

/** Returns the claims, or null for any invalid, expired or wrongly signed token. */
export function verifyAccessToken(secret: string, token: string): AccessClaims | null {
  try {
    const p = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (typeof p === "string" || typeof p.sub !== "string" || (p.role !== "user" && p.role !== "admin")) return null;
    return { sub: p.sub, role: p.role };
  } catch {
    return null;
  }
}

export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** 48 random bytes. Only the hash is stored server side. */
export function newRefreshToken() {
  const token = crypto.randomBytes(48).toString("base64url");
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) };
}

export function refreshCookieOptions(production: boolean): CookieOptions {
  return { httpOnly: true, secure: production, sameSite: "lax", path: "/api/auth", maxAge: REFRESH_TTL_MS };
}
