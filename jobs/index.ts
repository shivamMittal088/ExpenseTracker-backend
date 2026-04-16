import cron from "node-cron";
import { logEvent } from "../utils/logger";
import { sendDailyReminders } from "./dailyReminder";
import { sendGoodMorningNotification } from "./goodMorning";

export function startCronJobs(): void {
  // Every minute — send reminders to users whose UTC reminder time matches now
  // NOTE: Requires Vercel Pro plan. Use cron-job.org (free) to call /api/cron?job=daily-reminder every minute instead.
  // cron.schedule("* * * * *", () => {
  //   sendDailyReminders().catch((err) => {
  //     logEvent("error", "Daily reminder cron error", { error: String(err) });
  //   });
  // });

  // Every day at 04:25 UTC — good morning to all subscribed users
  cron.schedule("25 4 * * *", () => {
    sendGoodMorningNotification().catch((err) => {
      logEvent("error", "Good morning cron error", { error: String(err) });
    });
  }, { timezone: "UTC" });

  logEvent("info", "Cron jobs started", {
    jobs: ["dailyReminder (every minute)", "goodMorning (04:25 UTC)"],
  });
  console.log("[cron] Started: dailyReminder (every minute) | goodMorning (04:25 UTC)");
}
