import cron from "node-cron";
import { logEvent } from "../utils/logger";
import { sendDailyReminders } from "./dailyReminder";
import { sendGoodMorningNotification } from "./goodMorning";

export function startCronJobs(): void {
  // Every minute — heartbeat log so you can verify cron is alive in local dev
  cron.schedule("* * * * *", () => {
    const now = new Date();
    const utc = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")} UTC`;
    console.log(`[cron] heartbeat @ ${utc}`);
  });

  // Every minute — send reminders to users whose UTC reminder time matches now
  // NOTE: Requires Vercel Pro plan. Use cron-job.org (free) to call /api/cron?job=daily-reminder every minute instead.
  // cron.schedule("* * * * *", () => {
  //   sendDailyReminders().catch((err) => {
  //     logEvent("error", "Daily reminder cron error", { error: String(err) });
  //   });
  // });

  // Every day at 22:55 UTC (= 4:25 AM IST) — good morning to all subscribed users
  cron.schedule("55 22 * * *", () => {
    sendGoodMorningNotification().catch((err) => {
      logEvent("error", "Good morning cron error", { error: String(err) });
    });
  }, { timezone: "UTC" });

  logEvent("info", "Cron jobs started", {
    jobs: ["goodMorning (22:55 UTC = 4:25 AM IST)"],
  });
  console.log("[cron] Started: goodMorning (22:55 UTC = 4:25 AM IST)");
}
