"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const { Schema } = mongoose;
const TilesSchema = new Schema({
    // null = system tile, ObjectId = user tile
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    emoji: {
        type: String,
        default: "📦"
    },
    color: {
        type: String,
        default: "#A3A3A3",
        match: /^#([0-9A-Fa-f]{6})$/
    },
    isActive: {
        type: Boolean,
        default: true
    },
    position: {
        type: Number,
        default: 0
    },
    isPinned: {
        type: Boolean,
        default: false
    },
    isBuiltIn: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });
TilesSchema.index({ userId: 1, name: 1 }, { unique: true });
exports.default = mongoose.model("Tiles", TilesSchema);
