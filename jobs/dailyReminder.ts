import webpush from "web-push";
import User from "../Models/UserSchema";
import PushSubscription from "../Models/PushSubscriptionSchema";
import { initWebPush } from "../config/webpush";
import { logEvent } from "../utils/logger";

/** Returns current UTC time as "HH:MM" */
function currentUTCTime(): string {
  const now = new Date();
  const h = String(now.getUTCHours()).padStart(2, "0");
  const m = String(now.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export async function sendDailyReminders(): Promise<void> {
  if (!initWebPush()) {
    logEvent("warn", "Daily reminder skipped — VAPID not configured");
    return;
  }

  const utcTime = currentUTCTime();

  // Find users whose stored UTC reminder time matches the current minute
  const users = await User.find({ dailyReminderUTC: utcTime }).select("_id").lean();
  if (users.length === 0) return;

  const userIds = users.map((u) => u._id);
  const subscriptions = await PushSubscription.find({ userId: { $in: userIds } }).lean();
  if (subscriptions.length === 0) return;

  const payload = JSON.stringify({
    title: "Daily Reminder 💰",
    body: "Don't forget to log today's expenses!",
    url: "/",
  });

  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        failed++;
        logEvent("warn", "Daily reminder push failed", {
          endpoint: sub.endpoint,
          error: String(err),
        });
      }
    }),
  );

  logEvent("info", "Daily reminders sent", { utcTime, sent, failed, total: subscriptions.length });
}
