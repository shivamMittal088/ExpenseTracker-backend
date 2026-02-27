import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import User from "../Models/UserSchema";
import { getRedisClient, isRedisReady } from "../config/redisClient";

/* ---- JWT Payload Type ---- */
interface MyJwtPayload extends JwtPayload {
  _id: string;
}

/* ---- Extend Express Request ---- */
interface AuthRequest extends Request {
  user?: any;
}

const JWT_SECRET = "MYSecretKey";
const SESSION_CACHE_TTL = 300; // 5 minutes in seconds
const getSessionKey = (userId: string) => `user:session:${userId}`;

const userAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Check cookie first, then Authorization header as fallback (for iOS)
    let token = req.cookies?.token;
    
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    // 1️⃣ No token found anywhere
    if (!token) {
      return res.status(401).json({ code: "NO_TOKEN" });
    }

    // 2️⃣ Verify JWT
    let decoded: MyJwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as MyJwtPayload;
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ code: "SESSION_EXPIRED" });
      }
      return res.status(401).json({ code: "INVALID_TOKEN" });
    }

    // 3️⃣ Check Redis session cache
    if (isRedisReady()) {
      try {
        const cached = await getRedisClient().get(getSessionKey(decoded._id));
        if (cached) {
          req.user = JSON.parse(cached);
          return next();
        }
      } catch {
        // Redis error → fall through to MongoDB
      }
    }

    // 4️⃣ Cache miss or Redis down → load from MongoDB
    const user = await User.findById(decoded._id)
      .select("_id name emailId")
      .lean();
    if (!user) {
      return res.status(401).json({ code: "INVALID_USER" });
    }

    // Minimal object with only the fields routes actually use
    const sessionUser = {
      _id: String(user._id),
      name: user.name,
      emailId: user.emailId,
    };

    // 5️⃣ Write to Redis cache (fire-and-forget)
    if (isRedisReady()) {
      getRedisClient()
        .set(getSessionKey(sessionUser._id), JSON.stringify(sessionUser), { EX: SESSION_CACHE_TTL })
        .catch(() => {});
    }

    // 6️⃣ Attach user to request
    req.user = sessionUser;
    next();
  } catch (err) {
    return res.status(401).json({ code: "AUTH_FAILED" });
  }
};

export default userAuth;

/**
 * Invalidate the cached session for a user.
 * Call on: logout, password change, profile update, privacy toggle.
 */
export const invalidateUserSession = async (userId: string): Promise<void> => {
  if (isRedisReady()) {
    try {
      await getRedisClient().del(getSessionKey(userId));
    } catch {
      // Silently ignore — next request will just hit MongoDB
    }
  }
};
