"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateUserSession = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const redisClient_1 = require("../config/redisClient");
const JWT_SECRET = "MYSecretKey";
const SESSION_CACHE_TTL = 300; // 5 minutes in seconds
const getSessionKey = (userId) => `user:session:${userId}`;
const userAuth = async (req, res, next) => {
    try {
        // Check cookie first, then Authorization header as fallback (for iOS)
        let token = req.cookies?.token;
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }
        // 1️⃣ No token found anywhere
        if (!token) {
            return res.status(401).json({ code: "NO_TOKEN" });
        }
        // 2️⃣ Verify JWT
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch (err) {
            if (err.name === "TokenExpiredError") {
                return res.status(401).json({ code: "SESSION_EXPIRED" });
            }
            return res.status(401).json({ code: "INVALID_TOKEN" });
        }
        // 3️⃣ Check Redis session cache
        if ((0, redisClient_1.isRedisReady)()) {
            try {
                const cached = await (0, redisClient_1.getRedisClient)().get(getSessionKey(decoded._id));
                if (cached) {
                    req.user = JSON.parse(cached);
                    return next();
                }
            }
            catch {
                // Redis error → fall through to MongoDB
            }
        }
        // 4️⃣ Cache miss or Redis down → load from MongoDB
        const user = await UserSchema_1.default.findById(decoded._id)
            .select("_id name emailId")
            .lean();
        if (!user) {
            return res.status(401).json({ code: "INVALID_USER" });
        }
        // Minimal object with only the fields routes actually use
        const sessionUser = {
            _id: String(user._id),
            name: user.name,
            emailId: user.emailId,
        };
        // 5️⃣ Write to Redis cache (fire-and-forget)
        if ((0, redisClient_1.isRedisReady)()) {
            (0, redisClient_1.getRedisClient)()
                .set(getSessionKey(sessionUser._id), JSON.stringify(sessionUser), { EX: SESSION_CACHE_TTL })
                .catch(() => { });
        }
        // 6️⃣ Attach user to request
        req.user = sessionUser;
        next();
    }
    catch (err) {
        return res.status(401).json({ code: "AUTH_FAILED" });
    }
};
exports.default = userAuth;
/**
 * Invalidate the cached session for a user.
 * Call on: logout, password change, profile update, privacy toggle.
 */
const invalidateUserSession = async (userId) => {
    if ((0, redisClient_1.isRedisReady)()) {
        try {
            await (0, redisClient_1.getRedisClient)().del(getSessionKey(userId));
        }
        catch {
            // Silently ignore — next request will just hit MongoDB
        }
    }
};
exports.invalidateUserSession = invalidateUserSession;
