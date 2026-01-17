"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const LoginHistorySchema_1 = __importDefault(require("../Models/LoginHistorySchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const logger_1 = require("../utils/logger");
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
        (0, logger_1.logEvent)("info", "Profile fetched", {
            route: "GET /profile/view",
            userId: loggedInUserId,
        });
        return res.status(200).json(profile);
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
        const { name, statusMessage, currency, preferences } = req.body;
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
exports.default = profileRouter;
// What .lean() does (Mongoose)
// .lean() tells Mongoose to return plain JavaScript objects instead of Mongoose Document instances.
// Plain objects are faster and use less memory because Mongoose skips building full document objects with getters/setters, change tracking, and instance methods.
