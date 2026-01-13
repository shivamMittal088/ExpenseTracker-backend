import express from "express";
const tileRouter = express.Router();
import Tiles from "../Models/TilesSchema";
import { Request,Response} from "express";
import userAuth from "../Middlewares/userAuth";
import { IUser } from "../Models/UserSchema";

interface AuthRequest extends Request {
  user: IUser;
}

// Get all tiles for the current user
tileRouter.get("/tiles", userAuth ,async (req:Request, res:Response) => {
  try {
     const authReq = req as AuthRequest; // 👈 cast here
    const userId = authReq.user._id;

    const tiles = await Tiles.find({
      $or: [
        { isBuiltIn: true },   // system tiles
        { userId: userId }    // user's own tiles
      ]
    }).sort({ isBuiltIn: -1, name: 1 }); // built-ins first, then user tiles

    res.json(tiles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load tiles" });
  }
});

module.exports = tileRouter;

export default tileRouter;
