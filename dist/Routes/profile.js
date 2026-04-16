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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const userAuth_1 = __importStar(require("../Middlewares/userAuth"));
const logger_1 = require("../utils/logger");
const multer_1 = require("../config/multer");
const cloudinaryClient_1 = require("../config/cloudinaryClient");
const profileRouter = express_1.default.Router();
/**
 * GET /profile
 * - Requires userAuth middleware to populate req.user
 * - Returns the logged-in user's profile (password excluded)
 *
 * If you prefer to keep your original path, change to "/profile/view".
 */
profileRouter.get("/profile/view", userAuth_1.default, async (req, res) => {
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
/**
 * PATCH /profile/update
 * - Requires userAuth middleware to populate req.user
 * - Updates allowed fields: name, statusMessage, hideAmounts
 */
profileRouter.patch("/profile/update", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const loggedInUserId = req.user._id;
        const { name, statusMessage, hideAmounts, dailyReminderTime, tzOffsetMinutes } = req.body;
        // Build update object with only allowed fields
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (statusMessage !== undefined)
            updateData.statusMessage = statusMessage;
        if (hideAmounts !== undefined) {
            if (typeof hideAmounts !== "boolean") {
                return res.status(400).json({ message: "hideAmounts must be a boolean" });
            }
            updateData.hideAmounts = hideAmounts;
        }
        if (dailyReminderTime !== undefined) {
            if (typeof dailyReminderTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(dailyReminderTime)) {
                return res.status(400).json({ message: "dailyReminderTime must be HH:MM in 24-hour format" });
            }
            updateData.dailyReminderTime = dailyReminderTime;
            // Convert local HH:MM to UTC HH:MM using the client's timezone offset
            const offset = typeof tzOffsetMinutes === "number" ? tzOffsetMinutes : 0;
            const [h, m] = dailyReminderTime.split(":").map(Number);
            const totalLocalMinutes = h * 60 + m;
            // tzOffsetMinutes from JS is positive when behind UTC, so UTC = local + offset
            const totalUTCMinutes = ((totalLocalMinutes + offset) % 1440 + 1440) % 1440;
            const utcH = Math.floor(totalUTCMinutes / 60);
            const utcM = totalUTCMinutes % 60;
            updateData.dailyReminderUTC = `${String(utcH).padStart(2, "0")}:${String(utcM).padStart(2, "0")}`;
        }
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }
        const updatedProfile = await UserSchema_1.default.findByIdAndUpdate(loggedInUserId, { $set: updateData }, { new: true, runValidators: true }).select("-password").lean();
        if (!updatedProfile) {
            return res.status(404).json({ message: "User not found" });
        }
        await (0, userAuth_1.invalidateUserSession)(String(loggedInUserId));
        (0, logger_1.logEvent)("info", "Profile updated", {
            route: "PATCH /profile/update",
            userId: loggedInUserId,
            fields: Object.keys(updateData),
        });
        return res.status(200).json(updatedProfile);
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "PATCH /profile/update" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * POST /profile/upload-avatar
 * - Requires userAuth middleware
 * - Uploads a profile photo and updates the user's photoURL
 */
profileRouter.post("/profile/upload-avatar", userAuth_1.default, multer_1.avatarUpload.single("avatar"), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }
        const loggedInUserId = req.user._id;
        // Get the old photo URL to delete the old file
        const oldUser = await UserSchema_1.default.findById(loggedInUserId).select("photoURL").lean();
        if (!cloudinaryClient_1.isCloudinaryEnabled) {
            return res.status(500).json({ message: "Cloudinary is not configured" });
        }
        const publicId = `avatars/${loggedInUserId}/${Date.now()}`;
        let uploadResult;
        if (req.file?.buffer) {
            uploadResult = await new Promise((resolve, reject) => {
                const stream = cloudinaryClient_1.cloudinaryClient.uploader.upload_stream({
                    public_id: publicId,
                    resource_type: "image",
                }, (error, result) => {
                    if (error || !result?.secure_url) {
                        reject(error || new Error("Cloudinary upload failed"));
                        return;
                    }
                    resolve({ secure_url: result.secure_url });
                });
                stream.end(req.file?.buffer);
            });
        }
        else {
            uploadResult = await cloudinaryClient_1.cloudinaryClient.uploader.upload(req.file.path, {
                public_id: publicId,
                resource_type: "image",
            });
        }
        const photoURL = uploadResult.secure_url;
        // Update user's photoURL in database
        const updatedProfile = await UserSchema_1.default.findByIdAndUpdate(loggedInUserId, { $set: { photoURL } }, { new: true, runValidators: true }).select("-password").lean();
        if (!updatedProfile) {
            // Clean up uploaded file if user not found
            fs_1.default.unlinkSync(req.file.path);
            return res.status(404).json({ message: "User not found" });
        }
        // Delete old avatar file if it exists (local only)
        if (oldUser?.photoURL && oldUser.photoURL.startsWith("/uploads/avatars/")) {
            const oldFilePath = path_1.default.join(__dirname, "..", oldUser.photoURL);
            if (fs_1.default.existsSync(oldFilePath)) {
                fs_1.default.unlinkSync(oldFilePath);
            }
        }
        // Clean up local upload after Cloudinary upload.
        if (req.file?.path && fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        (0, logger_1.logEvent)("info", "Avatar uploaded", {
            route: "POST /profile/upload-avatar",
            userId: loggedInUserId,
            filename: req.file.filename,
        });
        return res.status(200).json({
            message: "Avatar uploaded successfully",
            photoURL,
            profile: updatedProfile,
        });
    }
    catch (err) {
        // Clean up uploaded file on error
        if (req.file) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch { }
        }
        (0, logger_1.logApiError)(req, err, { route: "POST /profile/upload-avatar" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
exports.default = profileRouter;
// What .lean() does (Mongoose)
// .lean() tells Mongoose to return plain JavaScript objects instead of Mongoose Document instances.
// Plain objects are faster and use less memory because Mongoose skips building full document objects with getters/setters, change tracking, and instance methods.
