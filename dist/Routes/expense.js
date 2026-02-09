"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const ExpenseSchema_1 = __importDefault(require("../Models/ExpenseSchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const logger_1 = require("../utils/logger");
const expressRouter = express_1.default.Router();
const parseBool = (value) => value === true || value === "true" || value === "1" || value === 1;
expressRouter.post("/expense/add", userAuth_1.default, async (req, res, next) => {
    try {
        const { amount, category, notes, payment_mode, currency, occurredAt, userId: bodyUserId } = req.body || {};
        const userId = req.user?._id || bodyUserId; // fallback to body for Postman testing
        // Normalize payment_mode: "CASH" -> "cash", "upi" -> "UPI"
        const normalizedPaymentMode = typeof payment_mode === "string"
            ? payment_mode.toLowerCase() === "upi"
                ? "UPI"
                : payment_mode.toLowerCase()
            : "";
        const allowedPaymentModes = new Set(["cash", "card", "bank_transfer", "wallet", "UPI"]);
        const errors = [];
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
        if (currency) {
            expenseDoc.currency = currency.toUpperCase();
        }
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
        const rawDate = req.params.date;
        // Create date range for the day
        const startOfDay = new Date(rawDate + "T00:00:00.000Z");
        const endOfDay = new Date(rawDate + "T23:59:59.999Z");
        const includeHidden = parseBool(req.query.includeHidden);
        const onlyHidden = parseBool(req.query.onlyHidden);
        const expenseTransactions = await ExpenseSchema_1.default.find({
            userId,
            ...(onlyHidden ? { deleted: true } : includeHidden ? {} : { deleted: false }),
            occurredAt: {
                $gte: startOfDay,
                $lte: endOfDay,
            },
        }).sort({ occurredAt: -1 });
        (0, logger_1.logEvent)("info", "Expense list fetched", {
            route: "GET /expense/:date",
            userId,
            count: expenseTransactions.length,
            date: rawDate,
        });
        return res.json({
            message: "Expense list successfully fetched",
            data: expenseTransactions,
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /expense/:date" });
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
            (0, logger_1.logEvent)("warn", "Invalid expense id", {
                route: "PATCH /expense/:expenseId/hide",
                userId,
                expenseId,
            });
            return res.status(400).json({ message: "Invalid expense id" });
        }
        if (typeof hide !== "boolean") {
            (0, logger_1.logEvent)("warn", "Invalid hide flag", {
                route: "PATCH /expense/:expenseId/hide",
                userId,
                expenseId,
                hide,
            });
            return res.status(400).json({ message: "hide must be a boolean" });
        }
        const updated = await ExpenseSchema_1.default.findOneAndUpdate({ _id: expenseId, userId }, { deleted: hide }, { new: true });
        if (!updated) {
            (0, logger_1.logEvent)("warn", "Expense not found for hide/update", {
                route: "PATCH /expense/:expenseId/hide",
                userId,
                expenseId,
            });
            return res.status(404).json({ message: "Expense not found" });
        }
        (0, logger_1.logEvent)("info", "Expense hide updated", {
            route: "PATCH /expense/:expenseId/hide",
            userId,
            expenseId,
            hidden: updated.deleted,
        });
        return res.status(200).json({
            message: hide ? "Expense hidden" : "Expense restored",
            data: updated,
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "PATCH /expense/:expenseId/hide" });
        return res.status(500).json({ message: "Failed to update expense" });
    }
});
// Update an expense (amount, category, notes, payment_mode, currency, occurredAt)
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
            deleted: false,
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
                    deleted: { $ne: true },
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
// Get transaction count per day for heatmap (like LeetCode/GitHub contribution graph)
expressRouter.get("/expenses/heatmap/", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user._id;
        const { year } = req.query;
        // Default to current year if not provided
        const targetYear = year ? parseInt(year) : new Date().getFullYear();
        // Use IST timezone for date boundaries (UTC+5:30)
        // IST midnight = UTC 18:30 previous day
        const IST_OFFSET_HOURS = 5.5;
        // Start of year in IST (Jan 1 00:00 IST = Dec 31 18:30 UTC previous year)
        const startDate = new Date(Date.UTC(targetYear - 1, 11, 31, 18, 30, 0, 0));
        // End of year in IST (Dec 31 23:59:59 IST = Dec 31 18:29:59 UTC)
        const endDate = new Date(Date.UTC(targetYear, 11, 31, 18, 29, 59, 999));
        // Aggregate to get count of transactions per day
        const heatmapData = await ExpenseSchema_1.default.aggregate([
            {
                $match: {
                    userId: new mongoose_1.default.Types.ObjectId(userId),
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
                            timezone: "+05:30" // IST timezone
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
