import { Request } from "express";
import { sendLog } from "../config/axiomClient";

export type LogLevel = "debug" | "info" | "warn" | "error";

const normalizeError = (err: unknown): Record<string, unknown> => {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }

  if (typeof err === "string") {
    return { message: err };
  }

  return { message: "Unknown error", raw: err };
};

export const logEvent = (
  level: LogLevel,
  message: string,
  meta: Record<string, unknown> = {},
): void => {
  void sendLog({
    level,
    message,
    ...meta,
  });

  if (process.env.NODE_ENV !== "production") {
    const method = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    method(`[${level}] ${message}`, meta);
  }
};

export const logApiError = (
  req: Request,
  err: unknown,
  meta: Record<string, unknown> = {},
): void => {
  logEvent("error", "API request failed", {
    type: "api_error",
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userId: (req as any).user?._id,
    error: normalizeError(err),
    ...meta,
  });
};
