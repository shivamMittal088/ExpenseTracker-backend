import mongoose, { Schema, Document } from "mongoose";

// ref: "User" tells Mongoose that this field points to a document in the User collection.
export type CategoryColor =
  | "blue"
  | "emerald"
  | "teal"
  | "cyan"
  | "sky"
  | "indigo"
  | "violet"
  | "purple"
  | "fuchsia"
  | "pink"
  | "rose"
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "lime";

export interface ICategory extends Document {
  userId: mongoose.Types.ObjectId;

  name: string;
  emoji: string;
  color: CategoryColor;

  isVisible: boolean;
  order: number;
  isCustom: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    emoji: {
      type: String,
      required: true,
    },

    color: {
      type: String,
      enum: [
        "blue",
        "emerald",
        "teal",
        "cyan",
        "sky",
        "indigo",
        "violet",
        "purple",
        "fuchsia",
        "pink",
        "rose",
        "red",
        "orange",
        "amber",
        "yellow",
        "lime",
      ],
      default: "blue",
    },

    isVisible: {
      type: Boolean,
      default: true,
    },

    order: {
      type: Number,
      default: 0,
    },

    isCustom: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate category names per user
CategorySchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model<ICategory>("Category", CategorySchema);
