"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const XLSX = __importStar(require("xlsx"));
const ExpenseSchema_1 = __importDefault(require("../Models/ExpenseSchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const logger_1 = require("../utils/logger");
const expressRouter = express_1.default.Router();
const EXPENSE_PAGE_SIZE = 30;
const encodeExpenseCursor = (cursor) => Buffer.from(JSON.stringify(cursor), "utf8").toString("base64");
const decodeExpenseCursor = (value) => {
    try {
        const parsed = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
        if (!parsed?.occurredAt || !parsed?.id) {
            return null;
        }
        if (!mongoose_1.default.isValidObjectId(parsed.id)) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
};
expressRouter.post("/expense/add", userAuth_1.default, async (req, res, next) => {
    try {
        const { amount, category, notes, payment_mode, occurredAt, userId: bodyUserId } = req.body || {};
        const userId = req.user?._id || bodyUserId; // fallback to body for Postman testing
        // Normalize payment_mode: "CASH" -> "cash", "upi" -> "UPI"
        const normalizedPaymentMode = typeof payment_mode === "string"
            ? payment_mode.toLowerCase() === "upi"
                ? "UPI"
                : payment_mode.toLowerCase()
            : "";
        const allowedPaymentModes = new Set(["cash", "card", "bank_transfer", "wallet", "UPI"]);
        const errors = [];
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
            ? new Date(occurredAt) // User selected date/time from calendar/timepicker
            : new Date(Date.now() + IST_OFFSET_MS); // Default: current time in IST
        if (errors.length) {
            (0, logger_1.logEvent)("warn", "Expense validation failed", {
                route: "POST /expense/add",
                userId,
                errors,
            });
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
        const newExpense = await ExpenseSchema_1.default.create(expenseDoc);
        (0, logger_1.logEvent)("info", "Expense created", {
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
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /expense/add" });
        return res.status(500).json({ message: "Failed to add expense" });
    }
});
// Fetch expenses for a given date (YYYY-MM-DD)
expressRouter.get("/expense/:date", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user._id;
        const rawDate = Array.isArray(req.params.date)
            ? req.params.date[0]
            : req.params.date;
        const dateParts = rawDate.split("-").map((part) => Number(part));
        if (dateParts.length !== 3 || dateParts.some((part) => Number.isNaN(part))) {
            return res.status(400).json({ message: "Invalid date format" });
        }
        const [year, month, day] = dateParts;
        const tzOffsetMinutes = parseInt(String(req.query.tzOffsetMinutes || "0"), 10) || 0;
        // Create date range for the day
        const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) + tzOffsetMinutes * 60 * 1000);
        const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) + tzOffsetMinutes * 60 * 1000);
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
        const limit = Math.max(1, parseInt(String(req.query.limit || "8"), 10) || 8);
        const skip = (page - 1) * limit;
        const baseMatch = {
            userId: new mongoose_1.default.Types.ObjectId(userId),
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
        const [expenseTransactions, totals] = await Promise.all([
            ExpenseSchema_1.default.aggregate([
                { $match: baseMatch },
                ...effectiveDateStages,
                { $sort: { effectiveOccurredAt: -1, _id: -1 } },
                { $skip: skip },
                { $limit: limit },
            ]),
            ExpenseSchema_1.default.aggregate([
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
        const totalPages = Math.max(1, Math.ceil(totalCount / limit));
        (0, logger_1.logEvent)("info", "Expense list fetched", {
            route: "GET /expense/:date",
            userId,
            count: expenseTransactions.length,
            date: rawDate,
            page,
            limit,
            totalCount,
        });
        return res.json({
            message: "Expense list successfully fetched",
            data: expenseTransactions,
            meta: {
                page,
                limit,
                totalCount,
                totalPages,
                totalAmount,
            },
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /expense/:date" });
        return res.status(500).json({ message: "Failed to load expenses" });
    }
});
// Fetch all expenses with cursor pagination
expressRouter.get("/expenses/paged", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user._id;
        const cursorValue = typeof req.query.cursor === "string" ? req.query.cursor : "";
        const cursor = cursorValue ? decodeExpenseCursor(cursorValue) : null;
        if (cursorValue && !cursor) {
            return res.status(400).json({ message: "Invalid cursor" });
        }
        const baseFilter = {
            userId,
        };
        const cursorFilter = cursor
            ? {
                $or: [
                    { occurredAt: { $lt: new Date(cursor.occurredAt) } },
                    {
                        occurredAt: new Date(cursor.occurredAt),
                        _id: { $lt: new mongoose_1.default.Types.ObjectId(cursor.id) },
                    },
                ],
            }
            : {};
        const expenses = await ExpenseSchema_1.default.find({
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
        (0, logger_1.logEvent)("info", "Expenses paged fetched", {
            route: "GET /expenses/paged",
            userId,
            count: expenses.length,
        });
        return res.json({
            message: "Expenses fetched",
            data: expenses,
            nextCursor,
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /expenses/paged" });
        return res.status(500).json({ message: "Failed to load expenses" });
    }
});
// Update an expense (amount, category, notes, payment_mode, occurredAt)
expressRouter.patch("/expense/:expenseId", userAuth_1.default, async (req, res) => {
    try {
        const { expenseId } = req.params;
        const userId = req.user._id;
        if (!mongoose_1.default.isValidObjectId(expenseId)) {
            (0, logger_1.logEvent)("warn", "Invalid expense id", {
                route: "PATCH /expense/:expenseId",
                userId,
                expenseId,
            });
            return res.status(400).json({ message: "Invalid expense id" });
        }
        const { amount, category, notes, payment_mode, occurredAt } = req.body || {};
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
            // Normalize payment_mode: "CASH" -> "cash", "upi" -> "UPI"
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
        if (occurredAt !== undefined) {
            const parsed = new Date(occurredAt);
            if (Number.isNaN(parsed.getTime())) {
                errors.push("occurredAt must be a valid date string");
            }
            else {
                updateDoc.occurredAt = parsed; // Store as-is (UTC)
            }
        }
        if (errors.length) {
            (0, logger_1.logEvent)("warn", "Expense update validation failed", {
                route: "PATCH /expense/:expenseId",
                userId,
                expenseId,
                errors,
            });
            return res.status(400).json({ message: errors.join("; ") });
        }
        if (Object.keys(updateDoc).length === 0) {
            (0, logger_1.logEvent)("warn", "No updatable fields provided", {
                route: "PATCH /expense/:expenseId",
                userId,
                expenseId,
            });
            return res.status(400).json({ message: "No updatable fields provided" });
        }
        const updated = await ExpenseSchema_1.default.findOneAndUpdate({ _id: expenseId, userId }, { $set: updateDoc }, { new: true });
        if (!updated) {
            (0, logger_1.logEvent)("warn", "Expense not found", {
                route: "PATCH /expense/:expenseId",
                userId,
                expenseId,
            });
            return res.status(404).json({ message: "Expense not found" });
        }
        (0, logger_1.logEvent)("info", "Expense updated", {
            route: "PATCH /expense/:expenseId",
            userId,
            expenseId,
        });
        return res.status(200).json({
            message: "Expense updated",
            data: updated,
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "PATCH /expense/:expenseId" });
        return res.status(500).json({ message: "Failed to update expense" });
    }
});
// Fetch expenses for a date range (for analytics - reduces 30+ API calls to 1)
expressRouter.get("/expenses/range", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user._id;
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ message: "startDate and endDate are required" });
        }
        const start = new Date(startDate + "T00:00:00.000Z");
        const end = new Date(endDate + "T23:59:59.999Z");
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
        }
        const expenses = await ExpenseSchema_1.default.find({
            userId,
            occurredAt: {
                $gte: start,
                $lte: end,
            },
        }).sort({ occurredAt: -1 });
        (0, logger_1.logEvent)("info", "Expense range fetched", {
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
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /expenses/range" });
        return res.status(500).json({ message: "Failed to load expenses" });
    }
});
// Export expenses to Excel (.xlsx)
expressRouter.get("/expenses/export/excel", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user._id;
        const { startDate, endDate } = req.query;
        if ((startDate && !endDate) || (!startDate && endDate)) {
            return res.status(400).json({ message: "Provide both startDate and endDate, or omit both" });
        }
        const query = { userId };
        if (startDate && endDate) {
            const start = new Date(`${String(startDate)}T00:00:00.000Z`);
            const end = new Date(`${String(endDate)}T23:59:59.999Z`);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
            }
            query.occurredAt = {
                $gte: start,
                $lte: end,
            };
        }
        const limit = Math.min(10000, Math.max(1, parseInt(String(req.query.limit || "5000"), 10) || 5000));
        const tzOffsetMinutes = parseInt(String(req.query.tzOffsetMinutes || "0"), 10) || 0;
        const expenses = await ExpenseSchema_1.default.find(query)
            .sort({ occurredAt: -1, _id: -1 })
            .limit(limit)
            .lean();
        const formatOccurredAt = (rawValue) => {
            if (!rawValue)
                return "";
            const utcDate = new Date(String(rawValue));
            if (Number.isNaN(utcDate.getTime()))
                return "";
            const localDate = new Date(utcDate.getTime() - tzOffsetMinutes * 60 * 1000);
            const yyyy = localDate.getFullYear();
            const mm = String(localDate.getMonth() + 1).padStart(2, "0");
            const dd = String(localDate.getDate()).padStart(2, "0");
            const hh = String(localDate.getHours()).padStart(2, "0");
            const min = String(localDate.getMinutes()).padStart(2, "0");
            const sec = String(localDate.getSeconds()).padStart(2, "0");
            return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
        };
        const rows = expenses.map((expense) => {
            const occurredAtValue = expense?.occurredAt || expense?.occuredAt || expense?.createdAt;
            const paymentModeRaw = String(expense?.payment_mode || "");
            const paymentMode = paymentModeRaw === "bank_transfer" ? "BANK_TRANSFER" : paymentModeRaw.toUpperCase();
            return {
                "Occurred At": formatOccurredAt(occurredAtValue),
                Category: expense?.category?.name || "",
                Amount: Number(expense?.amount || 0),
                "Payment Mode": paymentMode,
                Notes: expense?.notes || "",
            };
        });
        const headers = ["Occurred At", "Category", "Amount", "Payment Mode", "Notes"];
        const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
        if (rows.length === 0) {
            XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });
        }
        worksheet["!cols"] = [
            { wch: 22 },
            { wch: 24 },
            { wch: 12 },
            { wch: 16 },
            { wch: 42 },
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");
        const fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
        const dateStamp = new Date().toISOString().slice(0, 10);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=expenses-${dateStamp}.xlsx`);
        (0, logger_1.logEvent)("info", "Expenses exported to Excel", {
            route: "GET /expenses/export/excel",
            userId,
            count: rows.length,
            hasDateRange: Boolean(startDate && endDate),
            limit,
        });
        return res.status(200).send(fileBuffer);
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /expenses/export/excel" });
        return res.status(500).json({ message: "Failed to export expenses" });
    }
});
// Detect recurring payments based on expense patterns
expressRouter.get("/expenses/recurring", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user._id;
        const debug = req.query.debug === "true"; // Add ?debug=true for detailed output
        // Look back 6 months for pattern detection
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        // Aggregate expenses by category name and similar amounts (within 10% tolerance)
        const recurringData = await ExpenseSchema_1.default.aggregate([
            {
                $match: {
                    userId: new mongoose_1.default.Types.ObjectId(userId),
                    occurredAt: { $gte: sixMonthsAgo },
                },
            },
            // these are the accumulators of the aggregation pipeline, they are used to group the expenses by category name and similar amounts, and to calculate various statistics for each group .
            {
                // Group by category name to find repeated expenses
                $group: {
                    _id: "$category.name", // Group only by category name
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
                    name: "$_id", // Now _id is just the category name string
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
        ]);
        // Calculate frequency (monthly, weekly, etc.) for each recurring expense
        const recurringWithFrequency = recurringData.map((item) => {
            const dates = item.dates.map((d) => new Date(d).getTime()).sort((a, b) => a - b);
            // Calculate average days between occurrences
            let totalDaysBetween = 0;
            for (let i = 1; i < dates.length; i++) {
                totalDaysBetween += (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
            }
            const avgDaysBetween = dates.length > 1 ? totalDaysBetween / (dates.length - 1) : 30;
            // Determine frequency type and human-readable label
            let frequency;
            let frequencyLabel;
            let estimatedMonthlyAmount;
            if (avgDaysBetween <= 3) {
                frequency = "daily";
                frequencyLabel = "Every day";
                estimatedMonthlyAmount = item.avgAmount * 30;
            }
            else if (avgDaysBetween <= 10) {
                frequency = "weekly";
                frequencyLabel = "Every week";
                estimatedMonthlyAmount = item.avgAmount * 4;
            }
            else if (avgDaysBetween <= 20) {
                frequency = "bi-weekly";
                frequencyLabel = "Every 2 weeks";
                estimatedMonthlyAmount = item.avgAmount * 2;
            }
            else if (avgDaysBetween <= 45) {
                frequency = "monthly";
                frequencyLabel = "Every month";
                estimatedMonthlyAmount = item.avgAmount;
            }
            else if (avgDaysBetween <= 100) {
                frequency = "quarterly";
                frequencyLabel = "Every 3 months";
                estimatedMonthlyAmount = Math.round(item.avgAmount / 3);
            }
            else {
                frequency = "irregular";
                frequencyLabel = `Every ~${Math.round(avgDaysBetween)} days`;
                estimatedMonthlyAmount = Math.round(item.avgAmount / (avgDaysBetween / 30));
            }
            // Calculate next expected date based on last occurrence and average interval
            const lastDate = new Date(item.lastOccurrence);
            const nextDate = new Date(lastDate.getTime() + avgDaysBetween * 24 * 60 * 60 * 1000);
            const today = new Date();
            // Format next expected date
            let nextExpectedDate = null;
            const daysUntilNext = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilNext < 0) {
                // Overdue
                nextExpectedDate = `Overdue by ${Math.abs(daysUntilNext)} days`;
            }
            else if (daysUntilNext === 0) {
                nextExpectedDate = "Due today";
            }
            else if (daysUntilNext === 1) {
                nextExpectedDate = "Due tomorrow";
            }
            else if (daysUntilNext <= 7) {
                nextExpectedDate = `In ${daysUntilNext} days`;
            }
            else {
                nextExpectedDate = nextDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            }
            // Calculate confidence score (higher count + consistent amounts = higher confidence)
            const amountVariance = item.maxAmount - item.minAmount;
            const amountConsistency = item.avgAmount > 0 ? 1 - (amountVariance / item.avgAmount) : 0;
            const confidenceScore = Math.min(100, Math.round((Math.min(item.count, 6) / 6) * 50 + // Max 50 points for frequency
                Math.max(0, amountConsistency) * 50 // Max 50 points for amount consistency
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
        (0, logger_1.logEvent)("info", "Recurring payments fetched", {
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
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /expenses/recurring" });
        return res.status(500).json({ message: "Failed to detect recurring payments" });
    }
});
// Get payment mode breakdown (pie chart data)
expressRouter.get("/expenses/payment-breakdown", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user._id;
        const { period = "month" } = req.query; // week, month, 3month, 6month, year
        // Calculate date range based on period
        const now = new Date();
        let startDate;
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
        const breakdown = await ExpenseSchema_1.default.aggregate([
            {
                $match: {
                    userId: new mongoose_1.default.Types.ObjectId(userId),
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
        ]);
        // Calculate totals and percentages
        const grandTotal = breakdown.reduce((sum, item) => sum + item.totalAmount, 0);
        const totalTransactions = breakdown.reduce((sum, item) => sum + item.count, 0);
        // Payment mode display info
        const paymentModeInfo = {
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
        (0, logger_1.logEvent)("info", "Payment breakdown fetched", {
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
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /expenses/payment-breakdown" });
        return res.status(500).json({ message: "Failed to fetch payment breakdown" });
    }
});
// Get spending trends for graphs (daily, monthly, yearly views)
expressRouter.get("/expenses/spending-trends", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user._id;
        const { view = "daily" } = req.query; // daily, monthly, yearly
        const now = new Date();
        let startDate;
        let groupFormat;
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
        const trends = await ExpenseSchema_1.default.aggregate([
            {
                $match: {
                    userId: new mongoose_1.default.Types.ObjectId(userId),
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
        ]);
        // Fill in missing periods with zero values
        const filledTrends = [];
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
        }
        else if (view === "monthly") {
            // Fill last 12 months
            for (let i = 11; i >= 0; i--) {
                const date = new Date(now);
                date.setMonth(now.getMonth() - i);
                const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
                const existing = trends.find(t => t.period === period);
                filledTrends.push(existing || { period, totalAmount: 0, count: 0, avgAmount: 0, maxAmount: 0 });
            }
        }
        else if (view === "yearly") {
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
        (0, logger_1.logEvent)("info", "Spending trends fetched", {
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
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /expenses/spending-trends" });
        return res.status(500).json({ message: "Failed to fetch spending trends" });
    }
});
// Get transaction count per day for heatmap (like LeetCode/GitHub contribution graph)
expressRouter.get("/expenses/heatmap/", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user._id;
        const { year } = req.query;
        const targetYear = year ? parseInt(year) : new Date().getFullYear();
        const tzOffsetMinutes = parseInt(String(req.query.tzOffsetMinutes || "0"), 10) || 0;
        const tzSign = tzOffsetMinutes <= 0 ? "+" : "-";
        const tzAbs = Math.abs(tzOffsetMinutes);
        const tzHours = String(Math.floor(tzAbs / 60)).padStart(2, "0");
        const tzMinutes = String(tzAbs % 60).padStart(2, "0");
        const tzString = `${tzSign}${tzHours}:${tzMinutes}`;
        const startDate = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0, 0) + tzOffsetMinutes * 60 * 1000);
        const endDate = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999) + tzOffsetMinutes * 60 * 1000);
        const heatmapData = await ExpenseSchema_1.default.aggregate([
            {
                $match: {
                    userId: new mongoose_1.default.Types.ObjectId(userId),
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
        (0, logger_1.logEvent)("info", "Heatmap data fetched", {
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
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /expenses/heatmap" });
        return res.status(500).json({ message: "Failed to load heatmap data" });
    }
});
exports.default = expressRouter;
