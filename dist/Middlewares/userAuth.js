"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const JWT_SECRET = "MYSecretKey";
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
        // 5️⃣ Load user
        const user = await UserSchema_1.default.findById(decoded._id);
        if (!user) {
            return res.status(401).json({ code: "INVALID_USER" });
        }
        // 6️⃣ Attach user to request
        req.user = user;
        next();
    }
    catch (err) {
        return res.status(401).json({ code: "AUTH_FAILED" });
    }
};
exports.default = userAuth;
