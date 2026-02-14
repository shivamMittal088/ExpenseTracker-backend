"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = require("mongoose");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const LoginHistorySchema_1 = __importDefault(require("../Models/LoginHistorySchema"));
const ExpenseSchema_1 = __importDefault(require("../Models/ExpenseSchema"));
const FollowSchema_1 = __importDefault(require("../Models/FollowSchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const logger_1 = require("../utils/logger");
const multer_1 = require("../config/multer");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const DEFAULT_SEARCH_LIMIT = 8;
const MAX_SEARCH_LIMIT = 25;
const profileRouter = express_1.default.Router();
/**
 * GET /profile
 * - Requires userAuth middleware to populate req.user
 * - Returns the logged-in user's profile (password excluded)
 *
 * If you prefer to keep your original path, change to "/profile/view".
 */
profileRouter.get("/profile/view", userAuth_1.default, async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const loggedInUserId = req.user._id;
        // Query fresh data from DB and exclude password
        const profile = await UserSchema_1.default.findById(loggedInUserId).select("-password").lean();
        if (!profile) {
            return res.status(404).json({ message: "User not found" });
        }
        // Ensure monthlyIncome has a default value for older users who don't have the field
        const profileWithDefaults = {
            ...profile,
            monthlyIncome: profile.monthlyIncome ?? 0,
            dailyBudget: profile.dailyBudget ?? 0,
            currentStreak: profile.currentStreak ?? 0,
            longestStreak: profile.longestStreak ?? 0,
        };
        (0, logger_1.logEvent)("info", "Profile fetched", {
            route: "GET /profile/view",
            userId: loggedInUserId,
        });
        return res.status(200).json(profileWithDefaults);
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /profile/view" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * PATCH /profile/update
 * - Requires userAuth middleware to populate req.user
 * - Updates allowed fields: name, statusMessage, currency, preferences
 */
profileRouter.patch("/profile/update", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const loggedInUserId = req.user._id;
        const { name, statusMessage, currency, preferences, monthlyIncome, dailyBudget } = req.body;
        // Build update object with only allowed fields
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (statusMessage !== undefined)
            updateData.statusMessage = statusMessage;
        if (currency !== undefined)
            updateData.currency = currency;
        if (preferences !== undefined)
            updateData.preferences = preferences;
        if (monthlyIncome !== undefined)
            updateData.monthlyIncome = monthlyIncome;
        if (dailyBudget !== undefined)
            updateData.dailyBudget = dailyBudget;
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }
        const updatedProfile = await UserSchema_1.default.findByIdAndUpdate(loggedInUserId, { $set: updateData }, { new: true, runValidators: true }).select("-password").lean();
        if (!updatedProfile) {
            return res.status(404).json({ message: "User not found" });
        }
        (0, logger_1.logEvent)("info", "Profile updated", {
            route: "PATCH /profile/update",
            userId: loggedInUserId,
            fields: Object.keys(updateData),
        });
        return res.status(200).json(updatedProfile);
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "PATCH /profile/update" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * GET /profile/streak
 * - Requires userAuth middleware
 * - Returns user's streak data from DB (read-only)
 * - Streak updates are handled by cron job at 12 PM daily
 * - Only fetches today's spending for real-time display
 */
profileRouter.get("/profile/streak", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const loggedInUserId = req.user._id;
        // Get user's streak data from DB
        const user = await UserSchema_1.default.findById(loggedInUserId)
            .select("dailyBudget currentStreak longestStreak")
            .lean();
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const dailyBudget = user.dailyBudget || 0;
        // If no daily budget is set, return zeros
        if (dailyBudget <= 0) {
            return res.status(200).json({
                currentStreak: 0,
                longestStreak: user.longestStreak || 0,
                dailyBudget: 0,
                todaySpent: 0,
                todayUnderBudget: false,
                remainingToday: 0,
            });
        }
        // Get current 12 PM period for today's spending
        const now = new Date();
        const noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
        const currentPeriodStart = now.getHours() < 12
            ? new Date(noon.getTime() - 24 * 60 * 60 * 1000) // Yesterday noon
            : noon; // Today noon
        const currentPeriodEnd = new Date(currentPeriodStart.getTime() + 24 * 60 * 60 * 1000);
        // Get today's spending (real-time)
        const todayExpenses = await ExpenseSchema_1.default.aggregate([
            {
                $match: {
                    userId: loggedInUserId,
                    deleted: { $ne: true },
                    occurredAt: { $gte: currentPeriodStart, $lt: currentPeriodEnd },
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" },
                },
            },
        ]);
        const todaySpent = todayExpenses[0]?.total || 0;
        const todayUnderBudget = todaySpent <= dailyBudget;
        return res.status(200).json({
            currentStreak: user.currentStreak || 0,
            longestStreak: user.longestStreak || 0,
            dailyBudget,
            todaySpent,
            todayUnderBudget,
            remainingToday: Math.max(0, dailyBudget - todaySpent),
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /profile/streak" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * GET /profile/login-history
 * - Requires userAuth middleware
 * - Returns the user's recent login history (last 20)
 */
profileRouter.get("/profile/login-history", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const loggedInUserId = req.user._id;
        const history = await LoginHistorySchema_1.default.find({ userId: loggedInUserId })
            .sort({ loginAt: -1 })
            .limit(20)
            .lean();
        (0, logger_1.logEvent)("info", "Login history fetched", {
            route: "GET /profile/login-history",
            userId: loggedInUserId,
            count: history.length,
        });
        return res.status(200).json(history);
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /profile/login-history" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * GET /profile/user/:userId
 * - Requires userAuth
 * - Returns minimal public profile info for a user
 */
profileRouter.get("/profile/user/:userId", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const { userId } = req.params;
        const user = await UserSchema_1.default.findById(userId)
            .select("name emailId photoURL statusMessage createdAt")
            .lean();
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        (0, logger_1.logEvent)("info", "Public profile fetched", {
            route: "GET /profile/user/:userId",
            userId: req.user._id,
            targetUserId: userId,
        });
        return res.status(200).json(user);
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /profile/user/:userId" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * POST /profile/follow/:userId
 * - Requires userAuth
 * - Creates a follow request (pending)
 */
profileRouter.post("/profile/follow/:userId", userAuth_1.default, async (req, res) => {
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
profileRouter.delete("/profile/follow/:userId", userAuth_1.default, async (req, res) => {
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
profileRouter.get("/profile/follow-status/:userId", userAuth_1.default, async (req, res) => {
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
 * GET /profile/search-users
 * - Requires auth
 * - Optional query param `q` (min 2 chars) filters by name/email/status
 */
profileRouter.get("/profile/search-users", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const rawQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";
        if (rawQuery && rawQuery.length < 2) {
            return res.status(400).json({ message: "Search query must be at least 2 characters" });
        }
        const parsedLimit = Number(req.query.limit);
        const limit = Math.min(Math.max(1, Number.isNaN(parsedLimit) ? DEFAULT_SEARCH_LIMIT : parsedLimit), MAX_SEARCH_LIMIT);
        const baseFilter = { _id: { $ne: req.user._id } };
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
        const users = await UserSchema_1.default.find(filter)
            .select("name emailId photoURL statusMessage createdAt updatedAt")
            .sort((rawQuery ? { createdAt: -1 } : { updatedAt: -1 }))
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
        (0, logger_1.logEvent)("info", "Profile search executed", {
            route: "GET /profile/search-users",
            userId: req.user._id,
            queryLength: rawQuery.length,
            results: results.length,
        });
        return res.status(200).json({ query: rawQuery, results });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /profile/search-users" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * POST /profile/upload-avatar
 * - Requires userAuth middleware
 * - Uploads a profile photo and updates the user's photoURL
 */
profileRouter.post("/profile/upload-avatar", userAuth_1.default, multer_1.avatarUpload.single("avatar"), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }
        const loggedInUserId = req.user._id;
        // Get the old photo URL to delete the old file
        const oldUser = await UserSchema_1.default.findById(loggedInUserId).select("photoURL").lean();
        // Build the photo URL (relative path that will be served statically)
        const photoURL = `/uploads/avatars/${req.file.filename}`;
        // Update user's photoURL in database
        const updatedProfile = await UserSchema_1.default.findByIdAndUpdate(loggedInUserId, { $set: { photoURL } }, { new: true, runValidators: true }).select("-password").lean();
        if (!updatedProfile) {
            // Clean up uploaded file if user not found
            fs_1.default.unlinkSync(req.file.path);
            return res.status(404).json({ message: "User not found" });
        }
        // Delete old avatar file if it exists
        if (oldUser?.photoURL && oldUser.photoURL.startsWith("/uploads/avatars/")) {
            const oldFilePath = path_1.default.join(__dirname, "..", oldUser.photoURL);
            if (fs_1.default.existsSync(oldFilePath)) {
                fs_1.default.unlinkSync(oldFilePath);
            }
        }
        (0, logger_1.logEvent)("info", "Avatar uploaded", {
            route: "POST /profile/upload-avatar",
            userId: loggedInUserId,
            filename: req.file.filename,
        });
        return res.status(200).json({
            message: "Avatar uploaded successfully",
            photoURL,
            profile: updatedProfile,
        });
    }
    catch (err) {
        // Clean up uploaded file on error
        if (req.file) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch { }
        }
        (0, logger_1.logApiError)(req, err, { route: "POST /profile/upload-avatar" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
exports.default = profileRouter;
// What .lean() does (Mongoose)
// .lean() tells Mongoose to return plain JavaScript objects instead of Mongoose Document instances.
// Plain objects are faster and use less memory because Mongoose skips building full document objects with getters/setters, change tracking, and instance methods.
