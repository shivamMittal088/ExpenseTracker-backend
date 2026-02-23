"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const XLSX = __importStar(require("xlsx"));
const ExpenseSchema_1 = __importDefault(require("../Models/ExpenseSchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const logger_1 = require("../utils/logger");
const expenseExportRouter = express_1.default.Router();
// Export expenses to Excel (.xlsx)
expenseExportRouter.get("/expenseExport/excel", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user._id;
        const { startDate, endDate } = req.query;
        if ((startDate && !endDate) || (!startDate && endDate)) {
            return res.status(400).json({ message: "Provide both startDate and endDate, or omit both" });
        }
        const query = { userId, isHidden: { $ne: true } };
        if (startDate && endDate) {
            const start = new Date(`${String(startDate)}T00:00:00.000Z`);
            const end = new Date(`${String(endDate)}T23:59:59.999Z`);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
            }
            query.occurredAt = {
                $gte: start,
                $lte: end,
            };
        }
        const limit = Math.min(10000, Math.max(1, parseInt(String(req.query.limit || "5000"), 10) || 5000));
        const tzOffsetMinutes = parseInt(String(req.query.tzOffsetMinutes || "0"), 10) || 0;
        const expenses = await ExpenseSchema_1.default.find(query)
            .sort({ occurredAt: -1, _id: -1 })
            .limit(limit)
            .lean();
        const formatOccurredAt = (rawValue) => {
            if (!rawValue)
                return "";
            const utcDate = new Date(String(rawValue));
            if (Number.isNaN(utcDate.getTime()))
                return "";
            const localDate = new Date(utcDate.getTime() - tzOffsetMinutes * 60 * 1000);
            const yyyy = localDate.getFullYear();
            const mm = String(localDate.getMonth() + 1).padStart(2, "0");
            const dd = String(localDate.getDate()).padStart(2, "0");
            const hh = String(localDate.getHours()).padStart(2, "0");
            const min = String(localDate.getMinutes()).padStart(2, "0");
            const sec = String(localDate.getSeconds()).padStart(2, "0");
            return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
        };
        const rows = expenses.map((expense) => {
            const occurredAtValue = expense?.occurredAt || expense?.occuredAt || expense?.createdAt;
            const paymentModeRaw = String(expense?.payment_mode || "");
            const paymentMode = paymentModeRaw === "bank_transfer" ? "BANK_TRANSFER" : paymentModeRaw.toUpperCase();
            return {
                "Occurred At": formatOccurredAt(occurredAtValue),
                Category: expense?.category?.name || "",
                Amount: Number(expense?.amount || 0),
                "Payment Mode": paymentMode,
                Notes: expense?.notes || "",
            };
        });
        const headers = ["Occurred At", "Category", "Amount", "Payment Mode", "Notes"];
        const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
        if (rows.length === 0) {
            XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });
        }
        worksheet["!cols"] = [
            { wch: 22 },
            { wch: 24 },
            { wch: 12 },
            { wch: 16 },
            { wch: 42 },
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");
        const fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
        const dateStamp = new Date().toISOString().slice(0, 10);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=expenses-${dateStamp}.xlsx`);
        (0, logger_1.logEvent)("info", "Expenses exported to Excel", {
            route: "GET /expenseExport/excel",
            userId,
            count: rows.length,
            hasDateRange: Boolean(startDate && endDate),
            limit,
        });
        return res.status(200).send(fileBuffer);
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /expenseExport/excel" });
        return res.status(500).json({ message: "Failed to export expenses" });
    }
});
exports.default = expenseExportRouter;
