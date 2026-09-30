import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found." });
};

// Express 5 forwards rejected promises from async handlers here, so routes do not need try/catch.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "body";
      if (!(key in fields)) fields[key] = issue.message;
    }
    res.status(400).json({ error: "Please check the highlighted fields.", fields });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
    return;
  }
  if (err && typeof err === "object" && (err as { name?: string }).name === "CastError") {
    res.status(400).json({ error: "Invalid id." });
    return;
  }
  if (err && typeof err === "object" && (err as { type?: string }).type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large." });
    return;
  }
  if (err && typeof err === "object" && (err as { code?: string }).code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "The image is larger than 5 MB." });
    return;
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Something went wrong on our side. Please try again." });
};
