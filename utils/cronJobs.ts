import cron from "node-cron";
import webpush from "web-push";
import User from "../Models/UserSchema";
import PushSubscription from "../Models/PushSubscriptionSchema";
import { logEvent, logApiError } from "./logger";

function initWebPush(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL;
  if (!publicKey || !privateKey || !email) return false;
  webpush.setVapidDetails(email, publicKey, privateKey);
  return true;
}

/** Returns current UTC time as "HH:MM" */
function currentUTCTime(): string {
  const now = new Date();
  const h = String(now.getUTCHours()).padStart(2, "0");
  const m = String(now.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

async function sendDailyReminders(): Promise<void> {
  if (!initWebPush()) {
    logEvent("warn", "Daily reminder cron skipped — VAPID not configured");
    return;
  }

  const utcTime = currentUTCTime();

  // Find all users whose reminder UTC time matches right now
  const users = await User.find({ dailyReminderUTC: utcTime }).select("_id").lean();
  if (users.length === 0) return;

  const userIds = users.map((u) => u._id);

  // Get all push subscriptions for those users
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
        // 410 Gone = subscription expired, could clean up here
        logEvent("warn", "Daily reminder push failed for subscription", {
          endpoint: sub.endpoint,
          error: String(err),
        });
      }
    }),
  );

  logEvent("info", "Daily reminders sent", { utcTime, sent, failed, total: subscriptions.length });
}

export function startCronJobs(): void {
  // Run every minute — checks if any user's UTC reminder time matches now
  cron.schedule("* * * * *", () => {
    sendDailyReminders().catch((err) => {
      logEvent("error", "Daily reminder cron error", { error: String(err) });
    });
  });

  logEvent("info", "Cron jobs started — daily reminders scheduler active");
  console.log("[cron] Daily reminder scheduler started");
}
