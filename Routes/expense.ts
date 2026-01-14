import express from "express";
const expressRouter = express.Router();
import Expense from "../Models/ExpenseSchema";
import userAuth from "../Middlewares/userAuth";
import { NextFunction, Request, Response } from "express";

expressRouter.post(
  "/expense/add",
  userAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, category, notes, payment_mode, currency, occurredAt } = req.body || {};

      const normalizedPaymentMode =
        typeof payment_mode === "string"
          ? payment_mode.toLowerCase() === "upi"
            ? "UPI"
            : payment_mode.toLowerCase()
          : "";

      const allowedPaymentModes = new Set([
        "cash",
        "card",
        "bank_transfer",
        "wallet",
        "UPI",
      ]);

      const errors: string[] = [];

      if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
        errors.push("amount must be a positive number");
      }

      if (!category || typeof category.name !== "string" || !category.name.trim()) {
        errors.push("category.name is required");
      }

      if (
        category?.color &&
        typeof category.color === "string" &&
        !/^#([0-9A-Fa-f]{6})$/.test(category.color)
      ) {
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

      // Validate optional occurredAt
      let occurredAtDate: Date | null = null;
      if (occurredAt) {
        const parsed = new Date(occurredAt);
        if (Number.isNaN(parsed.getTime())) {
          errors.push("occurredAt must be a valid date string");
        } else {
          occurredAtDate = parsed;
        }
      }

      if (errors.length) {
        return res.status(400).json({ message: errors.join("; ") });
      }

      const userId = (req as any).user._id; // from userAuth

      // Use client-provided offset (same sign as getTimezoneOffset, e.g., India = -330) to align local time
      const clientOffset = Number(req.query.tzOffsetMinutes);
      const offsetMinutes = Number.isFinite(clientOffset)
        ? clientOffset
        : new Date().getTimezoneOffset();

      // Determine occurredAt in UTC: if client sent occurredAt (local), convert using their offset; else use server now
      const occurredAtUtc = occurredAtDate
        ? new Date(occurredAtDate.getTime() + offsetMinutes * 60000)
        : new Date();

      const expense = await Expense.create({
        amount,
        category: {
          name: category.name.trim(),
          color: category.color || "#CCCCCC",
          emoji: category.emoji || "✨",
        },
        notes,
        payment_mode: normalizedPaymentMode,
        currency: typeof currency === "string" ? currency.toUpperCase() : "INR",
        occurredAt: occurredAtUtc,
        userId,
      });

      res.status(201).json({
        success: true,
        message: "Expense added successfully",
        data: expense,
      });
    } catch (err) {
      next(err);
    }
  }
);


expressRouter.get("/expense/:date", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;

    const rawDate = req.params.date;

    // Validate format YYYY-MM-DD
    if (!rawDate || typeof rawDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return res.status(400).json({
        message: "Invalid date format. Use YYYY-MM-DD"
      });
    }

    // Validate actual calendar date (avoid rollovers like 2026-02-31 → Mar 2)
    const localStart = new Date(rawDate + "T00:00:00");
    if (Number.isNaN(localStart.getTime())) {
      return res.status(400).json({ message: "Invalid calendar date" });
    }

    /*
      Convert the user's local day into a UTC time range using the client's offset when provided.

      The client can send ?tzOffsetMinutes=<number> (same sign as getTimezoneOffset, e.g., India = -330)
      to ensure the window matches their local day and avoids “today appears as yesterday”.
    */

    const clientOffset = Number(req.query.tzOffsetMinutes);
    const offsetMinutes = Number.isFinite(clientOffset)
      ? clientOffset
      : localStart.getTimezoneOffset(); // fallback to server-local offset

    // Convert local → UTC using chosen offset (offset has same sign as getTimezoneOffset)
    const utcStart = new Date(localStart.getTime() + offsetMinutes * 60000);

    // End = next local midnight (UTC)
    const utcEnd = new Date(utcStart);
    utcEnd.setDate(utcEnd.getDate() + 1);

    // Query MongoDB using UTC timestamps
    const expenseTransactions = await Expense.find({
      userId,
      occurredAt: {
        $gte: utcStart,
        $lt: utcEnd
      }
    }).sort({ occurredAt: -1 });

    res.json({
      message: "Expense list successfully fetched",
      data: expenseTransactions
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load expenses" });
  }
});



export default expressRouter;