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

export default mongoose.model<IUser>("User", UserSchema);
