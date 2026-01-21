"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const SessionTokenSchema_1 = __importDefault(require("../Models/SessionTokenSchema"));
const LoginHistorySchema_1 = __importDefault(require("../Models/LoginHistorySchema"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const logger_1 = require("../utils/logger");
const ua_parser_js_1 = require("ua-parser-js");
const authRouter = express_1.default.Router();
const TOKEN_EXPIRY_MS = 1 * 60 * 60 * 1000; // 1 hour
// Helper to parse user agent and get client IP
const getClientInfo = (req) => {
    const parser = new ua_parser_js_1.UAParser(req.headers["user-agent"] || "");
    const result = parser.getResult();
    // Get IP address (handle proxies)
    const forwarded = req.headers["x-forwarded-for"];
    const ip = forwarded
        ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0])
        : req.ip || req.socket.remoteAddress || "Unknown";
    // Determine device type
    let device = "Desktop";
    if (result.device.type === "mobile")
        device = "Mobile";
    else if (result.device.type === "tablet")
        device = "Tablet";
    else if (!result.device.type && result.os.name)
        device = "Desktop";
    else
        device = "Unknown";
    return {
        ipAddress: ip,
        userAgent: req.headers["user-agent"] || "Unknown",
        browser: result.browser.name
            ? `${result.browser.name} ${result.browser.version || ""}`.trim()
            : "Unknown",
        os: result.os.name
            ? `${result.os.name} ${result.os.version || ""}`.trim()
            : "Unknown",
        device,
    };
};
// Helper to record login history
const recordLogin = async (userId, req, isSuccessful) => {
    try {
        const clientInfo = getClientInfo(req);
        await LoginHistorySchema_1.default.create({
            userId,
            ...clientInfo,
            isSuccessful,
            loginAt: new Date(),
        });
        // Keep only last 20 records per user
        const count = await LoginHistorySchema_1.default.countDocuments({ userId });
        if (count > 20) {
            const oldRecords = await LoginHistorySchema_1.default.find({ userId })
                .sort({ loginAt: 1 })
                .limit(count - 20);
            const idsToDelete = oldRecords.map((r) => r._id);
            await LoginHistorySchema_1.default.deleteMany({ _id: { $in: idsToDelete } });
        }
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { context: "recordLogin" });
    }
};
/* ---------- Signup ---------- */
authRouter.post("/signup", async (req, res) => {
    try {
        const { emailId, password, name } = req.body;
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
        const token = jsonwebtoken_1.default.sign({ _id: savedUser._id }, "MYSecretKey", { expiresIn: "1h" });
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);
        // ======== COMMENTED: Single device login restriction ========
        // Delete any existing session & create new
        // await SessionToken. findOneAndDelete({ userId: savedUser._id });
        await SessionTokenSchema_1.default.create({
            userId: savedUser._id,
            token: token,
            expiresAt: expiresAt
        });
        // ======== END: Single device login restriction ========
        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "lax", // Safe now - requests come through same domain via Vercel rewrites
            secure: process.env.NODE_ENV === "production",
            expires: expiresAt,
        });
        (0, logger_1.logEvent)("info", "User signed up", {
            route: "POST /signup",
            userId: savedUser._id,
            emailId,
        });
        res.json({ message: "Signup successful", token });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /signup" });
        res.status(400).json({ err: err.message });
    }
});
/* ---------- Login ---------- */
authRouter.post("/login", async (req, res) => {
    try {
        const { emailId, password } = req.body;
        const user = await UserSchema_1.default.findOne({ emailId });
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        const isMatch = await bcrypt_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        // ======== COMMENTED: Single device login restriction ========
        // Delete old session (kicks out old device)
        // await SessionToken.findOneAndDelete({ userId: user._id });
        // ======== END: Single device login restriction ========
        // Generate new token
        const token = jsonwebtoken_1.default.sign({ _id: user._id }, "MYSecretKey", { expiresIn: "1h" });
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);
        // Create new session
        await SessionTokenSchema_1.default.create({
            userId: user._id,
            token: token,
            expiresAt: expiresAt
        });
        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "lax", // Safe now - requests come through same domain via Vercel rewrites
            secure: process.env.NODE_ENV === "production",
            expires: expiresAt,
        });
        // Record successful login
        await recordLogin(user._id.toString(), req, true);
        const { password: _password, ...safeUser } = user.toObject();
        (0, logger_1.logEvent)("info", "User logged in", {
            route: "POST /login",
            userId: user._id,
            emailId,
        });
        res.json({ ...safeUser, token });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /login" });
        res.status(400).json({ err: err.message });
    }
});
/* ---------- Get Current User ---------- */
authRouter.get("/me", userAuth_1.default, (req, res) => {
    (0, logger_1.logEvent)("info", "Fetched current user", {
        route: "GET /me",
        userId: req.user._id,
    });
    res.json({
        _id: req.user._id,
        name: req.user.name,
        emailId: req.user.emailId
    });
});
/* ---------- Logout ---------- */
authRouter.post("/logout", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user._id;
        await SessionTokenSchema_1.default.deleteOne({ userId: userId });
        res.clearCookie("token");
        (0, logger_1.logEvent)("info", "User logged out", {
            route: "POST /logout",
            userId,
        });
        res.json({ message: "Logged out successfully" });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /logout" });
        res.status(400).json({ err: err.message });
    }
});
/* ---------- Update Password ---------- */
authRouter.patch("/update/password", userAuth_1.default, async (req, res) => {
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
        await SessionTokenSchema_1.default.deleteOne({ userId: userId });
        res.clearCookie("token");
        (0, logger_1.logEvent)("info", "User password updated", {
            route: "PATCH /update/password",
            userId,
        });
        res.json({ message: "Password updated.  Please login again." });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "PATCH /update/password" });
        res.status(400).json({ err: err.message });
    }
});
exports.default = authRouter;
