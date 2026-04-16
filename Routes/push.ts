import express, { Request, Response } from "express";
import webpush from "web-push";
import userAuth from "../Middlewares/userAuth";
import PushSubscription from "../Models/PushSubscriptionSchema";
import { logApiError } from "../utils/logger";

const pushRouter = express.Router();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL;

const vapidConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_EMAIL);

if (vapidConfigured) {
  webpush.setVapidDetails(VAPID_EMAIL!, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
} else {
  console.warn("[push] VAPID environment variables are not set — push notification routes will return 503.");
}

// GET /api/push/vapid-public-key
// Returns the VAPID public key so the browser can create a push subscription
pushRouter.get(
  "/push/vapid-public-key",
  (_req: Request, res: Response) => {
    if (!vapidConfigured) {
      res.status(503).json({ message: "Push notifications are not configured on the server." });
      return;
    }
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  },
);

// POST /api/push/subscribe
// Saves the push subscription for the authenticated user
pushRouter.post(
  "/push/subscribe",
  userAuth,
  async (req: Request, res: Response) => {
    const { endpoint, keys } = req.body as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ message: "Invalid push subscription object" });
      return;
    }

    try {
      const userId = (req as any).user._id;

      await PushSubscription.findOneAndUpdate(
        { endpoint },
        { userId, endpoint, keys },
        { upsert: true, new: true },
      );

      res.status(201).json({ message: "Subscribed to push notifications" });
    } catch (err) {
      logApiError(req, err, { route: "push/subscribe" });
      res.status(500).json({ message: "Failed to save push subscription" });
    }
  },
);

// DELETE /api/push/unsubscribe
// Removes the push subscription for the given endpoint
pushRouter.delete(
  "/push/unsubscribe",
  userAuth,
  async (req: Request, res: Response) => {
    const { endpoint } = req.body as { endpoint?: string };

    if (!endpoint) {
      res.status(400).json({ message: "endpoint is required" });
      return;
    }

    try {
      const userId = (req as any).user._id;
      await PushSubscription.deleteOne({ endpoint, userId });
      res.json({ message: "Unsubscribed from push notifications" });
    } catch (err) {
      logApiError(req, err, { route: "push/unsubscribe" });
      res.status(500).json({ message: "Failed to remove push subscription" });
    }
  },
);

// POST /api/push/test
// Sends a test push notification to the authenticated user (dev use only)
pushRouter.post("/push/test", userAuth, async (req: Request, res: Response) => {
  if (!vapidConfigured) {
    res.status(503).json({ message: "Push notifications are not configured on the server." });
    return;
  }
  try {
    const userId = (req as any).user._id;
    const subscriptions = await PushSubscription.find({ userId });

    if (subscriptions.length === 0) {
      res
        .status(404)
        .json({
          message:
            "No subscription found for this user. Enable push notifications first.",
        });
      return;
    }

    const payload = JSON.stringify({
      title: "Test Notification 🎉",
      body: "Push notifications are working correctly!",
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          },
          payload,
        ),
      ),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length === subscriptions.length) {
      const reasons = (failed as PromiseRejectedResult[]).map((r) =>
        String(r.reason),
      );
      res.status(500).json({ message: "All push deliveries failed", reasons });
      return;
    }

    res.json({
      message: `Test notification sent to ${subscriptions.length - failed.length}/${subscriptions.length} subscription(s)`,
    });
  } catch (err) {
    logApiError(req, err, { route: "push/test" });
    res
      .status(500)
      .json({
        message: "Failed to send test notification",
        reason: String(err),
      });
  }
});

export default pushRouter;
