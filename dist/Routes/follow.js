"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = require("mongoose");
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const FollowSchema_1 = __importDefault(require("../Models/FollowSchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const logger_1 = require("../utils/logger");
const followRouter = express_1.default.Router();
/**
 * POST /profile/follow/:userId
 * - Requires userAuth
 * - Creates a follow request (pending)
 */
followRouter.post("/profile/follow/:userId", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const targetUserId = String(req.params.userId);
        const followerId = req.user._id;
        if (!mongoose_1.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ message: "Invalid user id" });
        }
        const targetObjectId = new mongoose_1.Types.ObjectId(targetUserId);
        if (String(followerId) === targetUserId) {
            return res.status(400).json({ message: "You cannot follow yourself" });
        }
        const target = await UserSchema_1.default.findById(targetUserId).select("_id").lean();
        if (!target) {
            return res.status(404).json({ message: "User not found" });
        }
        const existing = await FollowSchema_1.default.findOne({ followerId, followingId: targetObjectId }).lean();
        if (existing) {
            return res.status(200).json({ status: existing.status });
        }
        const rawNote = typeof req.body?.note === "string" ? req.body.note.trim() : "";
        const note = rawNote.length > 0 ? rawNote.slice(0, 200) : undefined;
        const follow = await FollowSchema_1.default.create({
            followerId,
            followingId: targetObjectId,
            status: "pending",
            ...(note ? { note } : {}),
        });
        (0, logger_1.logEvent)("info", "Follow request created", {
            route: "POST /profile/follow/:userId",
            userId: followerId,
            targetUserId,
        });
        return res.status(201).json({ status: follow.status });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /profile/follow/:userId" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * DELETE /profile/follow/:userId
 * - Requires userAuth
 * - Cancels a pending follow request
 */
followRouter.delete("/profile/follow/:userId", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const targetUserId = String(req.params.userId);
        const followerId = req.user._id;
        if (!mongoose_1.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ message: "Invalid user id" });
        }
        const targetObjectId = new mongoose_1.Types.ObjectId(targetUserId);
        const deleted = await FollowSchema_1.default.findOneAndDelete({
            followerId,
            followingId: targetObjectId,
            status: "pending",
        }).lean();
        if (!deleted) {
            return res.status(404).json({ message: "Pending request not found" });
        }
        (0, logger_1.logEvent)("info", "Follow request cancelled", {
            route: "DELETE /profile/follow/:userId",
            userId: followerId,
            targetUserId,
        });
        return res.status(200).json({ status: "none" });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "DELETE /profile/follow/:userId" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * GET /profile/follow-status/:userId
 * - Requires userAuth
 * - Returns follow status to target user
 */
followRouter.get("/profile/follow-status/:userId", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const targetUserId = String(req.params.userId);
        const followerId = req.user._id;
        if (!mongoose_1.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ message: "Invalid user id" });
        }
        const targetObjectId = new mongoose_1.Types.ObjectId(targetUserId);
        const follow = await FollowSchema_1.default.findOne({ followerId, followingId: targetObjectId }).lean();
        if (!follow) {
            return res.status(200).json({ status: "none" });
        }
        return res.status(200).json({ status: follow.status });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /profile/follow-status/:userId" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * GET /profile/follow-requests
 * - Requires userAuth
 * - Returns pending follow requests for the logged-in user
 */
followRouter.get("/profile/follow-requests", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const requests = await FollowSchema_1.default.find({
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
                    _id: String(request.followerId._id || ""),
                    name: request.followerId.name,
                    emailId: request.followerId.emailId,
                    photoURL: request.followerId.photoURL,
                }
                : null,
        }));
        return res.status(200).json({ requests: results });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /profile/follow-requests" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * POST /profile/follow-requests/:requestId/accept
 * - Requires userAuth
 * - Accepts a pending follow request
 */
followRouter.post("/profile/follow-requests/:requestId/accept", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const requestId = String(req.params.requestId);
        if (!mongoose_1.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ message: "Invalid request id" });
        }
        const updated = await FollowSchema_1.default.findOneAndUpdate({
            _id: requestId,
            followingId: req.user._id,
            status: "pending",
        }, { $set: { status: "accepted" } }, { new: true }).lean();
        if (!updated) {
            return res.status(404).json({ message: "Pending request not found" });
        }
        (0, logger_1.logEvent)("info", "Follow request accepted", {
            route: "POST /profile/follow-requests/:requestId/accept",
            userId: req.user._id,
            requestId,
        });
        return res.status(200).json({ status: "accepted" });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /profile/follow-requests/:requestId/accept" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * DELETE /profile/follow-requests/:requestId
 * - Requires userAuth
 * - Declines a pending follow request
 */
followRouter.delete("/profile/follow-requests/:requestId", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const requestId = String(req.params.requestId);
        if (!mongoose_1.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ message: "Invalid request id" });
        }
        const deleted = await FollowSchema_1.default.findOneAndDelete({
            _id: requestId,
            followingId: req.user._id,
            status: "pending",
        }).lean();
        if (!deleted) {
            return res.status(404).json({ message: "Pending request not found" });
        }
        (0, logger_1.logEvent)("info", "Follow request declined", {
            route: "DELETE /profile/follow-requests/:requestId",
            userId: req.user._id,
            requestId,
        });
        return res.status(200).json({ status: "declined" });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "DELETE /profile/follow-requests/:requestId" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * GET /profile/all-followers
 * - Requires userAuth
 * - Returns accepted followers for the logged-in user
 */
followRouter.get("/profile/all-followers", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const followers = await FollowSchema_1.default.find({
            followingId: req.user._id,
            status: "accepted",
        })
            .sort({ createdAt: -1 })
            .populate("followerId", "name emailId photoURL")
            .lean();
        const results = followers.map((follow) => ({
            id: String(follow._id),
            createdAt: follow.createdAt,
            follower: follow.followerId
                ? {
                    _id: String(follow.followerId._id || ""),
                    name: follow.followerId.name,
                    emailId: follow.followerId.emailId,
                    photoURL: follow.followerId.photoURL,
                }
                : null,
        }));
        return res.status(200).json({ followers: results });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /profile/all-followers" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * GET /profile/all-following
 * - Requires userAuth
 * - Returns accepted following for the logged-in user
 */
followRouter.get("/profile/all-following", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const following = await FollowSchema_1.default.find({
            followerId: req.user._id,
            status: "accepted",
        })
            .sort({ createdAt: -1 })
            .populate("followingId", "name emailId photoURL")
            .lean();
        const results = following.map((follow) => ({
            id: String(follow._id),
            createdAt: follow.createdAt,
            following: follow.followingId
                ? {
                    _id: String(follow.followingId._id || ""),
                    name: follow.followingId.name,
                    emailId: follow.followingId.emailId,
                    photoURL: follow.followingId.photoURL,
                }
                : null,
        }));
        return res.status(200).json({ following: results });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /profile/all-following" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
exports.default = followRouter;
