import express from "express";
const expressRouter = express.Router();
import Expense from "../Models/ExpenseSchema";
import userAuth from "../Middlewares/userAuth";
import { NextFunction, Request, Response } from "express";

expressRouter.post("/expense/add",userAuth,async(req:Request,res:Response,next:NextFunction)=>{
    try{
        const {amount , category ,notes ,payment_mode, currency} = req.body;

    // userId comes from JWT (set by userAuth middleware)
      const userId = (req as any).user._id;

      // ✅ Create expense
      const expense = await Expense.create({
        amount,
        category,
        notes,
        payment_mode,
        currency,
        userId
      });

      res.status(201).json({
        success: true,
        message: "Expense added successfully",
        data: expense
      });
    }
    catch (err) {
      next(err);
    }
})


expressRouter.get("/expense/:date", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;

    const rawDate = req.params.date;

    // Validate date param
    if (!rawDate || typeof rawDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return res.status(400).json({
        message: "Invalid date format. Use YYYY-MM-DD"
      });
    }

    /*
      Convert the user's local day into a UTC time range.

      Example (India):
      User asks for 2026-01-13

      Local day:
        2026-01-13 00:00 → 2026-01-13 23:59

      UTC equivalent:
        2026-01-12 18:30 → 2026-01-13 18:30
    */

    // Local midnight
    const localStart = new Date(rawDate + "T00:00:00");

    // Convert local → UTC
    const utcStart = new Date(
      localStart.getTime() - localStart.getTimezoneOffset() * 60000
    );

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