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
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const userAuth_1 = __importStar(require("../Middlewares/userAuth"));
const redisRateLimiter_1 = require("../Middlewares/redisRateLimiter");
const redisClient_1 = require("../config/redisClient");
const logger_1 = require("../utils/logger");
const authRouter = express_1.default.Router();
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_FAILURE_WINDOW_MS = 30 * 1000;
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const getLoginFailureKey = (req, emailId) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    return `ratelimit:auth:login:failed:${emailId}:${ip}`;
};
const getAttemptsRemaining = (failedAttempts) => {
    return Math.max(0, LOGIN_FAILURE_LIMIT - failedAttempts);
};
const authSignupRateLimit = (0, redisRateLimiter_1.createRedisRateLimiter)({
    keyPrefix: "ratelimit:auth:signup",
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    message: "Too many signup attempts. Please try again in a few minutes.",
});
const authPasswordUpdateRateLimit = (0, redisRateLimiter_1.createRedisRateLimiter)({
    keyPrefix: "ratelimit:auth:update-password",
    maxRequests: 8,
    windowMs: 15 * 60 * 1000,
    message: "Too many password update attempts. Please try again later.",
});
/* ---------- Signup ---------- */
authRouter.post("/auth/signup", authSignupRateLimit, async (req, res) => {
    try {
        const { password, name } = req.body;
        const emailId = normalizeEmail(req.body?.emailId);
        if (!name || !emailId || !password) {
            return res.status(400).json({ message: "Name, email and password are required" });
        }
        const existingUser = await UserSchema_1.default.findOne({ emailId });
        if (existingUser) {
            return res.status(400).json({ message: "Email already registered" });
        }
        const hashPassword = await bcrypt_1.default.hash(password, 10);
        const newUser = new UserSchema_1.default({
            name,
            emailId,
            password: hashPassword,
        });
        const savedUser = await newUser.save();
        const token = jsonwebtoken_1.default.sign({ _id: savedUser._id }, "MYSecretKey", { expiresIn: "1d" });
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);
        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "lax", // Safe now - requests come through same domain via Vercel rewrites
            secure: process.env.NODE_ENV === "production",
            expires: expiresAt,
        });
        const { password: _password, ...safeUser } = savedUser.toObject();
        (0, logger_1.logEvent)("info", "User signed up", {
            route: "POST /auth/signup",
            userId: savedUser._id,
            emailId,
        });
        res.json({
            message: "Signup successful",
            ...safeUser,
            token,
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /auth/signup" });
        res.status(400).json({ err: err.message });
    }
});
/* ---------- Login ---------- */
authRouter.post("/auth/login", async (req, res) => {
    try {
        const { password } = req.body;
        const emailId = normalizeEmail(req.body?.emailId);
        if (!emailId || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        const loginFailureKey = getLoginFailureKey(req, emailId);
        if ((0, redisClient_1.isRedisReady)()) {
            const client = (0, redisClient_1.getRedisClient)();
            const failedAttempts = Number(await client.get(loginFailureKey) || 0);
            if (failedAttempts >= LOGIN_FAILURE_LIMIT) {
                const ttlMs = await client.pTTL(loginFailureKey);
                const retryAfterSeconds = Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : LOGIN_FAILURE_WINDOW_MS) / 1000));
                res.setHeader("Retry-After", String(retryAfterSeconds));
                return res.status(429).json({
                    message: "Too many incorrect login attempts. Retry after 30 seconds.",
                    retryAfterSeconds,
                    attemptsRemaining: 0,
                });
            }
        }
        const user = await UserSchema_1.default.findOne({ emailId });
        if (!user) {
            if ((0, redisClient_1.isRedisReady)()) {
                const client = (0, redisClient_1.getRedisClient)();
                const currentCount = await client.incr(loginFailureKey);
                if (currentCount === 1) {
                    await client.pExpire(loginFailureKey, LOGIN_FAILURE_WINDOW_MS);
                }
                if (currentCount >= LOGIN_FAILURE_LIMIT) {
                    res.setHeader("Retry-After", "30");
                    return res.status(429).json({
                        message: "Too many incorrect login attempts. Retry after 30 seconds.",
                        retryAfterSeconds: 30,
                        attemptsRemaining: 0,
                    });
                }
                return res.status(400).json({
                    message: "Invalid credentials",
                    attemptsRemaining: getAttemptsRemaining(currentCount),
                });
            }
            return res.status(400).json({ message: "Invalid credentials" });
        }
        const isMatch = await bcrypt_1.default.compare(password, user.password);
        if (!isMatch) {
            if ((0, redisClient_1.isRedisReady)()) {
                const client = (0, redisClient_1.getRedisClient)();
                const currentCount = await client.incr(loginFailureKey);
                if (currentCount === 1) {
                    await client.pExpire(loginFailureKey, LOGIN_FAILURE_WINDOW_MS);
                }
                if (currentCount >= LOGIN_FAILURE_LIMIT) {
                    res.setHeader("Retry-After", "30");
                    return res.status(429).json({
                        message: "Too many incorrect login attempts. Retry after 30 seconds.",
                        retryAfterSeconds: 30,
                        attemptsRemaining: 0,
                    });
                }
                return res.status(400).json({
                    message: "Invalid credentials",
                    attemptsRemaining: getAttemptsRemaining(currentCount),
                });
            }
            return res.status(400).json({ message: "Invalid credentials" });
        }
        if ((0, redisClient_1.isRedisReady)()) {
            const client = (0, redisClient_1.getRedisClient)();
            await client.del(loginFailureKey);
        }
        // Generate new token
        const token = jsonwebtoken_1.default.sign({ _id: user._id }, "MYSecretKey", { expiresIn: "1d" });
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);
        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "lax", // Safe now - requests come through same domain via Vercel rewrites
            secure: process.env.NODE_ENV === "production",
            expires: expiresAt,
        });
        const { password: _password, ...safeUser } = user.toObject();
        (0, logger_1.logEvent)("info", "User logged in", {
            route: "POST /auth/login",
            userId: user._id,
            emailId,
        });
        res.json({ ...safeUser, token });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /auth/login" });
        res.status(400).json({ err: err.message });
    }
});
/* ---------- Get Current User ---------- */
authRouter.get("/auth/me", userAuth_1.default, (req, res) => {
    (0, logger_1.logEvent)("info", "Fetched current user", {
        route: "GET /auth/me",
        userId: req.user._id,
    });
    res.json({
        _id: req.user._id,
        name: req.user.name,
        emailId: req.user.emailId
    });
});
/* ---------- Logout ---------- */
authRouter.post("/auth/logout", userAuth_1.default, async (req, res) => {
    try {
        res.clearCookie("token");
        await (0, userAuth_1.invalidateUserSession)(String(req.user._id));
        (0, logger_1.logEvent)("info", "User logged out", {
            route: "POST /auth/logout",
            userId: req.user._id,
        });
        res.json({ message: "Logged out successfully" });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /auth/logout" });
        res.status(400).json({ err: err.message });
    }
});
/* ---------- Update Password ---------- */
authRouter.patch("/auth/update/password", userAuth_1.default, authPasswordUpdateRateLimit, async (req, res) => {
    try {
        const userId = req.user._id;
        const { oldPassword, newPassword } = req.body;
        const user = await UserSchema_1.default.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const isMatch = await bcrypt_1.default.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }
        const hashPassword = await bcrypt_1.default.hash(newPassword, 10);
        user.password = hashPassword;
        await user.save();
        res.clearCookie("token");
        await (0, userAuth_1.invalidateUserSession)(String(userId));
        (0, logger_1.logEvent)("info", "User password updated", {
            route: "PATCH /auth/update/password",
            userId,
        });
        res.json({ message: "Password updated.  Please login again." });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "PATCH /auth/update/password" });
        res.status(400).json({ err: err.message });
    }
});
exports.default = authRouter;
