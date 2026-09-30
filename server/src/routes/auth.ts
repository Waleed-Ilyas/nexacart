import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { Config } from "../config";
import { AppError } from "../lib/errors";
import { userJson } from "../lib/serialize";
import { REFRESH_COOKIE, hashToken, newRefreshToken, refreshCookieOptions, signAccessToken } from "../lib/tokens";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/User";

const Register = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: z.email("Enter a valid email address.").max(120),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(72, "Use at most 72 characters.")
    .regex(/[A-Za-z]/, "Include at least one letter.")
    .regex(/\d/, "Include at least one number."),
});
const Login = z.object({ email: z.email("Enter a valid email address."), password: z.string().min(1, "Enter your password.").max(72) });

// Compared against when the email is unknown, so a missing account and a wrong password take the same time.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);
const MAX_SESSIONS = 5;

export function authRouter(config: Config) {
  const router = Router();
  const production = config.NODE_ENV === "production";
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => config.NODE_ENV === "test",
    message: { error: "Too many attempts. Try again in a few minutes." },
  });

  /** Creates a session: stores the hash of a fresh refresh token, sets the cookie, returns the short-lived access token. */
  async function startSession(res: Response, user: { _id: unknown; role: "user" | "admin"; name: string; email: string }) {
    const refresh = newRefreshToken();
    await User.updateOne(
      { _id: user._id },
      [
        {
          $set: {
            refreshTokens: {
              $slice: [
                {
                  $concatArrays: [
                    { $filter: { input: { $ifNull: ["$refreshTokens", []] }, cond: { $gt: ["$$this.expiresAt", "$$NOW"] } } },
                    [{ hash: refresh.hash, expiresAt: refresh.expiresAt }],
                  ],
                },
                -MAX_SESSIONS,
              ],
            },
          },
        },
      ],
      { updatePipeline: true },
    );
    res.cookie(REFRESH_COOKIE, refresh.token, refreshCookieOptions(production));
    return { accessToken: signAccessToken(config.JWT_SECRET, String(user._id), user.role), user: userJson(user) };
  }

  router.post("/register", limiter, async (req, res) => {
    const body = Register.parse(req.body);
    const email = body.email.toLowerCase();
    if (await User.exists({ email })) throw new AppError(409, "An account with this email already exists.", "email_taken");
    const user = await User.create({ name: body.name, email, passwordHash: await bcrypt.hash(body.password, 10), role: "user" });
    res.status(201).json(await startSession(res, user));
  });

  router.post("/login", limiter, async (req, res) => {
    const body = Login.parse(req.body);
    const user = await User.findOne({ email: body.email.toLowerCase() }).select("+passwordHash");
    const ok = await bcrypt.compare(body.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new AppError(401, "Wrong email or password.", "bad_credentials");
    res.json(await startSession(res, user));
  });

  // Rotation: the presented token is removed and a new one issued, so a stolen cookie works at most once.
  router.post("/refresh", async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (typeof token !== "string" || !token) throw new AppError(401, "Session expired. Please sign in again.", "no_session");
    const hash = hashToken(token);
    const user = await User.findOneAndUpdate({ "refreshTokens.hash": hash }, { $pull: { refreshTokens: { hash } } }, { returnDocument: "before" }).select(
      "+refreshTokens",
    );
    const stored = user?.refreshTokens.find((t) => t.hash === hash);
    if (!user || !stored || stored.expiresAt.getTime() < Date.now()) {
      res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(production), maxAge: undefined });
      throw new AppError(401, "Session expired. Please sign in again.", "no_session");
    }
    res.json(await startSession(res, user));
  });

  router.post("/logout", async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (typeof token === "string" && token)
      await User.updateOne({ "refreshTokens.hash": hashToken(token) }, { $pull: { refreshTokens: { hash: hashToken(token) } } });
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(production), maxAge: undefined });
    res.json({ ok: true });
  });

  router.get("/me", requireAuth(config), async (req, res) => {
    const user = await User.findById(req.auth!.id);
    if (!user) throw new AppError(401, "Please sign in to continue.", "unauthenticated");
    res.json({ user: userJson(user) });
  });

  return router;
}
