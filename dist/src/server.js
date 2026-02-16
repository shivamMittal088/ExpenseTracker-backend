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
dotenv_1.default.config();
const PORT = process.env.PORT || 5000;
const server = http_1.default.createServer(app_1.default);
(0, database_1.connectDB)()
    .then(() => {
    console.log("Database connected successfully");
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
