import express, { Request, Response } from "express";
import mongoose from "mongoose";
import Expense from "../Models/ExpenseSchema";
import userAuth from "../Middlewares/userAuth";
import { logApiError, logEvent } from "../utils/logger";

const expenseAnalyticsRouter = express.Router();

interface Category {
  name: string;
  color: string;
  emoji: string;
}

interface HeatmapAggregate {
  date: string;
  count: number;
  totalAmount: number;
}

interface RecurringAggregate {
  name: string;
  category: Category;
  count: number;
  avgAmount: number;
  minAmount: number;
  maxAmount: number;
  totalAmount: number;
  lastOccurrence: Date;
  firstOccurrence: Date;
  dates: Date[];
}

interface RecurringPayment {
  name: string;
  emoji: string;
  color: string;
  amount: number;
  count: number;
  frequency: "daily" | "weekly" | "bi-weekly" | "monthly" | "quarterly" | "irregular";
  frequencyLabel: string;
  nextExpectedDate: string | null;
  estimatedMonthlyAmount: number;
  lastOccurrence: Date;
  confidenceScore: number;
  isLikelyRecurring: boolean;
}

// Fetch expenses for date range (YYYY-MM-DD to YYYY-MM-DD)
expenseAnalyticsRouter.get("/expenseAnalytics/range", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const rawStartDate = typeof req.query.startDate === "string" ? req.query.startDate : "";
    const rawEndDate = typeof req.query.endDate === "string" ? req.query.endDate : "";

    if (!rawStartDate || !rawEndDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawStartDate) || !/^\d{4}-\d{2}-\d{2}$/.test(rawEndDate)) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }

    const tzOffsetMinutes = parseInt(String(req.query.tzOffsetMinutes || "0"), 10) || 0;

    const [startYear, startMonth, startDay] = rawStartDate.split("-").map((part: string) => Number(part));
    const [endYear, endMonth, endDay] = rawEndDate.split("-").map((part: string) => Number(part));

    const startDate = new Date(
      Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0) + tzOffsetMinutes * 60 * 1000
    );
    const endDate = new Date(
      Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999) + tzOffsetMinutes * 60 * 1000
    );

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Invalid calendar date" });
    }

    if (startDate > endDate) {
      return res.status(400).json({ message: "startDate must be before or equal to endDate" });
    }

    const expenses = await Expense.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isHidden: { $ne: true },
        },
      },
      {
        $addFields: {
          effectiveOccurredAt: {
            $ifNull: ["$occurredAt", { $ifNull: ["$occuredAt", "$createdAt"] }],
          },
        },
      },
      {
        $match: {
          effectiveOccurredAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $sort: { effectiveOccurredAt: -1, _id: -1 },
      },
    ]);

    logEvent("info", "Expense range fetched", {
      route: "GET /expenseAnalytics/range",
      userId,
      startDate: rawStartDate,
      endDate: rawEndDate,
      count: expenses.length,
    });

    return res.json({
      message: "Expense range fetched successfully",
      data: expenses,
      meta: {
        startDate: rawStartDate,
        endDate: rawEndDate,
        count: expenses.length,
      },
    });
  } catch (err) {
    logApiError(req, err, { route: "GET /expenseAnalytics/range" });
    return res.status(500).json({ message: "Failed to fetch expense range" });
  }
});

// Detect recurring payments based on expense patterns
expenseAnalyticsRouter.get("/expenseAnalytics/recurring", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const debug = req.query.debug === "true";

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recurringData = await Expense.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isHidden: { $ne: true },
          occurredAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: "$category.name",
          category: { $first: "$category" },
          amounts: { $push: "$amount" },
          dates: { $push: "$occurredAt" },
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          avgAmount: { $avg: "$amount" },
          minAmount: { $min: "$amount" },
          maxAmount: { $max: "$amount" },
          lastOccurrence: { $max: "$occurredAt" },
          firstOccurrence: { $min: "$occurredAt" },
        },
      },
      {
        $match: {
          count: { $gte: 3 },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          category: 1,
          count: 1,
          avgAmount: { $round: ["$avgAmount", 0] },
          minAmount: 1,
          maxAmount: 1,
          totalAmount: 1,
          lastOccurrence: 1,
          firstOccurrence: 1,
          dates: 1,
        },
      },
      {
        $sort: { count: -1, avgAmount: -1 },
      },
      {
        $limit: 12,
      },
    ]) as RecurringAggregate[];

    const recurringWithFrequency: RecurringPayment[] = recurringData.map((item: RecurringAggregate) => {
      const dates = item.dates.map((d: Date) => new Date(d).getTime()).sort((a: number, b: number) => a - b);

      let totalDaysBetween = 0;
      for (let i = 1; i < dates.length; i++) {
        totalDaysBetween += (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
      }
      const avgDaysBetween = dates.length > 1 ? totalDaysBetween / (dates.length - 1) : 30;

      let frequency: "daily" | "weekly" | "bi-weekly" | "monthly" | "quarterly" | "irregular";
      let frequencyLabel: string;
      let estimatedMonthlyAmount: number;

      if (avgDaysBetween <= 3) {
        frequency = "daily";
        frequencyLabel = "Every day";
        estimatedMonthlyAmount = item.avgAmount * 30;
      } else if (avgDaysBetween <= 10) {
        frequency = "weekly";
        frequencyLabel = "Every week";
        estimatedMonthlyAmount = item.avgAmount * 4;
      } else if (avgDaysBetween <= 20) {
        frequency = "bi-weekly";
        frequencyLabel = "Every 2 weeks";
        estimatedMonthlyAmount = item.avgAmount * 2;
      } else if (avgDaysBetween <= 45) {
        frequency = "monthly";
        frequencyLabel = "Every month";
        estimatedMonthlyAmount = item.avgAmount;
      } else if (avgDaysBetween <= 100) {
        frequency = "quarterly";
        frequencyLabel = "Every 3 months";
        estimatedMonthlyAmount = Math.round(item.avgAmount / 3);
      } else {
        frequency = "irregular";
        frequencyLabel = `Every ~${Math.round(avgDaysBetween)} days`;
        estimatedMonthlyAmount = Math.round(item.avgAmount / (avgDaysBetween / 30));
      }

      const lastDate = new Date(item.lastOccurrence);
      const nextDate = new Date(lastDate.getTime() + avgDaysBetween * 24 * 60 * 60 * 1000);
      const today = new Date();

      let nextExpectedDate: string | null = null;
      const daysUntilNext = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilNext < 0) {
        nextExpectedDate = `Overdue by ${Math.abs(daysUntilNext)} days`;
      } else if (daysUntilNext === 0) {
        nextExpectedDate = "Due today";
      } else if (daysUntilNext === 1) {
        nextExpectedDate = "Due tomorrow";
      } else if (daysUntilNext <= 7) {
        nextExpectedDate = `In ${daysUntilNext} days`;
      } else {
        nextExpectedDate = nextDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      }

      const amountVariance = item.maxAmount - item.minAmount;
      const amountConsistency = item.avgAmount > 0 ? 1 - amountVariance / item.avgAmount : 0;
      const confidenceScore = Math.min(
        100,
        Math.round((Math.min(item.count, 6) / 6) * 50 + Math.max(0, amountConsistency) * 50)
      );

      return {
        name: item.name,
        emoji: item.category?.emoji || "💸",
        color: item.category?.color || "#10b981",
        amount: item.avgAmount,
        count: item.count,
        frequency,
        frequencyLabel,
        nextExpectedDate,
        estimatedMonthlyAmount,
        lastOccurrence: item.lastOccurrence,
        confidenceScore,
        isLikelyRecurring: confidenceScore >= 40 && item.count >= 2,
      };
    });

    const likelyRecurring = recurringWithFrequency.filter((item) => item.isLikelyRecurring);
    const totalMonthlyRecurring = likelyRecurring.reduce((sum, item) => sum + item.estimatedMonthlyAmount, 0);

    logEvent("info", "Recurring payments fetched", {
      route: "GET /expenseAnalytics/recurring",
      userId,
      recurringCount: likelyRecurring.length,
      totalMonthlyRecurring,
    });

    return res.json({
      message: "Recurring payments detected successfully",
      data: likelyRecurring,
      summary: {
        count: likelyRecurring.length,
        totalMonthlyEstimate: totalMonthlyRecurring,
      },
      ...(debug && {
        debug: {
          analyzedPeriod: {
            from: sixMonthsAgo.toISOString(),
            to: new Date().toISOString(),
          },
          rawGroupsFound: recurringData.length,
          allProcessed: recurringWithFrequency.map((item) => ({
            name: item.name,
            count: item.count,
            frequency: item.frequency,
            frequencyLabel: item.frequencyLabel,
            nextExpectedDate: item.nextExpectedDate,
            confidenceScore: item.confidenceScore,
            isLikelyRecurring: item.isLikelyRecurring,
            reason:
              item.confidenceScore < 40
                ? "Low confidence score"
                : item.count < 2
                  ? "Too few occurrences"
                  : "Passed",
          })),
        },
      }),
    });
  } catch (err) {
    logApiError(req, err, { route: "GET /expenseAnalytics/recurring" });
    return res.status(500).json({ message: "Failed to detect recurring payments" });
  }
});

// Get payment mode breakdown (pie chart data)
expenseAnalyticsRouter.get("/expenseAnalytics/payment-breakdown", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { period = "month" } = req.query;

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "week":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "3month":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        break;
      case "6month":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 6);
        break;
      case "year":
      default:
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    const breakdown = await Expense.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isHidden: { $ne: true },
          ...(period !== "all" && { occurredAt: { $gte: startDate } }),
        },
      },
      {
        $group: {
          _id: "$payment_mode",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          avgAmount: { $avg: "$amount" },
        },
      },
      {
        $sort: { totalAmount: -1 },
      },
    ]) as { _id: string; totalAmount: number; count: number; avgAmount: number }[];

    const grandTotal = breakdown.reduce((sum: number, item) => sum + item.totalAmount, 0);
    const totalTransactions = breakdown.reduce((sum: number, item) => sum + item.count, 0);

    const paymentModeInfo: Record<string, { label: string; color: string; icon: string }> = {
      UPI: { label: "UPI", color: "#8B5CF6", icon: "📱" },
      cash: { label: "Cash", color: "#10B981", icon: "💵" },
      card: { label: "Card", color: "#3B82F6", icon: "💳" },
      bank_transfer: { label: "Bank Transfer", color: "#F59E0B", icon: "🏦" },
      wallet: { label: "Wallet", color: "#EC4899", icon: "👛" },
    };

    const data = breakdown.map((item) => {
      const info = paymentModeInfo[item._id] || { label: item._id, color: "#6B7280", icon: "💰" };
      return {
        mode: item._id,
        label: info.label,
        color: info.color,
        icon: info.icon,
        totalAmount: Math.round(item.totalAmount),
        count: item.count,
        avgAmount: Math.round(item.avgAmount),
        percentage: grandTotal > 0 ? Math.round((item.totalAmount / grandTotal) * 100) : 0,
      };
    });

    logEvent("info", "Payment breakdown fetched", {
      route: "GET /expenseAnalytics/payment-breakdown",
      userId,
      period,
      modesFound: data.length,
    });

    return res.json({
      message: "Payment breakdown fetched successfully",
      data,
      summary: {
        totalAmount: grandTotal,
        totalTransactions,
        period,
        topMode: data[0]?.label || null,
      },
    });
  } catch (err) {
    logApiError(req, err, { route: "GET /expenseAnalytics/payment-breakdown" });
    return res.status(500).json({ message: "Failed to fetch payment breakdown" });
  }
});

// Get spending trends for graphs (daily, monthly, yearly views)
expenseAnalyticsRouter.get("/expenseAnalytics/spending-trends", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { view = "daily" } = req.query;

    const now = new Date();
    let startDate: Date;
    let groupFormat: string;
    let timezone = "+05:30";

    switch (view) {
      case "daily":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        groupFormat = "%Y-%m-%d";
        break;
      case "monthly":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 12);
        groupFormat = "%Y-%m";
        break;
      case "yearly":
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 5);
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        groupFormat = "%Y";
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        groupFormat = "%Y-%m-%d";
    }

    const trends = await Expense.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isHidden: { $ne: true },
          occurredAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupFormat,
              date: "$occurredAt",
              timezone: timezone,
            },
          },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          avgAmount: { $avg: "$amount" },
          maxAmount: { $max: "$amount" },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          _id: 0,
          period: "$_id",
          totalAmount: { $round: ["$totalAmount", 0] },
          count: 1,
          avgAmount: { $round: ["$avgAmount", 0] },
          maxAmount: { $round: ["$maxAmount", 0] },
        },
      },
    ]) as { period: string; totalAmount: number; count: number; avgAmount: number; maxAmount: number }[];

    const filledTrends: typeof trends = [];

    if (view === "daily") {
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        const period = date.toISOString().split("T")[0];
        const existing = trends.find(t => t.period === period);
        filledTrends.push(existing || { period, totalAmount: 0, count: 0, avgAmount: 0, maxAmount: 0 });
      }
    } else if (view === "monthly") {
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(now.getMonth() - i);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = trends.find(t => t.period === period);
        filledTrends.push(existing || { period, totalAmount: 0, count: 0, avgAmount: 0, maxAmount: 0 });
      }
    } else if (view === "yearly") {
      const currentYear = now.getFullYear();
      for (let i = 5; i >= 1; i--) {
        const year = currentYear - i;
        const period = String(year);
        const existing = trends.find(t => t.period === period);
        filledTrends.push(existing || { period, totalAmount: 0, count: 0, avgAmount: 0, maxAmount: 0 });
      }
    }

    const totalSpent = filledTrends.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalTransactions = filledTrends.reduce((sum, t) => sum + t.count, 0);
    const avgPerPeriod = filledTrends.length > 0 ? Math.round(totalSpent / filledTrends.length) : 0;
    const maxPeriod = filledTrends.reduce((max, t) => t.totalAmount > max.totalAmount ? t : max, filledTrends[0]);
    const minPeriod = filledTrends.filter(t => t.totalAmount > 0).reduce((min, t) => t.totalAmount < min.totalAmount ? t : min, filledTrends.find(t => t.totalAmount > 0) || filledTrends[0]);

    const lastPeriod = filledTrends[filledTrends.length - 1];
    const previousPeriods = filledTrends.slice(0, -1);
    const previousAvg = previousPeriods.length > 0
      ? previousPeriods.reduce((sum, t) => sum + t.totalAmount, 0) / previousPeriods.length
      : 0;
    const trendPercentage = previousAvg > 0
      ? Math.round(((lastPeriod.totalAmount - previousAvg) / previousAvg) * 100)
      : 0;

    logEvent("info", "Spending trends fetched", {
      route: "GET /expenseAnalytics/spending-trends",
      userId,
      view,
      periodsReturned: filledTrends.length,
    });

    return res.json({
      message: "Spending trends fetched successfully",
      data: filledTrends,
      summary: {
        view,
        totalSpent,
        totalTransactions,
        avgPerPeriod,
        highestPeriod: maxPeriod,
        lowestPeriod: minPeriod,
        trendPercentage,
        trendDirection: trendPercentage > 0 ? "up" : trendPercentage < 0 ? "down" : "flat",
      },
    });
  } catch (err) {
    logApiError(req, err, { route: "GET /expenseAnalytics/spending-trends" });
    return res.status(500).json({ message: "Failed to fetch spending trends" });
  }
});

// Get transaction count per day for heatmap
expenseAnalyticsRouter.get("/expenseAnalytics/heatmap/", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
    const tzOffsetMinutes = parseInt(String(req.query.tzOffsetMinutes || "0"), 10) || 0;

    const tzSign = tzOffsetMinutes <= 0 ? "+" : "-";
    const tzAbs = Math.abs(tzOffsetMinutes);
    const tzHours = String(Math.floor(tzAbs / 60)).padStart(2, "0");
    const tzMinutes = String(tzAbs % 60).padStart(2, "0");
    const tzString = `${tzSign}${tzHours}:${tzMinutes}`;

    const startDate = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0, 0) + tzOffsetMinutes * 60 * 1000);
    const endDate = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999) + tzOffsetMinutes * 60 * 1000);

    const heatmapData: HeatmapAggregate[] = await Expense.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isHidden: { $ne: true },
        },
      },
      {
        $addFields: {
          effectiveOccurredAt: {
            $ifNull: ["$occurredAt", { $ifNull: ["$occuredAt", "$createdAt"] }],
          },
        },
      },
      {
        $match: {
          effectiveOccurredAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$effectiveOccurredAt",
              timezone: tzString,
            },
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          count: 1,
          totalAmount: 1,
        },
      },
      {
        $sort: { date: 1 },
      },
    ]);

    logEvent("info", "Heatmap data fetched", {
      route: "GET /expenseAnalytics/heatmap",
      userId,
      year: targetYear,
      daysWithTransactions: heatmapData.length,
    });

    return res.json({
      message: "Heatmap data fetched successfully",
      data: heatmapData,
      year: targetYear,
    });
  } catch (err) {
    logApiError(req, err, { route: "GET /expenseAnalytics/heatmap" });
    return res.status(500).json({ message: "Failed to load heatmap data" });
  }
});

export default expenseAnalyticsRouter;
