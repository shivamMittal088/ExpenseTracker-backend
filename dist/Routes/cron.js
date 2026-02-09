"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const streakCron_1 = require("../cron/streakCron");
const logger_1 = require("../utils/logger");
const cronRouter = express_1.default.Router();
/**
 * GET /cron/update-streaks
 * - Manual trigger for streak update (for testing)
 * - The actual cron runs via node-cron at 12 PM IST daily
 */
cronRouter.get("/cron/update-streaks", async (req, res) => {
    try {
        // Verify cron secret for security
        const authHeader = req.headers.authorization;
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        // Trigger the streak update
        await (0, streakCron_1.updateAllStreaks)();
        (0, logger_1.logEvent)("info", "Manual streak update triggered", {
            route: "GET /cron/update-streaks",
        });
        return res.status(200).json({
            success: true,
            message: "Streak update triggered",
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /cron/update-streaks" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
exports.default = cronRouter;
