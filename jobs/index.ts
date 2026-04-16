import cron from "node-cron";
import { logEvent } from "../utils/logger";
import { sendDailyReminders } from "./dailyReminder";
import { sendGoodMorningNotification } from "./goodMorning";

export function startCronJobs(): void {
  // Every minute — send reminders to users whose UTC reminder time matches now
  cron.schedule("* * * * *", () => {
    sendDailyReminders().catch((err) => {
      logEvent("error", "Daily reminder cron error", { error: String(err) });
    });
  });

  // Every day at 03:45 UTC — good morning to all subscribed users
  cron.schedule("45 3 * * *", () => {
    sendGoodMorningNotification().catch((err) => {
      logEvent("error", "Good morning cron error", { error: String(err) });
    });
  }, { timezone: "UTC" });

  logEvent("info", "Cron jobs started", {
    jobs: ["dailyReminder (every minute)", "goodMorning (03:45 UTC)"],
  });
  console.log("[cron] Started: dailyReminder (every minute) | goodMorning (03:45 UTC)");
}
