import mongoose, { Schema, Document } from "mongoose";

export interface ILoginHistory extends Document {
  userId: mongoose.Types.ObjectId;
  ipAddress: string;
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  location?: {
    city?: string;
    country?: string;
  };
  loginAt: Date;
  isSuccessful: boolean;
}

const LoginHistorySchema = new Schema<ILoginHistory>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  ipAddress: {
    type: String,
    required: true,
  },

  userAgent: {
    type: String,
    default: "Unknown",
  },

  browser: {
    type: String,
    default: "Unknown",
  },

  os: {
    type: String,
    default: "Unknown",
  },

  device: {
    type: String,
    enum: ["Desktop", "Mobile", "Tablet", "Unknown"],
    default: "Unknown",
  },

  location: {
    city: String,
    country: String,
  },

  loginAt: {
    type: Date,
    default: Date.now,
  },

  isSuccessful: {
    type: Boolean,
    default: true,
  },
});

// Keep only last 20 login records per user (optional cleanup)
LoginHistorySchema.index({ userId: 1, loginAt: -1 });

const LoginHistory = mongoose.model<ILoginHistory>("LoginHistory", LoginHistorySchema);
export default LoginHistory;
