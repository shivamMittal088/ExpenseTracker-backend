"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.axiomRequestLogger = void 0;
const axiomClient_1 = require("../config/axiomClient");
const axiomRequestLogger = (req, res, next) => {
    if (!axiomClient_1.axiomReady) {
        return next();
    }
    const start = Date.now();
    res.on("finish", () => {
        const durationMs = Date.now() - start;
        const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
        void (0, axiomClient_1.sendLog)({
            type: "http_request",
            level,
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            duration_ms: durationMs,
            ip: req.ip,
            userAgent: req.get("user-agent") || undefined,
        });
    });
    next();
};
exports.axiomRequestLogger = axiomRequestLogger;
