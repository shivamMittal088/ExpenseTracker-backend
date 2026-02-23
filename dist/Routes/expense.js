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
// Add expense
expressRouter.post("/expense/add", userAuth_1.default, async (req, res, next) => {
    try {
        const { amount, category, notes, payment_mode, occurredAt, userId: bodyUserId } = req.body || {};
        const userId = req.user?._id || bodyUserId;
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
        const tzOffsetMinutes = parseInt(String(req.query.tzOffsetMinutes || "0"), 10) || 0;
        const parseOccurredAt = (value) => {
            if (typeof value !== "string" || !value.trim())
                return null;
            const raw = value.trim();
            const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw);
            if (hasTimezone) {
                const parsed = new Date(raw);
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
            const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
            if (!match) {
                const parsed = new Date(raw);
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
            const [, y, mo, d, h, mi, s = "0"] = match;
            const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), 0) +
                tzOffsetMinutes * 60 * 1000;
            return new Date(utcMs);
        };
        const occurredAtDate = occurredAt ? parseOccurredAt(occurredAt) : new Date();
        if (occurredAt && !occurredAtDate) {
            errors.push("occurredAt is invalid");
        }
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
            occurredAt: occurredAtDate || new Date(),
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
        const rawDate = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date;
        const dateParts = rawDate.split("-").map((part) => Number(part));
        if (dateParts.length !== 3 || dateParts.some((part) => Number.isNaN(part))) {
            return res.status(400).json({ message: "Invalid date format" });
        }
        const [year, month, day] = dateParts;
        const tzOffsetMinutes = parseInt(String(req.query.tzOffsetMinutes || "0"), 10) || 0;
        const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) + tzOffsetMinutes * 60 * 1000);
        const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) + tzOffsetMinutes * 60 * 1000);
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
        const limit = Math.max(1, parseInt(String(req.query.limit || "8"), 10) || 8);
        const skip = (page - 1) * limit;
        const baseMatch = {
            userId: new mongoose_1.default.Types.ObjectId(userId),
            isHidden: { $ne: true },
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
        const hiddenBaseMatch = {
            userId: new mongoose_1.default.Types.ObjectId(userId),
            isHidden: true,
        };
        const [expenseTransactions, totals, hiddenTotals] = await Promise.all([
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
            ExpenseSchema_1.default.aggregate([
                { $match: hiddenBaseMatch },
                ...effectiveDateStages,
                {
                    $group: {
                        _id: null,
                        totalCount: { $sum: 1 },
                    },
                },
            ]),
        ]);
        const totalCount = totals[0]?.totalCount || 0;
        const totalAmount = totals[0]?.totalAmount || 0;
        const hiddenCount = hiddenTotals[0]?.totalCount || 0;
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
                hiddenCount,
            },
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /expense/:date" });
        return res.status(500).json({ message: "Failed to load expenses" });
    }
});
// Fetch all expenses with cursor pagination
expressRouter.get("/expense/paged", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user._id;
        const cursorValue = typeof req.query.cursor === "string" ? req.query.cursor : "";
        const cursor = cursorValue ? decodeExpenseCursor(cursorValue) : null;
        if (cursorValue && !cursor) {
            return res.status(400).json({ message: "Invalid cursor" });
        }
        const baseFilter = {
            userId,
            isHidden: { $ne: true },
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
            route: "GET /expense/paged",
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
        (0, logger_1.logApiError)(req, err, { route: "GET /expense/paged" });
        return res.status(500).json({ message: "Failed to load expenses" });
    }
});
exports.default = expressRouter;
