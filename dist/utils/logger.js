"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logApiError = exports.logEvent = void 0;
const axiomClient_1 = require("../config/axiomClient");
const normalizeError = (err) => {
    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            stack: err.stack,
        };
    }
    if (typeof err === "string") {
        return { message: err };
    }
    return { message: "Unknown error", raw: err };
};
const logEvent = (level, message, meta = {}) => {
    void (0, axiomClient_1.sendLog)({
        level,
        message,
        ...meta,
    });
    if (process.env.NODE_ENV !== "production") {
        const method = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
        method(`[${level}] ${message}`, meta);
    }
};
exports.logEvent = logEvent;
const logApiError = (req, err, meta = {}) => {
    (0, exports.logEvent)("error", "API request failed", {
        type: "api_error",
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userId: req.user?._id,
        error: normalizeError(err),
        ...meta,
    });
};
exports.logApiError = logApiError;
