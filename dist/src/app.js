"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../config/database");
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("../Routes/auth"));
const profile_1 = __importDefault(require("../Routes/profile"));
const expense_1 = __importDefault(require("../Routes/expense"));
const seed_1 = __importDefault(require("../Routes/seed"));
const tile_1 = __importDefault(require("../Routes/tile"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
// Middlewares
app.use((0, cors_1.default)({
    origin: FRONTEND_ORIGIN,
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// Routes
app.use("/api/auth/", auth_1.default);
app.use("/api/", profile_1.default);
app.use("/api/", expense_1.default);
app.use("/api/", seed_1.default);
app.use("/api/", tile_1.default);
app.get("/test", (req, res) => {
    res.send("Server alive");
});
const server = http_1.default.createServer(app);
(0, database_1.connectDB)()
    .then(() => {
    console.log("Database connected successfully");
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
})
    .catch((err) => {
    console.error("Database connection failed ❌", err);
    process.exit(1);
});
