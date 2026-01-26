import cron from "node-cron";
import User from "../Models/UserSchema";
import Expense from "../Models/ExpenseSchema";
import { logEvent } from "../utils/logger";

/**
 * Updates streak for all users with daily budget enabled
 * - Runs at 12 PM IST daily
 * - Simple logic: check yesterday's spending, increment or reset streak
 */
async function updateAllStreaks(): Promise<void> {
  try {
    // Current period starts at today's 12 PM
    const now = new Date();
    const currentPeriodStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      12, 0, 0, 0
    );

    // Yesterday's period: yesterday 12 PM to today 12 PM
    const prevPeriodStart = new Date(currentPeriodStart);
    prevPeriodStart.setDate(prevPeriodStart.getDate() - 1);
    const prevPeriodEnd = currentPeriodStart;

    // Find all users with daily budget enabled
    const users = await User.find({
      dailyBudget: { $gt: 0 },
    }).select("_id dailyBudget currentStreak longestStreak").lean();

    let updated = 0;

    for (const user of users) {
      // Get yesterday's spending
      const expenses = await Expense.aggregate([
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
      await User.findByIdAndUpdate(user._id, {
        $set: {
          currentStreak: newStreak,
          longestStreak: newLongestStreak,
          lastStreakDate: currentPeriodStart,
        },
      });

      updated++;
    }

    logEvent("info", "Cron: Streaks updated", {
      source: "node-cron",
      usersProcessed: users.length,
      updated,
      timestamp: now.toISOString(),
    });

    console.log(`✅ Streak cron completed: ${updated} users updated`);
  } catch (err: any) {
    console.error("❌ Streak cron failed:", err?.message);
    logEvent("error", "Cron: Streak update failed", {
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
export function startStreakCron(): void {
  // Schedule for 12 PM daily
  cron.schedule("0 12 * * *", () => {
    console.log("🕐 Running daily streak update cron...");
    void updateAllStreaks();
  }, {
    timezone: "Asia/Kolkata", // IST timezone
  });

  console.log("📅 Streak cron job scheduled (12 PM IST daily)");
}

// Export for manual trigger (testing)
export { updateAllStreaks };
