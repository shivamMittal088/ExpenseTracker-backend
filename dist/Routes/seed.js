"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const seedRouter = express.Router();
const TilesSchema_1 = __importDefault(require("../Models/TilesSchema"));
const ExpenseSchema_1 = __importDefault(require("../Models/ExpenseSchema"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const FollowSchema_1 = __importDefault(require("../Models/FollowSchema"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const logger_1 = require("../utils/logger");
seedRouter.post("/seed/tiles", userAuth_1.default, async (req, res) => {
    try {
        const exists = await TilesSchema_1.default.countDocuments({ isBuiltIn: true });
        if (exists > 0) {
            (0, logger_1.logEvent)("info", "Default tiles already seeded", {
                route: "POST /seed/tiles",
                userId: req.user?._id,
            });
            return res.json({
                "message": "Already seeded"
            });
        }
        const defaultTiles = await TilesSchema_1.default.insertMany([
            { name: "Food", emoji: "🍔", color: "#F97316", isBuiltIn: true },
            { name: "Travel", emoji: "🚕", color: "#3B82F6", isBuiltIn: true },
            { name: "Bills", emoji: "💡", color: "#F59E0B", isBuiltIn: true },
            { name: "Shopping", emoji: "🛍️", color: "#EC4899", isBuiltIn: true },
            { name: "Health", emoji: "💊", color: "#22C55E", isBuiltIn: true }
        ]);
        (0, logger_1.logEvent)("info", "Default tiles created", {
            route: "POST /seed/tiles",
            userId: req.user?._id,
            count: defaultTiles.length,
        });
        res.json({
            "message": "Default tiles created",
            data: defaultTiles,
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /seed/tiles" });
        res.status(500).json({ message: "Failed to seed tiles" });
    }
});
// Seed test recurring expenses for testing the recurring payment detection
seedRouter.post("/seed/recurring-expenses", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user?._id;
        // Sample recurring expenses with realistic patterns
        const recurringPatterns = [
            {
                name: "Netflix",
                emoji: "🎬",
                color: "#E50914",
                amount: 649,
                frequency: "monthly",
                payment_mode: "card",
            },
            {
                name: "Spotify",
                emoji: "🎵",
                color: "#1DB954",
                amount: 119,
                frequency: "monthly",
                payment_mode: "UPI",
            },
            {
                name: "Gym",
                emoji: "💪",
                color: "#F59E0B",
                amount: 1500,
                frequency: "monthly",
                payment_mode: "UPI",
            },
            {
                name: "Internet",
                emoji: "🌐",
                color: "#8B5CF6",
                amount: 899,
                frequency: "monthly",
                payment_mode: "card",
            },
            {
                name: "Mobile Recharge",
                emoji: "📱",
                color: "#3B82F6",
                amount: 299,
                frequency: "monthly",
                payment_mode: "UPI",
            },
            {
                name: "Groceries",
                emoji: "🛒",
                color: "#22C55E",
                amount: 2500,
                frequency: "weekly",
                payment_mode: "UPI",
                amountVariance: 500, // Add some variance to make it realistic
            },
            {
                name: "Coffee",
                emoji: "☕",
                color: "#78350F",
                amount: 180,
                frequency: "weekly",
                payment_mode: "UPI",
                amountVariance: 50,
            },
        ];
        const expenses = [];
        const now = new Date();
        for (const pattern of recurringPatterns) {
            // Generate expenses for the last 4-6 months based on frequency
            const monthsBack = pattern.frequency === "weekly" ? 3 : 5;
            for (let i = 0; i < monthsBack; i++) {
                const date = new Date(now);
                if (pattern.frequency === "monthly") {
                    date.setMonth(date.getMonth() - i);
                    date.setDate(Math.min(date.getDate(), 28)); // Avoid month-end issues
                }
                else if (pattern.frequency === "weekly") {
                    date.setDate(date.getDate() - (i * 7));
                }
                // Add small random variance to amount if specified
                const variance = pattern.amountVariance || 0;
                const amount = pattern.amount + Math.floor(Math.random() * variance * 2) - variance;
                expenses.push({
                    userId,
                    amount: Math.max(amount, 10),
                    category: {
                        name: pattern.name,
                        emoji: pattern.emoji,
                        color: pattern.color,
                    },
                    payment_mode: pattern.payment_mode,
                    occurredAt: date,
                    notes: `Test recurring - ${pattern.name}`,
                });
            }
        }
        // Insert all test expenses
        const created = await ExpenseSchema_1.default.insertMany(expenses);
        (0, logger_1.logEvent)("info", "Recurring test expenses seeded", {
            route: "POST /seed/recurring-expenses",
            userId,
            count: created.length,
        });
        return res.status(201).json({
            message: `Created ${created.length} test recurring expenses`,
            summary: recurringPatterns.map(p => ({
                name: p.name,
                frequency: p.frequency,
                amount: p.amount,
            })),
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /seed/recurring-expenses" });
        return res.status(500).json({ message: "Failed to seed recurring expenses" });
    }
});
// Delete all test recurring expenses (cleanup)
seedRouter.delete("/seed/recurring-expenses", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user?._id;
        // Delete only test expenses (those with "Test recurring" in notes)
        const result = await ExpenseSchema_1.default.deleteMany({
            userId,
            notes: { $regex: /^Test recurring/i },
        });
        (0, logger_1.logEvent)("info", "Test recurring expenses deleted", {
            route: "DELETE /seed/recurring-expenses",
            userId,
            deletedCount: result.deletedCount,
        });
        return res.json({
            message: `Deleted ${result.deletedCount} test expenses`,
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "DELETE /seed/recurring-expenses" });
        return res.status(500).json({ message: "Failed to delete test expenses" });
    }
});
// Seed followers for infinite scroll testing
seedRouter.post("/seed/followers", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const count = 200;
        const suffix = Date.now();
        const passwordHash = await bcrypt_1.default.hash("password", 10);
        const usersToCreate = Array.from({ length: count }, (_, index) => ({
            name: `Follower ${index + 1}`,
            emailId: `follower_${suffix}_${index + 1}@example.com`,
            password: passwordHash,
        }));
        const createdUsers = await UserSchema_1.default.insertMany(usersToCreate);
        const follows = createdUsers.map((user) => ({
            followerId: user._id,
            followingId: userId,
            status: "accepted",
        }));
        await FollowSchema_1.default.insertMany(follows);
        (0, logger_1.logEvent)("info", "Seed followers created", {
            route: "POST /seed/followers",
            userId,
            count: createdUsers.length,
        });
        return res.status(201).json({
            message: `Created ${createdUsers.length} followers`,
            count: createdUsers.length,
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /seed/followers" });
        return res.status(500).json({ message: "Failed to seed followers" });
    }
});
// Seed expenses for cursor pagination testing
seedRouter.post("/seed/transactions", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const count = 200;
        const now = Date.now();
        const categories = [
            { name: "Food", emoji: "🍔", color: "#F97316" },
            { name: "Travel", emoji: "🚕", color: "#3B82F6" },
            { name: "Bills", emoji: "💡", color: "#F59E0B" },
            { name: "Shopping", emoji: "🛍️", color: "#EC4899" },
            { name: "Health", emoji: "💊", color: "#22C55E" },
            { name: "Coffee", emoji: "☕", color: "#78350F" },
        ];
        const paymentModes = ["cash", "card", "bank_transfer", "wallet", "UPI"];
        const expenses = Array.from({ length: count }, (_, index) => {
            const category = categories[index % categories.length];
            const payment_mode = paymentModes[index % paymentModes.length];
            const amount = 50 + Math.floor(Math.random() * 1950);
            const occurredAt = new Date(now - index * 60 * 60 * 1000);
            return {
                userId,
                amount,
                category,
                payment_mode,
                occurredAt,
                notes: `Seeded transaction ${index + 1}`,
            };
        });
        const created = await ExpenseSchema_1.default.insertMany(expenses);
        (0, logger_1.logEvent)("info", "Seed transactions created", {
            route: "POST /seed/transactions",
            userId,
            count: created.length,
        });
        return res.status(201).json({
            message: `Created ${created.length} transactions`,
            count: created.length,
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /seed/transactions" });
        return res.status(500).json({ message: "Failed to seed transactions" });
    }
});
exports.default = seedRouter;
