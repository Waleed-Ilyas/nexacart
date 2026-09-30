import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../lib/errors";
import { verifyAccessToken } from "../lib/tokens";
import { User } from "../models/User";
import type { Config } from "../config";

export type Auth = { id: string; role: "user" | "admin" };
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: Auth;
    }
  }
}

/** Reads `Authorization: Bearer <access token>`. Missing, malformed and expired tokens all give the same 401. */
export const requireAuth =
  (config: Config): RequestHandler =>
  (req, _res, next) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const claims = token ? verifyAccessToken(config.JWT_SECRET, token) : null;
    if (!claims) throw new AppError(401, "Please sign in to continue.", "unauthenticated");
    req.auth = { id: claims.sub, role: claims.role };
    next();
  };

export const requireRole =
  (role: "admin"): RequestHandler =>
  (req, _res, next) => {
    if (req.auth?.role !== role) throw new AppError(403, "You do not have access to this.", "forbidden");
    next();
  };

/**
 * The public demo publishes the admin login, so on the live site product changes are switched off for that one
 * account. Order status changes and every read stay available. Real admins are unaffected.
 */
export const demoAdminGuard =
  (config: Config): RequestHandler =>
  async (req: Request, _res: Response, next: NextFunction) => {
    if (config.DEMO_ADMIN_READONLY && req.auth) {
      const u = await User.findById(req.auth.id).select("email").lean();
      if (u?.email === config.DEMO_ADMIN_EMAIL.toLowerCase())
        throw new AppError(403, "The public demo admin is read-only for product changes.", "demo_readonly");
    }
    next();
  };
