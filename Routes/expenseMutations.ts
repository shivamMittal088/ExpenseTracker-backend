import express, { Request, Response } from "express";
import mongoose from "mongoose";
import Expense from "../Models/ExpenseSchema";
import userAuth from "../Middlewares/userAuth";
import { logApiError, logEvent } from "../utils/logger";

interface Category {
  name: string;
  color: string;
  emoji: string;
}

interface ExpenseUpdateDoc {
  amount?: number;
  category?: Category;
  notes?: string | null;
  payment_mode?: string;
  occurredAt?: Date;
}

const expenseMutationsRouter = express.Router();

// Fetch hidden expenses for a given date (YYYY-MM-DD)
expenseMutationsRouter.get("/expense/:date/hidden", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const rawDate = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date;

    const dateParts = rawDate.split("-").map((part: string) => Number(part));
    if (dateParts.length !== 3 || dateParts.some((part) => Number.isNaN(part))) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    const [year, month, day] = dateParts;

    const tzOffsetMinutes = parseInt(String(req.query.tzOffsetMinutes || "0"), 10) || 0;

    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) + tzOffsetMinutes * 60 * 1000);
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) + tzOffsetMinutes * 60 * 1000);

    const baseMatch: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
      isHidden: true,
    };

    const effectiveDateStages = [
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
            $gte: startOfDay,
            $lte: endOfDay,
          },
        },
      },
    ];

    const [hiddenExpenses, totals] = await Promise.all([
      Expense.aggregate([
        { $match: baseMatch },
        ...effectiveDateStages,
        { $sort: { effectiveOccurredAt: -1, _id: -1 } },
      ]),
      Expense.aggregate([
        { $match: baseMatch },
        ...effectiveDateStages,
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    const totalCount = totals[0]?.totalCount || 0;
    const totalAmount = totals[0]?.totalAmount || 0;

    logEvent("info", "Hidden expense list fetched", {
      route: "GET /expense/:date/hidden",
      userId,
      count: hiddenExpenses.length,
      date: rawDate,
      totalCount,
    });

    return res.json({
      message: "Hidden expense list successfully fetched",
      data: hiddenExpenses,
      meta: {
        totalCount,
        totalAmount,
      },
    });
  } catch (err) {
    logApiError(req, err, { route: "GET /expense/:date/hidden" });
    return res.status(500).json({ message: "Failed to load hidden expenses" });
  }
});

// Hide an expense (soft delete)
expenseMutationsRouter.patch(
  "/expense/:expenseId/hide",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      const { expenseId } = req.params;
      const userId = req.user!._id;

      if (!mongoose.isValidObjectId(expenseId)) {
        logEvent("warn", "Invalid expense id", {
          route: "PATCH /expense/:expenseId/hide",
          userId,
          expenseId,
        });
        return res.status(400).json({ message: "Invalid expense id" });
      }

      const hiddenExpense = await Expense.findOneAndUpdate(
        { _id: expenseId, userId, isHidden: { $ne: true } },
        {
          $set: {
            isHidden: true,
            hiddenAt: new Date(),
          },
        },
        { new: true }
      );

      if (!hiddenExpense) {
        const alreadyHidden = await Expense.findOne({ _id: expenseId, userId, isHidden: true }).lean();
        if (alreadyHidden) {
          return res.status(200).json({
            message: "Expense already hidden",
            data: alreadyHidden,
          });
        }

        logEvent("warn", "Expense not found for hide", {
          route: "PATCH /expense/:expenseId/hide",
          userId,
          expenseId,
        });
        return res.status(404).json({ message: "Expense not found" });
      }

      logEvent("info", "Expense hidden", {
        route: "PATCH /expense/:expenseId/hide",
        userId,
        expenseId,
      });

      return res.status(200).json({
        message: "Expense hidden successfully",
        data: hiddenExpense,
      });
    } catch (err) {
      logApiError(req, err, { route: "PATCH /expense/:expenseId/hide" });
      return res.status(500).json({ message: "Failed to hide expense" });
    }
  }
);

// Restore a hidden expense
expenseMutationsRouter.patch(
  "/expense/:expenseId/restore",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      const { expenseId } = req.params;
      const userId = req.user!._id;

      if (!mongoose.isValidObjectId(expenseId)) {
        logEvent("warn", "Invalid expense id", {
          route: "PATCH /expense/:expenseId/restore",
          userId,
          expenseId,
        });
        return res.status(400).json({ message: "Invalid expense id" });
      }

      const restoredExpense = await Expense.findOneAndUpdate(
        { _id: expenseId, userId, isHidden: true },
        {
          $set: {
            isHidden: false,
            hiddenAt: null,
          },
        },
        { new: true }
      );

      if (!restoredExpense) {
        logEvent("warn", "Hidden expense not found for restore", {
          route: "PATCH /expense/:expenseId/restore",
          userId,
          expenseId,
        });
        return res.status(404).json({ message: "Hidden expense not found" });
      }

      logEvent("info", "Expense restored", {
        route: "PATCH /expense/:expenseId/restore",
        userId,
        expenseId,
      });

      return res.status(200).json({
        message: "Expense restored successfully",
        data: restoredExpense,
      });
    } catch (err) {
      logApiError(req, err, { route: "PATCH /expense/:expenseId/restore" });
      return res.status(500).json({ message: "Failed to restore expense" });
    }
  }
);

// Update an expense (amount, category, notes, payment_mode, occurredAt)
expenseMutationsRouter.patch(
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
          updateDoc.occurredAt = parsed;
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

export default expenseMutationsRouter;
