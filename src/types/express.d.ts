import { IUser } from "../Models/UserSchema";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}