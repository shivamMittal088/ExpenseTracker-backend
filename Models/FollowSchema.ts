import mongoose, { Schema, Document, Types } from "mongoose";

export interface IFollow extends Document {
  followerId: Types.ObjectId;
  followingId: Types.ObjectId;
  status: "pending" | "accepted";
  note?: string;
  followedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FollowSchema = new Schema<IFollow>(
  {
    followerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    followingId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending",
      required: true,
    },
    note: {
      type: String,
      trim: true,
      maxLength: 200,
    },
    followedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate follow records
FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

FollowSchema.pre(
  ["find", "findOne", "findOneAndUpdate", "findOneAndDelete"],
  function (this: any) {
    this.populate({ path: "followerId", select: "name emailId photoURL" });
    this.populate({ path: "followingId", select: "name emailId photoURL" });
  }
);

export default mongoose.model<IFollow>("Follow", FollowSchema);
