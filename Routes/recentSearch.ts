import express, { Request, Response } from "express";
import { Types } from "mongoose";
import User from "../Models/UserSchema";
import userAuth from "../Middlewares/userAuth";
import { logApiError } from "../utils/logger";

const recentSearchRouter = express.Router();

/**
 * GET /profile/recent-searches
 * - Requires userAuth
 * - Returns the user's recent searched profiles
 */
recentSearchRouter.get(
  "/profile/recent-searches",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await User.findById(req.user._id)
        .select("recentSearches")
        .populate("recentSearches.userId", "name emailId photoURL statusMessage")
        .lean();

      const recent = (user?.recentSearches || []).map((entry) => ({
        searchedAt: entry.searchedAt,
        user: entry.userId
          ? {
              _id: String((entry.userId as any)._id || ""),
              name: (entry.userId as any).name,
              emailId: (entry.userId as any).emailId,
              photoURL: (entry.userId as any).photoURL,
              statusMessage: (entry.userId as any).statusMessage,
            }
          : null,
      }));

      return res.status(200).json({ recent });
    } catch (err: any) {
      logApiError(req, err, { route: "GET /profile/recent-searches" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);

/**
 * POST /profile/recent-searches
 * - Requires userAuth
 * - Adds a user to the recent search list (max 10)
 */
recentSearchRouter.post(
  "/profile/recent-searches",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const targetUserId = String(req.body?.userId || "");
      if (!Types.ObjectId.isValid(targetUserId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }

      if (String(req.user._id) === targetUserId) {
        return res.status(200).json({ status: "ignored" });
      }

      const targetObjectId = new Types.ObjectId(targetUserId);

      await User.updateOne(
        { _id: req.user._id },
        { $pull: { recentSearches: { userId: targetObjectId } } }
      );

      await User.updateOne(
        { _id: req.user._id },
        {
          $push: {
            recentSearches: {
              $each: [{ userId: targetObjectId, searchedAt: new Date() }],
              $position: 0,
              $slice: 10,
            },
          },
        }
      );

      return res.status(200).json({ status: "ok" });
    } catch (err: any) {
      logApiError(req, err, { route: "POST /profile/recent-searches" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);

/**
 * DELETE /profile/recent-searches/:userId
 * - Requires userAuth
 * - Removes a user from the recent search list
 */
recentSearchRouter.delete(
  "/profile/recent-searches",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      await User.updateOne(
        { _id: req.user._id }, 
        { $set: { recentSearches: [] } }
    );

      return res.status(200).json({ status: "ok" });
    } catch (err: any) {
      logApiError(req, err, { route: "DELETE /profile/recent-searches" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);

/**
 * DELETE /profile/recent-searches/:userId
 * - Requires userAuth
 * - Removes a user from the recent search list
 */
recentSearchRouter.delete(
  "/profile/recent-searches/:userId",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const targetUserId = String(req.params.userId);
      if (!Types.ObjectId.isValid(targetUserId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }

      const targetObjectId = new Types.ObjectId(targetUserId);

      await User.updateOne(
        { _id: req.user._id },
        { $pull: { recentSearches: { userId: targetObjectId } } }
      );

      return res.status(200).json({ status: "ok" });
    } catch (err: any) {
      logApiError(req, err, { route: "DELETE /profile/recent-searches/:userId" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);




export default recentSearchRouter;
