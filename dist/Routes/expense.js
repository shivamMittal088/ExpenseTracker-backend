"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const expressRouter = express_1.default.Router();
const ExpenseSchema_1 = __importDefault(require("../Models/ExpenseSchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
expressRouter.post("/expense/add", userAuth_1.default, async (req, res, next) => {
    try {
        const { amount, category, notes, payment_mode, currency } = req.body;
        // userId comes from JWT (set by userAuth middleware)
        const userId = req.user._id;
        // ✅ Create expense
        const expense = await ExpenseSchema_1.default.create({
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
});
exports.default = expressRouter;
