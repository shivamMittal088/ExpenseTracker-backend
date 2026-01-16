import { NextFunction, Request, Response } from "express";
import { axiomReady, sendLog } from "../config/axiomClient";

export const axiomRequestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!axiomReady) {
    return next();
  }

  const start = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    void sendLog({
      type: "http_request",
      level,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: durationMs,
      ip: req.ip,
      userAgent: req.get("user-agent") || undefined,
    });
  });

  next();
};
