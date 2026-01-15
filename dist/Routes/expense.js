"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const ExpenseSchema_1 = __importDefault(require("../Models/ExpenseSchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const expressRouter = express_1.default.Router();
const parseBool = (value) => value === true || value === "true" || value === "1" || value === 1;
expressRouter.post("/expense/add", userAuth_1.default, async (req, res, next) => {
    try {
        const { amount, category, notes, payment_mode, currency, occurredAt } = req.body || {};
        const userId = req.user?._id;
        const normalizedPaymentMode = typeof payment_mode === "string"
            ? payment_mode.toLowerCase() === "upi"
                ? "UPI"
                : payment_mode.toLowerCase()
            : "";
        const allowedPaymentModes = new Set(["cash", "card", "bank_transfer", "wallet", "UPI"]);
        const errors = [];
        if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
            errors.push("amount must be a positive number");
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
        let occurredAtDate = new Date();
        if (occurredAt !== undefined) {
            const parsed = new Date(occurredAt);
            if (Number.isNaN(parsed.getTime())) {
                errors.push("occurredAt must be a valid date string");
            }
            else {
                const clientOffset = Number(req.query.tzOffsetMinutes);
                const offsetMinutes = Number.isFinite(clientOffset) ? clientOffset : parsed.getTimezoneOffset();
                occurredAtDate = new Date(parsed.getTime() + offsetMinutes * 60000);
            }
        }
        if (errors.length) {
            return res.status(400).json({ message: errors.join("; ") });
        }
        const expenseDoc = {
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
        const newExpense = await ExpenseSchema_1.default.create(expenseDoc);
        return res.status(201).json({
            message: "Expense added successfully",
            data: newExpense,
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to add expense" });
    }
});
// Fetch expenses for a given local calendar date (YYYY-MM-DD), honoring optional tzOffsetMinutes
expressRouter.get("/expense/:date", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user._id;
        const rawDate = req.params.date;
        if (!rawDate || typeof rawDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
            return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
        }
        const localStart = new Date(rawDate + "T00:00:00");
        if (Number.isNaN(localStart.getTime())) {
            return res.status(400).json({ message: "Invalid calendar date" });
        }
        const clientOffset = Number(req.query.tzOffsetMinutes);
        const offsetMinutes = Number.isFinite(clientOffset) ? clientOffset : localStart.getTimezoneOffset();
        const utcStart = new Date(localStart.getTime() + offsetMinutes * 60000);
        const utcEnd = new Date(utcStart);
        utcEnd.setDate(utcEnd.getDate() + 1);
        const includeHidden = parseBool(req.query.includeHidden);
        const onlyHidden = parseBool(req.query.onlyHidden);
        const expenseTransactions = await ExpenseSchema_1.default.find({
            userId,
            ...(onlyHidden ? { deleted: true } : includeHidden ? {} : { deleted: false }),
            occurredAt: {
                $gte: utcStart,
                $lt: utcEnd,
            },
        }).sort({ occurredAt: -1 });
        return res.json({
            message: "Expense list successfully fetched",
            data: expenseTransactions,
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to load expenses" });
    }
});
// Soft hide / restore an expense
expressRouter.patch("/expense/:expenseId/hide", userAuth_1.default, async (req, res) => {
    try {
        const { expenseId } = req.params;
        const userId = req.user._id;
        const { hide = true } = req.body ?? {};
        if (!mongoose_1.default.isValidObjectId(expenseId)) {
            return res.status(400).json({ message: "Invalid expense id" });
        }
        if (typeof hide !== "boolean") {
            return res.status(400).json({ message: "hide must be a boolean" });
        }
        const updated = await ExpenseSchema_1.default.findOneAndUpdate({ _id: expenseId, userId }, { deleted: hide }, { new: true });
        if (!updated) {
            return res.status(404).json({ message: "Expense not found" });
        }
        return res.status(200).json({
            message: hide ? "Expense hidden" : "Expense restored",
            data: updated,
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to update expense" });
    }
});
// Update an expense (amount, category, notes, payment_mode, currency, occurredAt)
expressRouter.patch("/expense/:expenseId", userAuth_1.default, async (req, res) => {
    try {
        const { expenseId } = req.params;
        const userId = req.user._id;
        if (!mongoose_1.default.isValidObjectId(expenseId)) {
            return res.status(400).json({ message: "Invalid expense id" });
        }
        const { amount, category, notes, payment_mode, currency, occurredAt } = req.body || {};
        const updateDoc = {};
        const errors = [];
        if (amount !== undefined) {
            if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
                errors.push("amount must be a positive number");
            }
            else {
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
            }
            else {
                updateDoc.notes = notes;
            }
        }
        if (payment_mode !== undefined) {
            const normalizedPaymentMode = typeof payment_mode === "string"
                ? payment_mode.toLowerCase() === "upi"
                    ? "UPI"
                    : payment_mode.toLowerCase()
                : "";
            const allowedPaymentModes = new Set(["cash", "card", "bank_transfer", "wallet", "UPI"]);
            if (!allowedPaymentModes.has(normalizedPaymentMode)) {
                errors.push("payment_mode must be one of cash, card, bank_transfer, wallet, UPI");
            }
            else {
                updateDoc.payment_mode = normalizedPaymentMode;
            }
        }
        if (currency !== undefined) {
            if (typeof currency !== "string" || currency.length !== 3) {
                errors.push("currency must be a 3-letter code (e.g. INR)");
            }
            else {
                updateDoc.currency = currency.toUpperCase();
            }
        }
        if (occurredAt !== undefined) {
            const parsed = new Date(occurredAt);
            if (Number.isNaN(parsed.getTime())) {
                errors.push("occurredAt must be a valid date string");
            }
            else {
                const clientOffset = Number(req.query.tzOffsetMinutes);
                const offsetMinutes = Number.isFinite(clientOffset) ? clientOffset : parsed.getTimezoneOffset();
                updateDoc.occurredAt = new Date(parsed.getTime() + offsetMinutes * 60000);
            }
        }
        if (errors.length) {
            return res.status(400).json({ message: errors.join("; ") });
        }
        if (Object.keys(updateDoc).length === 0) {
            return res.status(400).json({ message: "No updatable fields provided" });
        }
        const updated = await ExpenseSchema_1.default.findOneAndUpdate({ _id: expenseId, userId }, { $set: updateDoc }, { new: true });
        if (!updated) {
            return res.status(404).json({ message: "Expense not found" });
        }
        return res.status(200).json({
            message: "Expense updated",
            data: updated,
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to update expense" });
    }
});
exports.default = expressRouter;
