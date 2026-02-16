import express, { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import Expense from "../Models/ExpenseSchema";
import userAuth from "../Middlewares/userAuth";
import { logApiError, logEvent } from "../utils/logger";

const expressRouter = express.Router();

// ======== Interfaces ========

// Category interface
interface Category {
  name: string;
  color: string;
  emoji: string;
}

// Interface for expense document
interface ExpenseDoc {
  amount: number;
  category: Category;
  notes?: string;
  payment_mode: string;
  occurredAt: Date;
  userId: mongoose.Types.ObjectId | string;
}

// Interface for expense update document
interface ExpenseUpdateDoc {
  amount?: number;
  category?: Category;
  notes?: string | null;
  payment_mode?: string;
  occurredAt?: Date;
}

// Interface for heatmap aggregation result
interface HeatmapAggregate {
  date: string;
  count: number;
  totalAmount: number;
}

// Interface for recurring payment aggregation result
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

// Interface for processed recurring payment
interface RecurringPayment {
  name: string;
  emoji: string;
  color: string;
  amount: number;
  count: number;
  frequency: "daily" | "weekly" | "bi-weekly" | "monthly" | "quarterly" | "irregular";
  frequencyLabel: string;           // Human readable: "Every 30 days"
  nextExpectedDate: string | null;  // When the next payment is likely
  estimatedMonthlyAmount: number;
  lastOccurrence: Date;
  confidenceScore: number;
  isLikelyRecurring: boolean;
}

const parseBool = (value: unknown): boolean =>
  value === true || value === "true" || value === "1" || value === 1;

const EXPENSE_PAGE_SIZE = 30;

type ExpenseCursor = {
  occurredAt: string;
  id: string;
};

const encodeExpenseCursor = (cursor: ExpenseCursor) =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64");

const decodeExpenseCursor = (value: string): ExpenseCursor | null => {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64").toString("utf8")) as ExpenseCursor;
    if (!parsed?.occurredAt || !parsed?.id) {
      return null;
    }
    if (!mongoose.isValidObjectId(parsed.id)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};



expressRouter.post(
  "/expense/add",
  userAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, category, notes, payment_mode, occurredAt, userId: bodyUserId} = req.body || {};
      const userId = req.user?._id || bodyUserId; // fallback to body for Postman testing

      // Normalize payment_mode: "CASH" -> "cash", "upi" -> "UPI"
      const normalizedPaymentMode =
        typeof payment_mode === "string"
          ? payment_mode.toLowerCase() === "upi"
            ? "UPI"
            : payment_mode.toLowerCase()
          : "";

      const allowedPaymentModes = new Set(["cash", "card", "bank_transfer", "wallet", "UPI"]);
      const errors: string[] = [];


      if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
        errors.push("Enter valid amount");
      }

      if (!category || typeof category.name !== "string" || !category.name.trim()) {
        errors.push("category.name is required");
      }

      if (category?.color && typeof category.color === "string" && !/^#([0-9A-Fa-f]{6})$/.test(category.color)) {
        errors.push("category.color must be a 6-digit hex code (e.g. #ff9900)");
      }

      if (!allowedPaymentModes.has(normalizedPaymentMode)) {
        errors.push("payment_mode must be one of cash, card, bank_transfer, wallet, UPI");
      }

      if (notes && typeof notes !== "string") {
        errors.push("notes must be a string");
      }

      // Use occurredAt from request if user picked a custom date/time, otherwise use current server time + IST offset
      const IST_OFFSET_MS = 330 * 60 * 1000;
      const occurredAtDate = occurredAt 
        ? new Date(occurredAt)  // User selected date/time from calendar/timepicker
        : new Date(Date.now() + IST_OFFSET_MS);  // Default: current time in IST

      if (errors.length) {
        logEvent("warn", "Expense validation failed", {
          route: "POST /expense/add",
          userId,
          errors,
        });
        return res.status(400).json({ message: errors.join("; ") });
      }

      const expenseDoc: ExpenseDoc = {
        amount,
        category: {
          name: category.name.trim(),
          color: category.color || "#CCCCCC",
          emoji: category.emoji || "",
        },
        notes,
        payment_mode: normalizedPaymentMode,
        occurredAt: occurredAtDate,
        userId,
      };

      const newExpense = await Expense.create(expenseDoc);

      logEvent("info", "Expense created", {
        route: "POST /expense/add",
        userId,
        expenseId: newExpense?._id,
        amount: newExpense?.amount,
        category: newExpense?.category?.name,
      });

      return res.status(201).json({
        message: "Expense added successfully",
        data: newExpense,
      });
    } catch (err) {
      logApiError(req, err, { route: "POST /expense/add" });
      return res.status(500).json({ message: "Failed to add expense" });
    }
  }
);




// Fetch expenses for a given date (YYYY-MM-DD)
expressRouter.get("/expense/:date", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const rawDate = req.params.date;

    // Create date range for the day
    const startOfDay = new Date(rawDate + "T00:00:00.000Z");
    const endOfDay = new Date(rawDate + "T23:59:59.999Z");

    const includeHidden = parseBool(req.query.includeHidden);
    const onlyHidden = parseBool(req.query.onlyHidden);

    const expenseTransactions = await Expense.find({
      userId,
      ...(onlyHidden ? { deleted: true } : includeHidden ? {} : { deleted: false }),
      occurredAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    }).sort({ occurredAt: -1 });

    logEvent("info", "Expense list fetched", {
      route: "GET /expense/:date",
      userId,
      count: expenseTransactions.length,
      date: rawDate,
    });

    return res.json({
      message: "Expense list successfully fetched",
      data: expenseTransactions,
    });
  } catch (err) {
    logApiError(req, err, { route: "GET /expense/:date" });
    return res.status(500).json({ message: "Failed to load expenses" });
  }
});

// Fetch all expenses with cursor pagination
expressRouter.get("/expenses/paged", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const cursorValue = typeof req.query.cursor === "string" ? req.query.cursor : "";
    const cursor = cursorValue ? decodeExpenseCursor(cursorValue) : null;
    if (cursorValue && !cursor) {
      return res.status(400).json({ message: "Invalid cursor" });
    }

    const baseFilter: Record<string, unknown> = {
      userId,
      deleted: { $ne: true },
    };

    const cursorFilter = cursor
      ? {
          $or: [
            { occurredAt: { $lt: new Date(cursor.occurredAt) } },
            {
              occurredAt: new Date(cursor.occurredAt),
              _id: { $lt: new mongoose.Types.ObjectId(cursor.id) },
            },
          ],
        }
      : {};

    const expenses = await Expense.find({
      ...baseFilter,
      ...cursorFilter,
    })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(EXPENSE_PAGE_SIZE)
      .lean();

    const last = expenses[expenses.length - 1];
    const nextCursor = last && expenses.length === EXPENSE_PAGE_SIZE
      ? encodeExpenseCursor({ occurredAt: new Date(last.occurredAt).toISOString(), id: String(last._id) })
      : null;

    logEvent("info", "Expenses paged fetched", {
      route: "GET /expenses/paged",
      userId,
      count: expenses.length,
    });

    return res.json({
      message: "Expenses fetched",
      data: expenses,
      nextCursor,
    });
  } catch (err) {
    logApiError(req, err as Error, { route: "GET /expenses/paged" });
    return res.status(500).json({ message: "Failed to load expenses" });
  }
});




// Soft hide / restore an expense
expressRouter.patch(
  "/expense/:expenseId/hide",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      const { expenseId } = req.params;
      const userId = req.user!._id;
      const { hide = true } = req.body ?? {};

      if (!mongoose.isValidObjectId(expenseId)) {
        logEvent("warn", "Invalid expense id", {
          route: "PATCH /expense/:expenseId/hide",
          userId,
          expenseId,
        });
        return res.status(400).json({ message: "Invalid expense id" });
      }

      if (typeof hide !== "boolean") {
        logEvent("warn", "Invalid hide flag", {
          route: "PATCH /expense/:expenseId/hide",
          userId,
          expenseId,
          hide,
        });
        return res.status(400).json({ message: "hide must be a boolean" });
      }

      const updated = await Expense.findOneAndUpdate(
        { _id: expenseId, userId },
        { deleted: hide },
        { new: true }
      );

      if (!updated) {
        logEvent("warn", "Expense not found for hide/update", {
          route: "PATCH /expense/:expenseId/hide",
          userId,
          expenseId,
        });
        return res.status(404).json({ message: "Expense not found" });
      }

      logEvent("info", "Expense hide updated", {
        route: "PATCH /expense/:expenseId/hide",
        userId,
        expenseId,
        hidden: updated.deleted,
      });

      return res.status(200).json({
        message: hide ? "Expense hidden" : "Expense restored",
        data: updated,
      });
    } catch (err) {
      logApiError(req, err, { route: "PATCH /expense/:expenseId/hide" });
      return res.status(500).json({ message: "Failed to update expense" });
    }
  }
);




// Update an expense (amount, category, notes, payment_mode, occurredAt)
expressRouter.patch(
  "/expense/:expenseId",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      const { expenseId } = req.params;
      const userId = req.user!._id;

      if (!mongoose.isValidObjectId(expenseId)) {
        logEvent("warn", "Invalid expense id", {
          route: "PATCH /expense/:expenseId",
          userId,
          expenseId,
        });
        return res.status(400).json({ message: "Invalid expense id" });
      }

      const { amount, category, notes, payment_mode, occurredAt } = req.body || {};

      const updateDoc: ExpenseUpdateDoc = {};
      const errors: string[] = [];

      if (amount !== undefined) {
        if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
          errors.push("amount must be a positive number");
        } else {
          updateDoc.amount = amount;
        }
      }

      if (category !== undefined) {
        if (!category || typeof category.name !== "string" || !category.name.trim()) {
          errors.push("category.name is required");
        }
        if (category?.color && typeof category.color === "string" && !/^#([0-9A-Fa-f]{6})$/.test(category.color)) {
          errors.push("category.color must be a 6-digit hex code (e.g. #ff9900)");
        }

        if (errors.length === 0) {
          updateDoc.category = {
            name: category.name.trim(),
            color: category.color || "#CCCCCC",
            emoji: category.emoji || "",
          };
        }
      }

      if (notes !== undefined) {
        if (notes !== null && typeof notes !== "string") {
          errors.push("notes must be a string");
        } else {
          updateDoc.notes = notes;
        }
      }

      if (payment_mode !== undefined) {
        // Normalize payment_mode: "CASH" -> "cash", "upi" -> "UPI"
        const normalizedPaymentMode =
          typeof payment_mode === "string"
            ? payment_mode.toLowerCase() === "upi"
              ? "UPI"
              : payment_mode.toLowerCase()
            : "";

        const allowedPaymentModes = new Set(["cash", "card", "bank_transfer", "wallet", "UPI"]);

        if (!allowedPaymentModes.has(normalizedPaymentMode)) {
          errors.push("payment_mode must be one of cash, card, bank_transfer, wallet, UPI");
        } else {
          updateDoc.payment_mode = normalizedPaymentMode;
        }
      }

      if (occurredAt !== undefined) {
        const parsed = new Date(occurredAt);
        if (Number.isNaN(parsed.getTime())) {
          errors.push("occurredAt must be a valid date string");
        } else {
          updateDoc.occurredAt = parsed; // Store as-is (UTC)
        }
      }

      if (errors.length) {
        logEvent("warn", "Expense update validation failed", {
          route: "PATCH /expense/:expenseId",
          userId,
          expenseId,
          errors,
        });
        return res.status(400).json({ message: errors.join("; ") });
      }

      if (Object.keys(updateDoc).length === 0) {
        logEvent("warn", "No updatable fields provided", {
          route: "PATCH /expense/:expenseId",
          userId,
          expenseId,
        });
        return res.status(400).json({ message: "No updatable fields provided" });
      }

      const updated = await Expense.findOneAndUpdate(
        { _id: expenseId, userId },
        { $set: updateDoc },
        { new: true }
      );

      if (!updated) {
        logEvent("warn", "Expense not found", {
          route: "PATCH /expense/:expenseId",
          userId,
          expenseId,
        });
        return res.status(404).json({ message: "Expense not found" });
      }

      logEvent("info", "Expense updated", {
        route: "PATCH /expense/:expenseId",
        userId,
        expenseId,
      });

      return res.status(200).json({
        message: "Expense updated",
        data: updated,
      });
    } catch (err) {
      logApiError(req, err, { route: "PATCH /expense/:expenseId" });
      return res.status(500).json({ message: "Failed to update expense" });
    }
  }
);





// Fetch expenses for a date range (for analytics - reduces 30+ API calls to 1)
expressRouter.get("/expenses/range", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    const start = new Date(startDate as string + "T00:00:00.000Z");
    const end = new Date(endDate as string + "T23:59:59.999Z");

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }

    const expenses = await Expense.find({
      userId,
      deleted: false,
      occurredAt: {
        $gte: start,
        $lte: end,
      },
    }).sort({ occurredAt: -1 });

    logEvent("info", "Expense range fetched", {
      route: "GET /expenses/range",
      userId,
      count: expenses.length,
      startDate,
      endDate,
    });

    return res.json({
      message: "Expenses fetched successfully",
      data: expenses,
    });
  } catch (err) {
    logApiError(req, err, { route: "GET /expenses/range" });
    return res.status(500).json({ message: "Failed to load expenses" });
  }
});





// Detect recurring payments based on expense patterns
expressRouter.get("/expenses/recurring", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const debug = req.query.debug === "true"; // Add ?debug=true for detailed output
    
    // Look back 6 months for pattern detection
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Aggregate expenses by category name and similar amounts (within 10% tolerance)
    const recurringData = await Expense.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          deleted: { $ne: true },
          occurredAt: { $gte: sixMonthsAgo },
        },
      },

      // these are the accumulators of the aggregation pipeline, they are used to group the expenses by category name and similar amounts, and to calculate various statistics for each group .
      {
        // Group by category name to find repeated expenses
        $group: {
          _id: "$category.name",  // Group only by category name
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
        // Filter to only include expenses that occur at least 3 times
        $match: {
          count: { $gte: 3 },
        },
      },

      {
        $project: {
          _id: 0,
          name: "$_id",  // Now _id is just the category name string
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

    // Calculate frequency (monthly, weekly, etc.) for each recurring expense
    const recurringWithFrequency: RecurringPayment[] = recurringData.map((item: RecurringAggregate) => {
      const dates = item.dates.map((d: Date) => new Date(d).getTime()).sort((a: number, b: number) => a - b);
      
      // Calculate average days between occurrences
      let totalDaysBetween = 0;
      for (let i = 1; i < dates.length; i++) {
        totalDaysBetween += (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
      }
      const avgDaysBetween = dates.length > 1 ? totalDaysBetween / (dates.length - 1) : 30;

      // Determine frequency type and human-readable label
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

      // Calculate next expected date based on last occurrence and average interval
      const lastDate = new Date(item.lastOccurrence);
      const nextDate = new Date(lastDate.getTime() + avgDaysBetween * 24 * 60 * 60 * 1000);
      const today = new Date();
      
      // Format next expected date
      let nextExpectedDate: string | null = null;
      const daysUntilNext = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilNext < 0) {
        // Overdue
        nextExpectedDate = `Overdue by ${Math.abs(daysUntilNext)} days`;
      } else if (daysUntilNext === 0) {
        nextExpectedDate = "Due today";
      } else if (daysUntilNext === 1) {
        nextExpectedDate = "Due tomorrow";
      } else if (daysUntilNext <= 7) {
        nextExpectedDate = `In ${daysUntilNext} days`;
      } else {
        nextExpectedDate = nextDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      }

      // Calculate confidence score (higher count + consistent amounts = higher confidence)
      const amountVariance = item.maxAmount - item.minAmount;
      const amountConsistency = item.avgAmount > 0 ? 1 - (amountVariance / item.avgAmount) : 0;
      const confidenceScore = Math.min(100, Math.round(
        (Math.min(item.count, 6) / 6) * 50 + // Max 50 points for frequency
        Math.max(0, amountConsistency) * 50   // Max 50 points for amount consistency
      ));

      return {
        name: item.name,
        emoji: item.category?.emoji || "💳",
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

    // Filter to only include likely recurring payments
    const likelyRecurring = recurringWithFrequency.filter(item => item.isLikelyRecurring);

    // Calculate totals
    const totalMonthlyRecurring = likelyRecurring.reduce((sum, item) => sum + item.estimatedMonthlyAmount, 0);

    logEvent("info", "Recurring payments fetched", {
      route: "GET /expenses/recurring",
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
      // Include debug info if requested
      ...(debug && {
        debug: {
          analyzedPeriod: {
            from: sixMonthsAgo.toISOString(),
            to: new Date().toISOString(),
          },
          rawGroupsFound: recurringData.length,
          allProcessed: recurringWithFrequency.map(item => ({
            name: item.name,
            count: item.count,
            frequency: item.frequency,
            frequencyLabel: item.frequencyLabel,
            nextExpectedDate: item.nextExpectedDate,
            confidenceScore: item.confidenceScore,
            isLikelyRecurring: item.isLikelyRecurring,
            reason: item.confidenceScore < 40 ? "Low confidence score" : item.count < 2 ? "Too few occurrences" : "Passed",
          })),
        },
      }),
    });
  } catch (err) {
    logApiError(req, err, { route: "GET /expenses/recurring" });
    return res.status(500).json({ message: "Failed to detect recurring payments" });
  }
});




// Get payment mode breakdown (pie chart data)
expressRouter.get("/expenses/payment-breakdown", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { period = "month" } = req.query; // week, month, 3month, 6month, year

    // Calculate date range based on period
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

    // Aggregate by payment mode
    const breakdown = await Expense.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          deleted: { $ne: true },
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

    // Calculate totals and percentages
    const grandTotal = breakdown.reduce((sum: number, item) => sum + item.totalAmount, 0);
    const totalTransactions = breakdown.reduce((sum: number, item) => sum + item.count, 0);

    // Payment mode display info
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
      route: "GET /expenses/payment-breakdown",
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
    logApiError(req, err, { route: "GET /expenses/payment-breakdown" });
    return res.status(500).json({ message: "Failed to fetch payment breakdown" });
  }
});




// Get spending trends for graphs (daily, monthly, yearly views)
expressRouter.get("/expenses/spending-trends", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { view = "daily" } = req.query; // daily, monthly, yearly

    const now = new Date();
    let startDate: Date;
    let groupFormat: string;
    let timezone = "+05:30"; // IST

    // Configure based on view type
    switch (view) {
      case "daily":
        // Last 30 days
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        groupFormat = "%Y-%m-%d";
        break;
      case "monthly":
        // Last 12 months
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 12);
        groupFormat = "%Y-%m";
        break;
      case "yearly":
        // Previous 5 years (not including current year)
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 5);
        startDate.setMonth(0, 1); // Start from Jan 1
        startDate.setHours(0, 0, 0, 0);
        groupFormat = "%Y";
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        groupFormat = "%Y-%m-%d";
    }

    // Aggregate spending by period
    const trends = await Expense.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          deleted: { $ne: true },
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

    // Fill in missing periods with zero values
    const filledTrends: typeof trends = [];
    const periodSet = new Set(trends.map(t => t.period));

    if (view === "daily") {
      // Fill last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        const period = date.toISOString().split("T")[0];
        const existing = trends.find(t => t.period === period);
        filledTrends.push(existing || { period, totalAmount: 0, count: 0, avgAmount: 0, maxAmount: 0 });
      }
    } else if (view === "monthly") {
      // Fill last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(now.getMonth() - i);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = trends.find(t => t.period === period);
        filledTrends.push(existing || { period, totalAmount: 0, count: 0, avgAmount: 0, maxAmount: 0 });
      }
    } else if (view === "yearly") {
      // Fill previous 5 years (e.g., 2021, 2022, 2023, 2024, 2025 if current year is 2026)
      const currentYear = now.getFullYear();
      for (let i = 5; i >= 1; i--) {
        const year = currentYear - i;
        const period = String(year);
        const existing = trends.find(t => t.period === period);
        filledTrends.push(existing || { period, totalAmount: 0, count: 0, avgAmount: 0, maxAmount: 0 });
      }
    }

    // Calculate summary stats
    const totalSpent = filledTrends.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalTransactions = filledTrends.reduce((sum, t) => sum + t.count, 0);
    const avgPerPeriod = filledTrends.length > 0 ? Math.round(totalSpent / filledTrends.length) : 0;
    const maxPeriod = filledTrends.reduce((max, t) => t.totalAmount > max.totalAmount ? t : max, filledTrends[0]);
    const minPeriod = filledTrends.filter(t => t.totalAmount > 0).reduce((min, t) => t.totalAmount < min.totalAmount ? t : min, filledTrends.find(t => t.totalAmount > 0) || filledTrends[0]);

    // Calculate trend (comparing last period to average)
    const lastPeriod = filledTrends[filledTrends.length - 1];
    const previousPeriods = filledTrends.slice(0, -1);
    const previousAvg = previousPeriods.length > 0 
      ? previousPeriods.reduce((sum, t) => sum + t.totalAmount, 0) / previousPeriods.length 
      : 0;
    const trendPercentage = previousAvg > 0 
      ? Math.round(((lastPeriod.totalAmount - previousAvg) / previousAvg) * 100) 
      : 0;

    logEvent("info", "Spending trends fetched", {
      route: "GET /expenses/spending-trends",
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
    logApiError(req, err, { route: "GET /expenses/spending-trends" });
    return res.status(500).json({ message: "Failed to fetch spending trends" });
  }
});




// Get transaction count per day for heatmap (like LeetCode/GitHub contribution graph)
expressRouter.get("/expenses/heatmap/", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { year } = req.query;

    // Default to current year if not provided
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
    
    // Use IST timezone for date boundaries (UTC+5:30)
    // IST midnight = UTC 18:30 previous day
    const IST_OFFSET_HOURS = 5.5;
    
    // Start of year in IST (Jan 1 00:00 IST = Dec 31 18:30 UTC previous year)
    const startDate = new Date(Date.UTC(targetYear - 1, 11, 31, 18, 30, 0, 0));
    // End of year in IST (Dec 31 23:59:59 IST = Dec 31 18:29:59 UTC)
    const endDate = new Date(Date.UTC(targetYear, 11, 31, 18, 29, 59, 999));

    // Aggregate to get count of transactions per day
    const heatmapData: HeatmapAggregate[] = await Expense.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          deleted: { $ne: true },
          occurredAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            // Convert to IST by adding 5:30 hours, then format as date
            $dateToString: { 
              format: "%Y-%m-%d", 
              date: "$occurredAt",
              timezone: "+05:30"  // IST timezone
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
      route: "GET /expenses/heatmap",
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
    logApiError(req, err, { route: "GET /expenses/heatmap" });
    return res.status(500).json({ message: "Failed to load heatmap data" });
  }
});


export default expressRouter;
