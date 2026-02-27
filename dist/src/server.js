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
const redisClient_1 = require("../config/redisClient");
dotenv_1.default.config();
const PORT = process.env.PORT || 5000;
const server = http_1.default.createServer(app_1.default);
server.on("error", (err) => {
    if (err?.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Stop the existing process/container or set a different PORT.`);
        process.exit(1);
    }
    if (err?.code === "EACCES") {
        console.error(`Permission denied while trying to bind to port ${PORT}.`);
        process.exit(1);
    }
    console.error("Server failed to start:", err);
    process.exit(1);
});
(0, database_1.connectDB)()
    .then(() => {
    console.log("Database connected successfully");
    void (0, redisClient_1.connectRedisClient)()
        .then(() => {
        console.log("Redis connected successfully");
    })
        .catch((err) => {
        console.warn("Redis connection failed. Continuing without Redis-backed features.", err?.message || err);
    });
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        void (0, axiomClient_1.sendLog)({
            type: "app_start",
            message: "Backend server started",
            port: PORT,
            dataset: process.env.AXIOM_DATASET,
        });
    });
})
    .catch((err) => {
    console.error("Database connection failed ❌", err);
    process.exit(1);
});
