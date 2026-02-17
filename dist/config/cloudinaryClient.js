"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinaryClient = exports.isCloudinaryEnabled = void 0;
const cloudinary_1 = require("cloudinary");
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
const apiKey = process.env.CLOUDINARY_API_KEY || "";
const apiSecret = process.env.CLOUDINARY_API_SECRET || "";
exports.isCloudinaryEnabled = Boolean(cloudName && apiKey && apiSecret);
if (exports.isCloudinaryEnabled) {
    cloudinary_1.v2.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });
}
exports.cloudinaryClient = cloudinary_1.v2;
