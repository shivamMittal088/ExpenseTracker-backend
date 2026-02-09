"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startStreakCron = startStreakCron;
exports.updateAllStreaks = updateAllStreaks;
const node_cron_1 = __importDefault(require("node-cron"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const ExpenseSchema_1 = __importDefault(require("../Models/ExpenseSchema"));
const logger_1 = require("../utils/logger");
/**
 * Updates streak for all users with daily budget enabled
 * - Runs at 12 PM IST daily
 * - Simple logic: check yesterday's spending, increment or reset streak
 */
async function updateAllStreaks() {
    try {
        // Current period starts at today's 12 PM
        const now = new Date();
        const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
        // Yesterday's period: yesterday 12 PM to today 12 PM
        const prevPeriodStart = new Date(currentPeriodStart);
        prevPeriodStart.setDate(prevPeriodStart.getDate() - 1);
        const prevPeriodEnd = currentPeriodStart;
        // Find all users with daily budget enabled
        const users = await UserSchema_1.default.find({
            dailyBudget: { $gt: 0 },
        }).select("_id dailyBudget currentStreak longestStreak").lean();
        let updated = 0;
        for (const user of users) {
            // Get yesterday's spending
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
            // Simple logic: under budget = streak + 1, over budget = reset to 0
            const newStreak = underBudget ? (user.currentStreak || 0) + 1 : 0;
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
            source: "node-cron",
            usersProcessed: users.length,
            updated,
            timestamp: now.toISOString(),
        });
        console.log(`✅ Streak cron completed: ${updated} users updated`);
    }
    catch (err) {
        console.error("❌ Streak cron failed:", err?.message);
        (0, logger_1.logEvent)("error", "Cron: Streak update failed", {
            source: "node-cron",
            error: err?.message,
        });
    }
}
/**
 * Start the streak cron job
 * Runs at 12:00 PM IST daily (12 PM = noon)
 * Cron expression: "0 12 * * *" = At minute 0, hour 12, every day
 */
function startStreakCron() {
    // Schedule for 12 PM daily
    node_cron_1.default.schedule("0 12 * * *", () => {
        console.log("🕐 Running daily streak update cron...");
        void updateAllStreaks();
    }, {
        timezone: "Asia/Kolkata", // IST timezone
    });
    console.log("📅 Streak cron job scheduled (12 PM IST daily)");
}
