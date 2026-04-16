import type { VercelRequest, VercelResponse } from "@vercel/node";
import dotenv from "dotenv";
import { connectDB } from "../config/database";
import { sendDailyReminders } from "../jobs/dailyReminder";
import { sendGoodMorningNotification } from "../jobs/goodMorning";

if (!process.env.VERCEL) {
  dotenv.config();
}

let isConnected = false;

async function ensureDB() {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel automatically sends CRON_SECRET in the Authorization header for cron invocations.
  // Set CRON_SECRET in your Vercel environment variables to protect this endpoint.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const job = (req.query.job as string) || "";

  try {
    await ensureDB();

    if (job === "daily-reminder") {
      await sendDailyReminders();
      return res.json({ ok: true, job });
    }

    if (job === "good-morning") {
      await sendGoodMorningNotification();
      return res.json({ ok: true, job });
    }

    return res.status(400).json({
      message: "Unknown job. Use ?job=daily-reminder or ?job=good-morning",
    });
  } catch (err) {
    console.error(`Cron job '${job}' failed:`, err);
    return res.status(500).json({ error: String(err) });
  }
}
