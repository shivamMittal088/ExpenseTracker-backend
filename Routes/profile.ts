import express, { Request, Response, NextFunction } from "express";
import User from "../Models/UserSchema";
import userAuth from "../Middlewares/userAuth";
import { IUser } from "../Models/UserSchema";
import { logApiError, logEvent } from "../utils/logger";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

const profileRouter = express.Router();

/**
 * GET /profile
 * - Requires userAuth middleware to populate req.user
 * - Returns the logged-in user's profile (password excluded)
 *
 * If you prefer to keep your original path, change to "/profile/view".
 */
profileRouter.get(
  "/profile/view",
  userAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const loggedInUserId = req.user._id;

      // Query fresh data from DB and exclude password
      const profile = await User.findById(loggedInUserId).select("-password").lean();

      if (!profile) {
        return res.status(404).json({ message: "User not found" });
      }

      logEvent("info", "Profile fetched", {
        route: "GET /profile/view",
        userId: loggedInUserId,
      });

      return res.status(200).json(profile);
    } catch (err: any) {
      logApiError(req, err, { route: "GET /profile/view" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);

export default profileRouter;



// What .lean() does (Mongoose)

// .lean() tells Mongoose to return plain JavaScript objects instead of Mongoose Document instances.
// Plain objects are faster and use less memory because Mongoose skips building full document objects with getters/setters, change tracking, and instance methods.