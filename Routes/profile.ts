import express, { Request, Response, NextFunction } from "express";
import User from "../Models/UserSchema";
import LoginHistory from "../Models/LoginHistorySchema";
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

/**
 * PATCH /profile/update
 * - Requires userAuth middleware to populate req.user
 * - Updates allowed fields: name, statusMessage, currency, preferences
 */
profileRouter.patch(
  "/profile/update",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const loggedInUserId = req.user._id;
      const { name, statusMessage, currency, preferences } = req.body;

      // Build update object with only allowed fields
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (statusMessage !== undefined) updateData.statusMessage = statusMessage;
      if (currency !== undefined) updateData.currency = currency;
      if (preferences !== undefined) updateData.preferences = preferences;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      const updatedProfile = await User.findByIdAndUpdate(
        loggedInUserId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select("-password").lean();

      if (!updatedProfile) {
        return res.status(404).json({ message: "User not found" });
      }

      logEvent("info", "Profile updated", {
        route: "PATCH /profile/update",
        userId: loggedInUserId,
        fields: Object.keys(updateData),
      });

      return res.status(200).json(updatedProfile);
    } catch (err: any) {
      logApiError(req, err, { route: "PATCH /profile/update" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);

/**
 * GET /profile/login-history
 * - Requires userAuth middleware
 * - Returns the user's recent login history (last 20)
 */
profileRouter.get(
  "/profile/login-history",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const loggedInUserId = req.user._id;

      const history = await LoginHistory.find({ userId: loggedInUserId })
        .sort({ loginAt: -1 })
        .limit(20)
        .lean();

      logEvent("info", "Login history fetched", {
        route: "GET /profile/login-history",
        userId: loggedInUserId,
        count: history.length,
      });

      return res.status(200).json(history);
    } catch (err: any) {
      logApiError(req, err, { route: "GET /profile/login-history" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);

export default profileRouter;



// What .lean() does (Mongoose)

// .lean() tells Mongoose to return plain JavaScript objects instead of Mongoose Document instances.
// Plain objects are faster and use less memory because Mongoose skips building full document objects with getters/setters, change tracking, and instance methods.