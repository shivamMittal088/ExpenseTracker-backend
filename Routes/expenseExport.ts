import express, { Request, Response } from "express";
import * as XLSX from "xlsx";
import Expense from "../Models/ExpenseSchema";
import userAuth from "../Middlewares/userAuth";
import { logApiError, logEvent } from "../utils/logger";

const expenseExportRouter = express.Router();

// Export expenses to Excel (.xlsx)
expenseExportRouter.get("/expenseExport/excel", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { startDate, endDate } = req.query;

    if ((startDate && !endDate) || (!startDate && endDate)) {
      return res.status(400).json({ message: "Provide both startDate and endDate, or omit both" });
    }

    const query: Record<string, unknown> = { userId, isHidden: { $ne: true } };

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

    const expenses = await Expense.find(query)
      .sort({ occurredAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    const formatOccurredAt = (rawValue: unknown) => {
      if (!rawValue) return "";
      const utcDate = new Date(String(rawValue));
      if (Number.isNaN(utcDate.getTime())) return "";
      const localDate = new Date(utcDate.getTime() - tzOffsetMinutes * 60 * 1000);
      const yyyy = localDate.getFullYear();
      const mm = String(localDate.getMonth() + 1).padStart(2, "0");
      const dd = String(localDate.getDate()).padStart(2, "0");
      const hh = String(localDate.getHours()).padStart(2, "0");
      const min = String(localDate.getMinutes()).padStart(2, "0");
      const sec = String(localDate.getSeconds()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
    };

    const rows = expenses.map((expense: any) => {
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

    const fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const dateStamp = new Date().toISOString().slice(0, 10);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=expenses-${dateStamp}.xlsx`);

    logEvent("info", "Expenses exported to Excel", {
      route: "GET /expenseExport/excel",
      userId,
      count: rows.length,
      hasDateRange: Boolean(startDate && endDate),
      limit,
    });

    return res.status(200).send(fileBuffer);
  } catch (err) {
    logApiError(req, err, { route: "GET /expenseExport/excel" });
    return res.status(500).json({ message: "Failed to export expenses" });
  }
});

export default expenseExportRouter;
