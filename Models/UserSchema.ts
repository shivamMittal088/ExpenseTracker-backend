import mongoose, { Schema, Document } from "mongoose";
import Tiles from "./TilesSchema";

export interface IUser extends Document {
  name: string;
  emailId: string;
  password: string;
  photoURL?: string;
  statusMessage?: string;
  isPublic: boolean;
  recentSearches: { userId: Schema.Types.ObjectId; searchedAt: Date }[];
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

    isPublic: {
      type: Boolean,
      default: true,
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

  },
  { timestamps: true } // adds createdAt & updatedAt 
);

// Support name/email lookups for search
UserSchema.index({ name: "text", emailId: "text" });

export default mongoose.model<IUser>("User", UserSchema);
