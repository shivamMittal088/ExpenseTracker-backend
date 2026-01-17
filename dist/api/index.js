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
    if (!isConnected) {
        await (0, database_1.connectDB)();
        isConnected = true;
    }
    return (0, app_1.default)(req, res);
}
