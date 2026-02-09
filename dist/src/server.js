"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = __importDefault(require("./app"));
const database_1 = require("../config/database");
const axiomClient_1 = require("../config/axiomClient");
const streakCron_1 = require("../cron/streakCron");
dotenv_1.default.config();
const PORT = process.env.PORT || 5000;
const server = http_1.default.createServer(app_1.default);
(0, database_1.connectDB)()
    .then(() => {
    console.log("Database connected successfully");
    // Start cron jobs
    (0, streakCron_1.startStreakCron)();
    void (0, axiomClient_1.sendLog)({
        type: "app_start",
        message: "Backend server started",
        port: PORT,
        dataset: process.env.AXIOM_DATASET,
    });
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
})
    .catch((err) => {
    console.error("Database connection failed ❌", err);
    process.exit(1);
});
