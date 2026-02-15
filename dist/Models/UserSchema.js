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
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const UserSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
    },
    emailId: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    photoURL: {
        type: String,
    },
    statusMessage: {
        type: String,
        maxLength: 150,
        //   default : `Hi , I am ${name},`
    },
    currency: {
        type: String,
        enum: ["INR", "USD", "EUR"],
        default: "INR",
    },
    monthlyIncome: {
        type: Number,
        default: 0,
        min: 0,
    },
    dailyBudget: {
        type: Number,
        default: 0,
        min: 0,
    },
    currentStreak: {
        type: Number,
        default: 0,
        min: 0,
    },
    longestStreak: {
        type: Number,
        default: 0,
        min: 0,
    },
    lastStreakDate: {
        type: Date,
        default: null,
    },
    recentSearches: {
        type: [
            {
                userId: {
                    type: mongoose_1.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                searchedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        default: [],
    },
    preferences: {
        darkMode: {
            type: Boolean,
            default: true,
        },
        startWeekOnMonday: {
            type: Boolean,
            default: true,
        },
    },
}, { timestamps: true } // adds createdAt & updatedAt 
);
// Support name/email lookups for search
UserSchema.index({ name: "text", emailId: "text" });
exports.default = mongoose_1.default.model("User", UserSchema);
