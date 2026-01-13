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

export default expressRouter;