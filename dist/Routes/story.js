"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const multer_1 = require("../config/multer");
const cloudinaryClient_1 = require("../config/cloudinaryClient");
const StorySchema_1 = __importDefault(require("../Models/StorySchema"));
const logger_1 = require("../utils/logger");
const storyRouter = express_1.default.Router();
storyRouter.get("/stories", userAuth_1.default, async (req, res) => {
    try {
        const now = new Date();
        const { userId } = req.query;
        const filters = { expiresAt: { $gt: now } };
        if (userId && mongoose_1.default.isValidObjectId(userId)) {
            filters.userId = userId;
        }
        const stories = await StorySchema_1.default.find(filters)
            .populate("userId", "name photoURL")
            .sort({ createdAt: -1 })
            .lean();
        (0, logger_1.logEvent)("info", "Stories fetched", {
            route: "GET /stories",
            userId: req.user?._id,
            targetUserId: userId,
        });
        res.status(200).json({ stories });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /stories" });
        res.status(500).json({ message: "Failed to load stories" });
    }
});
storyRouter.post("/stories", userAuth_1.default, multer_1.storyUpload.single("story"), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        if (!req.file?.buffer) {
            return res.status(400).json({ message: "No story media uploaded" });
        }
        if (!cloudinaryClient_1.isCloudinaryEnabled) {
            return res.status(500).json({ message: "Cloudinary is not configured" });
        }
        const loggedInUserId = req.user._id;
        const publicId = `stories/${loggedInUserId}/${Date.now()}`;
        const uploadResult = await new Promise((resolve, reject) => {
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
        const caption = typeof req.body?.caption === "string" ? req.body.caption.trim() : undefined;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const story = await StorySchema_1.default.create({
            userId: loggedInUserId,
            mediaUrl: uploadResult.secure_url,
            mediaType: "image",
            caption: caption || undefined,
            expiresAt,
        });
        (0, logger_1.logEvent)("info", "Story uploaded", {
            route: "POST /stories",
            userId: loggedInUserId,
            storyId: story._id,
        });
        return res.status(201).json({
            message: "Story uploaded successfully",
            story,
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /stories" });
        return res.status(500).json({ message: "Failed to upload story" });
    }
});
exports.default = storyRouter;
