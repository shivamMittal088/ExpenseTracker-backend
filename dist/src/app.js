"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const axiomLogger_1 = require("../Middlewares/axiomLogger");
const auth_1 = __importDefault(require("../Routes/auth"));
const profile_1 = __importDefault(require("../Routes/profile"));
const search_1 = __importDefault(require("../Routes/search"));
const follow_1 = __importDefault(require("../Routes/follow"));
const expense_1 = __importDefault(require("../Routes/expense"));
const seed_1 = __importDefault(require("../Routes/seed"));
const tile_1 = __importDefault(require("../Routes/tile"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const ALLOWED_ORIGINS = FRONTEND_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
// Middlewares
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin)
            return callback(null, true);
        // Allow exact matches from ALLOWED_ORIGINS
        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        // Allow all Vercel preview deployments for this project
        if (origin.endsWith('.vercel.app') && origin.includes('expense-tracker')) {
            return callback(null, true);
        }
        // Allow custom domain
        if (origin.endsWith('track-expense.com')) {
            return callback(null, true);
        }
        // Allow localhost for development
        if (origin.startsWith('http://localhost:')) {
            return callback(null, true);
        }
        callback(null, false);
    },
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use(axiomLogger_1.axiomRequestLogger);
// Serve static files from uploads directory
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "..", "uploads")));
// Routes
app.use("/api/auth/", auth_1.default);
app.use("/api/", profile_1.default);
app.use("/api/", search_1.default);
app.use("/api/", follow_1.default);
app.use("/api/", expense_1.default);
app.use("/api/", seed_1.default);
app.use("/api/", tile_1.default);
app.get("/test", (req, res) => {
    res.send("Server alive");
});
exports.default = app;
