"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVercel = exports.avatarUploadsDir = exports.avatarUpload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Check if running on Vercel (serverless) - filesystem is read-only except /tmp
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV;
exports.isVercel = isVercel;
// Use /tmp on Vercel, local uploads folder otherwise
const uploadsDir = isVercel
    ? "/tmp/avatars"
    : path_1.default.join(__dirname, "..", "uploads", "avatars");
// Only create directory if it doesn't exist (skip on Vercel cold start for memory storage)
if (!isVercel && !fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// For Vercel, use memory storage (files stored in buffer, not disk)
// For local dev, use disk storage
const storage = isVercel
    ? multer_1.default.memoryStorage()
    : multer_1.default.diskStorage({
        destination: (_req, _file, cb) => {
            // Create /tmp/avatars on Vercel if needed
            if (!fs_1.default.existsSync(uploadsDir)) {
                fs_1.default.mkdirSync(uploadsDir, { recursive: true });
            }
            cb(null, uploadsDir);
        },
        filename: (req, _file, cb) => {
            const userId = req.user?._id || "unknown";
            const ext = path_1.default.extname(_file.originalname).toLowerCase() || ".jpg";
            cb(null, `${userId}-${Date.now()}${ext}`);
        },
    });
// File filter for image uploads
const fileFilter = (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"));
    }
};
// Multer upload instance for avatar uploads
exports.avatarUpload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
    },
});
// Export uploads directory path for use in other files
exports.avatarUploadsDir = uploadsDir;
