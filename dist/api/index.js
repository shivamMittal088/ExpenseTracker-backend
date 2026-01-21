"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const app_1 = __importDefault(require("../src/app"));
const database_1 = require("../config/database");
let isConnected = false;
async function handler(req, res) {
    // Debug: Check if we even get here
    console.log("Handler called:", req.method, req.url);
    console.log("MONGODB_URI exists:", !!process.env.MONGODB_URI);
    try {
        if (!isConnected) {
            console.log("Connecting to database...");
            await (0, database_1.connectDB)();
            isConnected = true;
            console.log("Database connected");
        }
        return (0, app_1.default)(req, res);
    }
    catch (error) {
        console.error("Handler error:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: error instanceof Error ? error.message : "Unknown error",
            mongoUriExists: !!process.env.MONGODB_URI
        });
    }
}
