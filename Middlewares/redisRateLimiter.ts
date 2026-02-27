import { NextFunction, Request, Response } from "express";
import { getRedisClient, isRedisReady } from "../config/redisClient";

type RateLimitOptions = {
  keyPrefix: string;
  maxRequests: number;
  windowMs: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
};

const defaultKeyGenerator = (req: Request): string => {
  const userId = req.user?._id ? String(req.user._id) : "anonymous";
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `${userId}:${ip}`;
};

export const createRedisRateLimiter = (options: RateLimitOptions) => {
  const {
    keyPrefix,
    maxRequests,
    windowMs,
    message = "Too many requests, please try again later.",
    keyGenerator = defaultKeyGenerator,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isRedisReady()) {
      return next();
    }

    try {
      const key = `${keyPrefix}:${keyGenerator(req)}`;
      const client = getRedisClient();

      const currentCount = await client.incr(key);
      if (currentCount === 1) {
        await client.pExpire(key, windowMs);
      }

      const ttlMs = await client.pTTL(key);
      const retryAfterSeconds = Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : windowMs) / 1000));

      res.setHeader("X-RateLimit-Limit", String(maxRequests));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, maxRequests - currentCount)));
      res.setHeader("X-RateLimit-Reset", String(retryAfterSeconds));

      if (currentCount > maxRequests) {
        res.setHeader("Retry-After", String(retryAfterSeconds));
        return res.status(429).json({
          message,
          retryAfterSeconds,
        });
      }

      return next();
    } catch {
      return next();
    }
  };
};
