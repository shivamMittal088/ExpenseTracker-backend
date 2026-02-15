import mongoose, { Schema, Document } from "mongoose";
import Tiles from "./TilesSchema";

type UserPreferences = {
  darkMode: boolean;
  startWeekOnMonday: boolean;
};


export interface IUser extends Document {
  name: string;
  emailId: string;
  password: string;
  photoURL?: string;
  statusMessage?: string;
  currency: "INR" | "USD" | "EUR";
  monthlyIncome: number;
  dailyBudget: number;
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: Date | null;
  recentSearches: { userId: Schema.Types.ObjectId; searchedAt: Date }[];
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength:3,
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
      maxLength:150,
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
            type: Schema.Types.ObjectId,
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


  },
  { timestamps: true } // adds createdAt & updatedAt 
);

// Support name/email lookups for search
UserSchema.index({ name: "text", emailId: "text" });

export default mongoose.model<IUser>("User", UserSchema);
