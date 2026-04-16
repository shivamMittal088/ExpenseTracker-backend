import webpush from "web-push";
import PushSubscription from "../Models/PushSubscriptionSchema";
import { initWebPush } from "../config/webpush";
import { logEvent } from "../utils/logger";

export async function sendGoodMorningNotification(): Promise<void> {
  if (!initWebPush()) {
    logEvent("warn", "Good morning skipped — VAPID not configured");
    return;
  }

  const subscriptions = await PushSubscription.find().lean();
  if (subscriptions.length === 0) return;

  const payload = JSON.stringify({
    title: "Good Morning! 🌅",
    body: "Start your day right — log your expenses and stay on track!",
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
        logEvent("warn", "Good morning push failed", {
          endpoint: sub.endpoint,
          error: String(err),
        });
      }
    }),
  );

  logEvent("info", "Good morning notifications sent", { sent, failed, total: subscriptions.length });
}
