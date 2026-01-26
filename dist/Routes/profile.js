"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const LoginHistorySchema_1 = __importDefault(require("../Models/LoginHistorySchema"));
const ExpenseSchema_1 = __importDefault(require("../Models/ExpenseSchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const logger_1 = require("../utils/logger");
const multer_1 = require("../config/multer");
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
 * - Calculates and returns the user's budget streak
 * - A streak day = spending <= dailyBudget (₹0 counts as under budget)
 * - Day boundary is 12 PM to 12 PM (noon to noon)
 *
 * Optimized logic:
 * - Streak update only happens ONCE per day (after 12 PM)
 * - If already calculated today: return cached values (no DB write)
 * - Otherwise: calculate, update DB, then return
 */
profileRouter.get("/profile/streak", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const loggedInUserId = req.user._id;
        // Get user's streak data
        const user = await UserSchema_1.default.findById(loggedInUserId).select("dailyBudget currentStreak longestStreak lastStreakDate").lean();
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
                message: "Set a daily budget to start tracking your streak",
            });
        }
        // Get 12 PM boundary for current period
        // A "day" is from 12:00 PM (noon) to next day 12:00 PM
        const now = new Date();
        const noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
        let currentPeriodStart;
        let currentPeriodEnd;
        if (now.getHours() < 12) {
            // Before noon: day started at yesterday's noon
            currentPeriodStart = new Date(noon);
            currentPeriodStart.setDate(currentPeriodStart.getDate() - 1);
            currentPeriodEnd = noon;
        }
        else {
            // After noon: day started at today's noon
            currentPeriodStart = noon;
            currentPeriodEnd = new Date(noon);
            currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 1);
        }
        // Check if already calculated for today's period
        const lastStreakDate = user.lastStreakDate ? new Date(user.lastStreakDate) : null;
        const alreadyCalculatedToday = lastStreakDate &&
            lastStreakDate.getTime() === currentPeriodStart.getTime();
        // Get current period's total spending (always needed for display)
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
        // If already calculated today, just return cached values (no DB write)
        if (alreadyCalculatedToday) {
            return res.status(200).json({
                currentStreak: user.currentStreak || 0,
                longestStreak: user.longestStreak || 0,
                dailyBudget,
                todaySpent,
                todayUnderBudget,
                remainingToday: Math.max(0, dailyBudget - todaySpent),
                periodStart: currentPeriodStart,
                periodEnd: currentPeriodEnd,
                cached: true, // Indicates this is cached data
            });
        }
        // First time today - calculate and update streak
        let currentStreak = user.currentStreak || 0;
        if (todayUnderBudget) {
            currentStreak++;
        }
        else {
            currentStreak = 0;
        }
        // Update longest streak if current is higher
        const longestStreak = Math.max(user.longestStreak || 0, currentStreak);
        // Update user's streak data (only once per day)
        await UserSchema_1.default.findByIdAndUpdate(loggedInUserId, {
            $set: {
                currentStreak,
                longestStreak,
                lastStreakDate: currentPeriodStart, // Mark today as calculated
            },
        });
        (0, logger_1.logEvent)("info", "Streak calculated", {
            route: "GET /profile/streak",
            userId: loggedInUserId,
            currentStreak,
            longestStreak,
        });
        return res.status(200).json({
            currentStreak,
            longestStreak,
            dailyBudget,
            todaySpent,
            todayUnderBudget,
            remainingToday: Math.max(0, dailyBudget - todaySpent),
            periodStart: currentPeriodStart,
            periodEnd: currentPeriodEnd,
            cached: false, // Fresh calculation
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
