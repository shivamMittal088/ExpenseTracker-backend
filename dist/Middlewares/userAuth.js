"use strict";
// const express = require('express');
// const authRouter = express.Router();
// const User = require("../models/user");
// const jwt = require('jsonwebtoken');
// const bcrypt = require("bcrypt");
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
        // ======== COMMENTED: Single device login restriction ========
        // 3️⃣ Check if this token still exists in DB (single-device login)
        // const session = await SessionToken.findOne({ token });
        // if (!session) {
        //   return res.status(401).json({ code: "LOGGED_IN_ELSEWHERE" });
        // }
        // 4️⃣ Extra DB expiry check (safety)
        // if (session.expiresAt < new Date()) {
        //   await SessionToken.deleteOne({ token });
        //   return res.status(401).json({ code: "SESSION_EXPIRED" });
        // }
        // ======== END: Single device login restriction ========
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
// we hve created a middleware function named userAuth
// this function will verify the jwt token sent by the client in cookies
// if token is valid , it will allow the request to proceed to next middleware or route handler
// otherwise it will send an error response indicating token verification failure
// now it will act as a middleware in routes where authentication is required and to get userId of logged in user
