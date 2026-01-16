import express from "express";
const tileRouter = express.Router();
import Tiles from "../Models/TilesSchema";
import { Request,Response} from "express";
import userAuth from "../Middlewares/userAuth";
import { IUser } from "../Models/UserSchema";
import { logApiError, logEvent } from "../utils/logger";

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

    logEvent("info", "Tiles fetched", {
      route: "GET /tiles",
      userId,
      count: tiles.length,
    });

    res.json(tiles);
  } catch (err) {
    logApiError(req, err, { route: "GET /tiles" });
    res.status(500).json({ message: "Failed to load tiles" });
  }
});



tileRouter.post("/tiles/add", userAuth, async(req:Request,res:Response)=>{
  try{
    const {name , color ,userId ,emoji} = req.body;

  const authReq = req as AuthRequest;
  const loggedInUserId = authReq.user._id;

  const addTile = await Tiles.create({
    name,
    color,
    emoji,
    "userId" : loggedInUserId
  })

  logEvent("info", "Tile added", {
    route: "POST /tiles/add",
    userId: loggedInUserId,
    tileId: addTile._id,
    name: addTile.name,
  });

  res.status(201).send({
    message : "Added successfully",
    data: addTile
  })
  }

  catch(err){
    logApiError(req, err, { route: "POST /tiles/add" });
    res.status(500).json({ message: "Failed to add tile" });
  }
})

tileRouter.patch("tiles/update", userAuth , async(req:Request ,res:Response)=>{

})


tileRouter.delete("/tiles/remove/:id" ,userAuth , async(req:Request ,res:Response)=>{
  try{
    const authReq = req as AuthRequest;
    const loggedInUserId = authReq.user._id;
    const tileId = req.params.id;

    const deletedTile = await Tiles.deleteOne({
    userId : loggedInUserId,
    _id : tileId,
    isBuiltIn:false // prevent deleting default tiles .
  })

  logEvent("info", "Tile removed", {
    route: "DELETE /tiles/remove/:id",
    userId: loggedInUserId,
    tileId,
    deletedCount: deletedTile.deletedCount,
  });

  res.status(201).send("tile deleted successfully");
  }catch(err){
    logApiError(req, err, { route: "DELETE /tiles/remove/:id" });
    res.status(500).json({ message: "Failed to remove tile" });
  }
})


export default tileRouter;
