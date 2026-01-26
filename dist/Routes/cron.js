"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const ExpenseSchema_1 = __importDefault(require("../Models/ExpenseSchema"));
const logger_1 = require("../utils/logger");
const cronRouter = express_1.default.Router();
/**
 * GET /cron/update-streaks
 * - Called by Vercel Cron at 12 PM daily
 * - Updates streak for all users with daily budget enabled
 * - Protected by CRON_SECRET to prevent unauthorized access
 */
cronRouter.get("/cron/update-streaks", async (req, res) => {
    try {
        // Verify cron secret (Vercel sends this automatically)
        const authHeader = req.headers.authorization;
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        // Get current 12 PM period
        const now = new Date();
        const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
        // Find all users with daily budget enabled
        const usersWithBudget = await UserSchema_1.default.find({
            dailyBudget: { $gt: 0 },
        }).select("_id dailyBudget currentStreak longestStreak lastStreakDate").lean();
        let updated = 0;
        let skipped = 0;
        for (const user of usersWithBudget) {
            // Skip if already updated today
            const lastStreakDate = user.lastStreakDate ? new Date(user.lastStreakDate) : null;
            if (lastStreakDate && lastStreakDate.getTime() === currentPeriodStart.getTime()) {
                skipped++;
                continue;
            }
            // Get previous period (yesterday 12 PM to today 12 PM)
            const prevPeriodEnd = new Date(currentPeriodStart);
            const prevPeriodStart = new Date(currentPeriodStart);
            prevPeriodStart.setDate(prevPeriodStart.getDate() - 1);
            // Calculate yesterday's spending
            const expenses = await ExpenseSchema_1.default.aggregate([
                {
                    $match: {
                        userId: user._id,
                        deleted: { $ne: true },
                        occurredAt: { $gte: prevPeriodStart, $lt: prevPeriodEnd },
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$amount" },
                    },
                },
            ]);
            const spent = expenses[0]?.total || 0;
            const underBudget = spent <= user.dailyBudget;
            // Calculate new streak
            let newStreak = user.currentStreak || 0;
            if (underBudget) {
                newStreak++;
            }
            else {
                newStreak = 0;
            }
            const newLongestStreak = Math.max(user.longestStreak || 0, newStreak);
            // Update user
            await UserSchema_1.default.findByIdAndUpdate(user._id, {
                $set: {
                    currentStreak: newStreak,
                    longestStreak: newLongestStreak,
                    lastStreakDate: currentPeriodStart,
                },
            });
            updated++;
        }
        (0, logger_1.logEvent)("info", "Cron: Streaks updated", {
            route: "GET /cron/update-streaks",
            usersProcessed: usersWithBudget.length,
            updated,
            skipped,
        });
        return res.status(200).json({
            success: true,
            message: `Streaks updated for ${updated} users, ${skipped} skipped`,
            timestamp: now.toISOString(),
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /cron/update-streaks" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
exports.default = cronRouter;
