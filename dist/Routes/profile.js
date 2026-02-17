"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const FollowSchema_1 = __importDefault(require("../Models/FollowSchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
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
        const [followersCount, followingCount] = await Promise.all([
            FollowSchema_1.default.countDocuments({ followingId: loggedInUserId, status: "accepted" }),
            FollowSchema_1.default.countDocuments({ followerId: loggedInUserId, status: "accepted" }),
        ]);
        const profileWithDefaults = {
            ...profile,
            followersCount,
            followingCount,
        };
        (0, logger_1.logEvent)("info", "Profile fetched", {
            route: "GET /profile/view",
            userId: loggedInUserId,
        });
        return res.status(200).json(profileWithDefaults);
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /profile/view" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * PATCH /profile/update
 * - Requires userAuth middleware to populate req.user
 * - Updates allowed fields: name, statusMessage
 */
profileRouter.patch("/profile/update", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const loggedInUserId = req.user._id;
        const { name, statusMessage } = req.body;
        // Build update object with only allowed fields
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (statusMessage !== undefined)
            updateData.statusMessage = statusMessage;
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }
        const updatedProfile = await UserSchema_1.default.findByIdAndUpdate(loggedInUserId, { $set: updateData }, { new: true, runValidators: true }).select("-password").lean();
        if (!updatedProfile) {
            return res.status(404).json({ message: "User not found" });
        }
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
 * PATCH /profile/privacy
 * - Requires userAuth middleware
 * - Updates account privacy (isPublic)
 */
profileRouter.patch("/profile/privacy", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const loggedInUserId = req.user._id;
        const { isPublic } = req.body;
        if (typeof isPublic !== "boolean") {
            return res.status(400).json({ message: "isPublic must be a boolean" });
        }
        const updatedProfile = await UserSchema_1.default.findByIdAndUpdate(loggedInUserId, { $set: { isPublic } }, { new: true, runValidators: true })
            .select("-password")
            .lean();
        if (!updatedProfile) {
            return res.status(404).json({ message: "User not found" });
        }
        (0, logger_1.logEvent)("info", "Privacy updated", {
            route: "PATCH /profile/privacy",
            userId: loggedInUserId,
            isPublic,
        });
        return res.status(200).json(updatedProfile);
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "PATCH /profile/privacy" });
        return res.status(500).json({ error: err?.message ?? "Internal Server Error" });
    }
});
/**
 * GET /profile/user/:userId
 * - Requires userAuth
 * - Returns minimal public profile info for a user
 */
profileRouter.get("/profile/user/:userId", userAuth_1.default, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const { userId } = req.params;
        const user = await UserSchema_1.default.findById(userId)
            .select("name emailId photoURL statusMessage createdAt")
            .lean();
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const [followersCount, followingCount] = await Promise.all([
            FollowSchema_1.default.countDocuments({ followingId: userId, status: "accepted" }),
            FollowSchema_1.default.countDocuments({ followerId: userId, status: "accepted" }),
        ]);
        (0, logger_1.logEvent)("info", "Public profile fetched", {
            route: "GET /profile/user/:userId",
            userId: req.user._id,
            targetUserId: userId,
        });
        return res.status(200).json({
            ...user,
            followersCount,
            followingCount,
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /profile/user/:userId" });
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
