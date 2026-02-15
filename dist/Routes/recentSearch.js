"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = require("mongoose");
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const logger_1 = require("../utils/logger");
const recentSearchRouter = express_1.default.Router();
/**
 * GET /profile/recent-searches
 * - Requires userAuth
 * - Returns the user's recent searched profiles
 */
recentSearchRouter.get("/profile/recent-searches", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const user = await UserSchema_1.default.findById(req.user._id)
            .select("recentSearches")
            .populate("recentSearches.userId", "name emailId photoURL statusMessage")
            .lean();
        const recent = (user?.recentSearches || []).map((entry) => ({
            searchedAt: entry.searchedAt,
            user: entry.userId
                ? {
                    _id: String(entry.userId._id || ""),
                    name: entry.userId.name,
                    emailId: entry.userId.emailId,
                    photoURL: entry.userId.photoURL,
                    statusMessage: entry.userId.statusMessage,
                }
                : null,
        }));
        return res.status(200).json({ recent });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /profile/recent-searches" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * POST /profile/recent-searches
 * - Requires userAuth
 * - Adds a user to the recent search list (max 10)
 */
recentSearchRouter.post("/profile/recent-searches", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const targetUserId = String(req.body?.userId || "");
        if (!mongoose_1.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ message: "Invalid user id" });
        }
        if (String(req.user._id) === targetUserId) {
            return res.status(200).json({ status: "ignored" });
        }
        const targetObjectId = new mongoose_1.Types.ObjectId(targetUserId);
        await UserSchema_1.default.updateOne({ _id: req.user._id }, { $pull: { recentSearches: { userId: targetObjectId } } });
        await UserSchema_1.default.updateOne({ _id: req.user._id }, {
            $push: {
                recentSearches: {
                    $each: [{ userId: targetObjectId, searchedAt: new Date() }],
                    $position: 0,
                    $slice: 10,
                },
            },
        });
        return res.status(200).json({ status: "ok" });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /profile/recent-searches" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * DELETE /profile/recent-searches/:userId
 * - Requires userAuth
 * - Removes a user from the recent search list
 */
recentSearchRouter.delete("/profile/recent-searches", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        await UserSchema_1.default.updateOne({ _id: req.user._id }, { $set: { recentSearches: [] } });
        return res.status(200).json({ status: "ok" });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "DELETE /profile/recent-searches" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * DELETE /profile/recent-searches/:userId
 * - Requires userAuth
 * - Removes a user from the recent search list
 */
recentSearchRouter.delete("/profile/recent-searches/:userId", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const targetUserId = String(req.params.userId);
        if (!mongoose_1.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ message: "Invalid user id" });
        }
        const targetObjectId = new mongoose_1.Types.ObjectId(targetUserId);
        await UserSchema_1.default.updateOne({ _id: req.user._id }, { $pull: { recentSearches: { userId: targetObjectId } } });
        return res.status(200).json({ status: "ok" });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "DELETE /profile/recent-searches/:userId" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
exports.default = recentSearchRouter;
