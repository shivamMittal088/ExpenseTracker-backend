import express, { Request, Response } from "express";
import { Types } from "mongoose";
import User from "../Models/UserSchema";
import Follow from "../Models/FollowSchema";
import userAuth from "../Middlewares/userAuth";
import { logApiError, logEvent } from "../utils/logger";

const followRouter = express.Router();

const FOLLOW_PAGE_SIZE = 20;

type FollowCursor = {
  createdAt: string;
  id: string;
};

const encodeCursor = (cursor: FollowCursor) =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64");

const decodeCursor = (value: string): FollowCursor | null => {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64").toString("utf8")) as FollowCursor;
    if (!parsed?.createdAt || !parsed?.id) {
      return null;
    }
    if (!Types.ObjectId.isValid(parsed.id)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

/**
 * POST /profile/follow/:userId
 * - Requires userAuth
 * - Creates a follow request (pending)
 */
followRouter.post(
  "/profile/follow/:userId",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const targetUserId = String(req.params.userId);
      const followerId = req.user._id;

      if (!Types.ObjectId.isValid(targetUserId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }
      const targetObjectId = new Types.ObjectId(targetUserId);

      if (String(followerId) === targetUserId) {
        return res.status(400).json({ message: "You cannot follow yourself" });
      }

      const target = await User.findById(targetUserId).select("_id").lean();
      if (!target) {
        return res.status(404).json({ message: "User not found" });
      }

      const existing = await Follow.findOne({ followerId, followingId: targetObjectId }).lean();
      if (existing) {
        return res.status(200).json({ status: existing.status });
      }

      const rawNote = typeof req.body?.note === "string" ? req.body.note.trim() : "";
      const note = rawNote.length > 0 ? rawNote.slice(0, 200) : undefined;

      const follow = await Follow.create({
        followerId,
        followingId: targetObjectId,
        status: "pending",
        ...(note ? { note } : {}),
      });

      logEvent("info", "Follow request created", {
        route: "POST /profile/follow/:userId",
        userId: followerId,
        targetUserId,
      });

      return res.status(201).json({ status: follow.status });
    } catch (err: any) {
      logApiError(req, err, { route: "POST /profile/follow/:userId" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);

/**
 * DELETE /profile/follow/:userId
 * - Requires userAuth
 * - Cancels a pending follow request or unfollows an accepted user
 */
followRouter.delete(
  "/profile/follow/:userId",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const targetUserId = String(req.params.userId);
      const followerId = req.user._id;

      if (!Types.ObjectId.isValid(targetUserId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }
      const targetObjectId = new Types.ObjectId(targetUserId);

      const deleted = await Follow.findOneAndDelete({
        followerId,
        followingId: targetObjectId,
        status: { $in: ["pending", "accepted"] },
      }).lean();

      if (!deleted) {
        return res.status(404).json({ message: "Follow relationship not found" });
      }

      logEvent("info", "Follow removed", {
        route: "DELETE /profile/follow/:userId",
        userId: followerId,
        targetUserId,
        previousStatus: deleted.status,
      });

      return res.status(200).json({ status: "none" });
    } catch (err: any) {
      logApiError(req, err, { route: "DELETE /profile/follow/:userId" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);

/**
 * GET /profile/follow-status/:userId
 * - Requires userAuth
 * - Returns follow status to target user
 */
followRouter.get(
  "/profile/follow-status/:userId",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const targetUserId = String(req.params.userId);
      const followerId = req.user._id;

      if (!Types.ObjectId.isValid(targetUserId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }
      const targetObjectId = new Types.ObjectId(targetUserId);

      const follow = await Follow.findOne({ followerId, followingId: targetObjectId }).lean();
      if (!follow) {
        return res.status(200).json({ status: "none" });
      }

      return res.status(200).json({ status: follow.status });
    } catch (err: any) {
      logApiError(req, err, { route: "GET /profile/follow-status/:userId" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);

/**
 * GET /profile/follow-requests
 * - Requires userAuth
 * - Returns pending follow requests for the logged-in user
 */
followRouter.get(
  "/profile/follow-requests",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const requests = await Follow.find({
        followingId: req.user._id,
        status: "pending",
      })
        .sort({ createdAt: -1 })
        .populate("followerId", "name emailId photoURL")
        .lean();

      const results = requests.map((request) => ({
        id: String(request._id),
        note: request.note,
        createdAt: request.createdAt,
        follower: request.followerId
          ? {
              _id: String((request.followerId as any)._id || ""),
              name: (request.followerId as any).name,
              emailId: (request.followerId as any).emailId,
              photoURL: (request.followerId as any).photoURL,
            }
          : null,
      }));

      return res.status(200).json({ requests: results });
    } catch (err: any) {
      logApiError(req, err, { route: "GET /profile/follow-requests" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);

/**
 * POST /profile/follow-requests/:requestId/accept
 * - Requires userAuth
 * - Accepts a pending follow request
 */
followRouter.post(
  "/profile/follow-requests/:requestId/accept",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const requestId = String(req.params.requestId);
      if (!Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({ message: "Invalid request id" });
      }

      const updated = await Follow.findOneAndUpdate(
        {
          _id: requestId,
          followingId: req.user._id,
          status: "pending",
        },
        { $set: { status: "accepted" } },
        { new: true }
      ).lean();

      if (!updated) {
        return res.status(404).json({ message: "Pending request not found" });
      }

      logEvent("info", "Follow request accepted", {
        route: "POST /profile/follow-requests/:requestId/accept",
        userId: req.user._id,
        requestId,
      });

      return res.status(200).json({ status: "accepted" });
    } catch (err: any) {
      logApiError(req, err, { route: "POST /profile/follow-requests/:requestId/accept" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);

/**
 * DELETE /profile/follow-requests/:requestId
 * - Requires userAuth
 * - Declines a pending follow request
 */
followRouter.delete(
  "/profile/follow-requests/:requestId",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const requestId = String(req.params.requestId);
      if (!Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({ message: "Invalid request id" });
      }

      const deleted = await Follow.findOneAndDelete({
        _id: requestId,
        followingId: req.user._id,
        status: "pending",
      }).lean();

      if (!deleted) {
        return res.status(404).json({ message: "Pending request not found" });
      }

      logEvent("info", "Follow request declined", {
        route: "DELETE /profile/follow-requests/:requestId",
        userId: req.user._id,
        requestId,
      });

      return res.status(200).json({ status: "declined" });
    } catch (err: any) {
      logApiError(req, err, { route: "DELETE /profile/follow-requests/:requestId" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);

/**
 * GET /profile/all-followers
 * - Requires userAuth
 * - Returns accepted followers for the logged-in user
 */
followRouter.get(
  "/profile/all-followers",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const cursorValue = typeof req.query.cursor === "string" ? req.query.cursor : "";
      const cursor = cursorValue ? decodeCursor(cursorValue) : null;
      if (cursorValue && !cursor) {
        return res.status(400).json({ message: "Invalid cursor" });
      }

      const baseFilter: Record<string, unknown> = {
        followingId: req.user._id,
        status: "accepted",
      };

      const cursorFilter = cursor
        ? {
            $or: [
              { createdAt: { $lt: new Date(cursor.createdAt) } },
              {
                createdAt: new Date(cursor.createdAt),
                _id: { $lt: new Types.ObjectId(cursor.id) },
              },
            ],
          }
        : {};

      const followers = await Follow.find({
        ...baseFilter,
        ...cursorFilter,
      })
        .sort({ createdAt: -1, _id: -1 })
        .populate("followerId", "name emailId photoURL")
        .limit(FOLLOW_PAGE_SIZE)
        .lean();

      const results = followers.map((follow) => ({
        id: String(follow._id),
        createdAt: follow.createdAt,
        follower: follow.followerId
          ? {
              _id: String((follow.followerId as any)._id || ""),
              name: (follow.followerId as any).name,
              emailId: (follow.followerId as any).emailId,
              photoURL: (follow.followerId as any).photoURL,
            }
          : null,
      }));

      const last = followers[followers.length - 1];
      const nextCursor = last && followers.length === FOLLOW_PAGE_SIZE
        ? encodeCursor({ createdAt: new Date(last.createdAt).toISOString(), id: String(last._id) })
        : null;

      return res.status(200).json({ followers: results, nextCursor });
    } catch (err: any) {
      logApiError(req, err, { route: "GET /profile/all-followers" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);

/**
 * GET /profile/all-following
 * - Requires userAuth
 * - Returns accepted following for the logged-in user
 */
followRouter.get(
  "/profile/all-following",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const cursorValue = typeof req.query.cursor === "string" ? req.query.cursor : "";
      const cursor = cursorValue ? decodeCursor(cursorValue) : null;
      if (cursorValue && !cursor) {
        return res.status(400).json({ message: "Invalid cursor" });
      }

      const baseFilter: Record<string, unknown> = {
        followerId: req.user._id,
        status: "accepted",
      };

      const cursorFilter = cursor
        ? {
            $or: [
              { createdAt: { $lt: new Date(cursor.createdAt) } },
              {
                createdAt: new Date(cursor.createdAt),
                _id: { $lt: new Types.ObjectId(cursor.id) },
              },
            ],
          }
        : {};

      const following = await Follow.find({
        ...baseFilter,
        ...cursorFilter,
      })
        .sort({ createdAt: -1, _id: -1 })
        .populate("followingId", "name emailId photoURL")
        .limit(FOLLOW_PAGE_SIZE)
        .lean();

      const results = following.map((follow) => ({
        id: String(follow._id),
        createdAt: follow.createdAt,
        following: follow.followingId
          ? {
              _id: String((follow.followingId as any)._id || ""),
              name: (follow.followingId as any).name,
              emailId: (follow.followingId as any).emailId,
              photoURL: (follow.followingId as any).photoURL,
            }
          : null,
      }));

      const last = following[following.length - 1];
      const nextCursor = last && following.length === FOLLOW_PAGE_SIZE
        ? encodeCursor({ createdAt: new Date(last.createdAt).toISOString(), id: String(last._id) })
        : null;

      return res.status(200).json({ following: results, nextCursor });
    } catch (err: any) {
      logApiError(req, err, { route: "GET /profile/all-following" });
      return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
  }
);

export default followRouter;
