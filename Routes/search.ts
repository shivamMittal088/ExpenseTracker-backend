import express, { Request, Response } from "express";
import { Types } from "mongoose";
import User from "../Models/UserSchema";
import userAuth from "../Middlewares/userAuth";
import { logApiError } from "../utils/logger";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const DEFAULT_SEARCH_LIMIT = 8;
const MAX_SEARCH_LIMIT = 25;

const searchRouter = express.Router();

/**
 * GET /profile/recent-searches
 * - Requires userAuth
 * - Returns the user's recent searched profiles
 */
searchRouter.get(
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
searchRouter.post(
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
searchRouter.delete(
  "/profile/recent-searches",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      await User.updateOne({ _id: req.user._id }, { $set: { recentSearches: [] } });

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
searchRouter.delete(
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

/**
 * GET /profile/search-users
 * - Requires auth
 * - Optional query param `q` (min 2 chars) filters by name/email/status
 */
searchRouter.get(
  "/profile/search-users",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const rawQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (rawQuery && rawQuery.length < 2) {
        return res.status(400).json({ message: "Search query must be at least 2 characters" });
      }

      const parsedLimit = Number(req.query.limit);
      const limit = Math.min(
        Math.max(1, Number.isNaN(parsedLimit) ? DEFAULT_SEARCH_LIMIT : parsedLimit),
        MAX_SEARCH_LIMIT
      );

      const baseFilter: Record<string, unknown> = { _id: { $ne: req.user._id } };

      const filter = rawQuery
        ? {
            ...baseFilter,
            $or: [
              { name: { $regex: new RegExp(escapeRegex(rawQuery), "i") } },
              { emailId: { $regex: new RegExp(escapeRegex(rawQuery), "i") } },
              { statusMessage: { $regex: new RegExp(escapeRegex(rawQuery), "i") } },
            ],
          }
        : baseFilter;

      const users = await User.find(filter)
        .select("name emailId photoURL statusMessage createdAt updatedAt")
        .sort((rawQuery ? { createdAt: -1 } : { updatedAt: -1 }) as Record<string, 1 | -1>)
        .limit(limit)
        .lean();

      const results = users.map((user) => ({
        _id: user._id,
        name: user.name,
        emailId: user.emailId,
        photoURL: user.photoURL,
        statusMessage: user.statusMessage,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

      return res.status(200).json({ query: rawQuery, results });
    } catch (err: any) {
      logApiError(req, err, { route: "GET /profile/search-users" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);

export default searchRouter;
