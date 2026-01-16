"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const logger_1 = require("../utils/logger");
const profileRouter = express_1.default.Router();
/**
 * GET /profile
 * - Requires userAuth middleware to populate req.user
 * - Returns the logged-in user's profile (password excluded)
 *
 * If you prefer to keep your original path, change to "/profile/view".
 */
profileRouter.get("/profile/view", userAuth_1.default, async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const loggedInUserId = req.user._id;
        // Query fresh data from DB and exclude password
        const profile = await UserSchema_1.default.findById(loggedInUserId).select("-password").lean();
        if (!profile) {
            return res.status(404).json({ message: "User not found" });
        }
        (0, logger_1.logEvent)("info", "Profile fetched", {
            route: "GET /profile/view",
            userId: loggedInUserId,
        });
        return res.status(200).json(profile);
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /profile/view" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
exports.default = profileRouter;
// What .lean() does (Mongoose)
// .lean() tells Mongoose to return plain JavaScript objects instead of Mongoose Document instances.
// Plain objects are faster and use less memory because Mongoose skips building full document objects with getters/setters, change tracking, and instance methods.
