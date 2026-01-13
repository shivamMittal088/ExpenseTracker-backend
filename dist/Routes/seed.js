"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const seedRouter = express.Router();
const TilesSchema_1 = __importDefault(require("../Models/TilesSchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
seedRouter.post("/seed/tiles", userAuth_1.default, async (req, res) => {
    const exists = await TilesSchema_1.default.countDocuments({ isBuiltIn: true });
    if (exists > 0)
        return res.json({
            "message": "Already seeded"
        });
    const defaultTiles = await TilesSchema_1.default.insertMany([
        { name: "Food", emoji: "🍔", color: "#F97316", isBuiltIn: true },
        { name: "Travel", emoji: "🚕", color: "#3B82F6", isBuiltIn: true },
        { name: "Bills", emoji: "💡", color: "#F59E0B", isBuiltIn: true },
        { name: "Shopping", emoji: "🛍️", color: "#EC4899", isBuiltIn: true },
        { name: "Health", emoji: "💊", color: "#22C55E", isBuiltIn: true }
    ]);
    res.json({
        "message": "Default tiles created",
        data: defaultTiles,
    });
});
exports.default = seedRouter;
