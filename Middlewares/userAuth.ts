import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import User from "../Models/UserSchema";

/* ---- JWT Payload Type ---- */
interface MyJwtPayload extends JwtPayload {
  _id: string;
}

/* ---- Extend Express Request ---- */
interface AuthRequest extends Request {
  user?: any;
}

const JWT_SECRET = "MYSecretKey";

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

    // 5️⃣ Load user
    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(401).json({ code: "INVALID_USER" });
    }

    // 6️⃣ Attach user to request
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ code: "AUTH_FAILED" });
  }
};

export default userAuth;
