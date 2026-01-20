import express, { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import Expense from "../Models/ExpenseSchema";
import userAuth from "../Middlewares/userAuth";
import { logApiError, logEvent } from "../utils/logger";

const expressRouter = express.Router();

// Interface for expense document
interface ExpenseDoc {
  amount: number;
  category: {
    name: string;
    color: string;
    emoji: string;
  };
  notes?: string;
  payment_mode: string;
  occurredAt: Date;
  userId: mongoose.Types.ObjectId | string;
  currency?: string;
}

const parseBool = (value: unknown): boolean =>
  value === true || value === "true" || value === "1" || value === 1;



expressRouter.post(
  "/expense/add",
  userAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, category, notes, payment_mode, currency, occurredAt, userId: bodyUserId} = req.body || {};
      const userId = (req as any).user?._id || bodyUserId; // fallback to body for Postman testing

      // Normalize payment_mode: "CASH" -> "cash", "upi" -> "UPI"
      const normalizedPaymentMode =
        typeof payment_mode === "string"
          ? payment_mode.toLowerCase() === "upi"
            ? "UPI"
            : payment_mode.toLowerCase()
          : "";

      const allowedPaymentModes = new Set(["cash", "card", "bank_transfer", "wallet", "UPI"]);
      const errors: string[] = [];

      /*
      // With Array (slower) - has to check each item one by one
      const allowedModes = ["cash", "card", "bank_transfer", "wallet", "UPI"];
      allowedModes.includes("UPI");  // O(n) - checks 5 items

      // With Set (faster) - hash-based lookup
      const allowedModes = new Set(["cash", "card", "bank_transfer", "wallet", "UPI"]);
      allowedModes.has("UPI");  // O(1) - instant
      */


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

      if (currency && (typeof currency !== "string" || currency.length !== 3)) {
        errors.push("currency must be a 3-letter code (e.g. INR)");
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

      const expenseDoc: any = {
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

      if (currency) {
        expenseDoc.currency = currency.toUpperCase();
      }

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
    const userId = (req as any).user._id;
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

// Soft hide / restore an expense
expressRouter.patch(
  "/expense/:expenseId/hide",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      const { expenseId } = req.params;
      const userId = (req as any).user._id;
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




// Update an expense (amount, category, notes, payment_mode, currency, occurredAt)
expressRouter.patch(
  "/expense/:expenseId",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      const { expenseId } = req.params;
      const userId = (req as any).user._id;

      if (!mongoose.isValidObjectId(expenseId)) {
        logEvent("warn", "Invalid expense id", {
          route: "PATCH /expense/:expenseId",
          userId,
          expenseId,
        });
        return res.status(400).json({ message: "Invalid expense id" });
      }

      const { amount, category, notes, payment_mode, currency, occurredAt } = req.body || {};

      const updateDoc: any = {};
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

      if (currency !== undefined) {
        if (typeof currency !== "string" || currency.length !== 3) {
          errors.push("currency must be a 3-letter code (e.g. INR)");
        } else {
          updateDoc.currency = currency.toUpperCase();
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
    const userId = (req as any).user._id;
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


export default expressRouter;
