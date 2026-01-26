import express, { Request, Response } from "express";
import { updateAllStreaks } from "../cron/streakCron";
import { logEvent, logApiError } from "../utils/logger";

const cronRouter = express.Router();

/**
 * GET /cron/update-streaks
 * - Manual trigger for streak update (for testing)
 * - The actual cron runs via node-cron at 12 PM IST daily
 */
cronRouter.get("/cron/update-streaks", async (req: Request, res: Response) => {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Trigger the streak update
    await updateAllStreaks();

    logEvent("info", "Manual streak update triggered", {
      route: "GET /cron/update-streaks",
    });

    return res.status(200).json({
      success: true,
      message: "Streak update triggered",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logApiError(req, err, { route: "GET /cron/update-streaks" });
    return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
  }
});

export default cronRouter;
