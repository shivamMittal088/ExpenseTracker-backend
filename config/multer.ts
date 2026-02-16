import multer from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";

// Check if running on Vercel (serverless) - filesystem is read-only except /tmp
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV;

// Use /tmp on Vercel, local uploads folder otherwise
const uploadsDir = isVercel 
  ? "/tmp/avatars" 
  : path.join(__dirname, "..", "uploads", "avatars");

// Only create directory if it doesn't exist (skip on Vercel cold start for memory storage)
if (!isVercel && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// For Vercel, use memory storage (files stored in buffer, not disk)
// For local dev, use disk storage
const storage = isVercel
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => {
        // Create /tmp/avatars on Vercel if needed
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
      },
      filename: (req, _file, cb) => {
        const userId = (req as any).user?._id || "unknown";
        const ext = path.extname(_file.originalname).toLowerCase() || ".jpg";
        cb(null, `${userId}-${Date.now()}${ext}`);
      },
    });

// File filter for image uploads
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"));
  }
};

// Multer upload instance for avatar uploads
export const avatarUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

