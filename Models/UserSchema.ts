import mongoose, { Schema, Document } from "mongoose";
import Tiles from "./TilesSchema";

export interface IUser extends Document {
  name: string;
  emailId: string;
  password: string;
  photoURL?: string;
  statusMessage?: string;
  hideAmounts: boolean;
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

    hideAmounts: {
      type: Boolean,
      default: false,
    },

  },
  { timestamps: true } // adds createdAt & updatedAt 
);


export default mongoose.model<IUser>("User", UserSchema);
