const express = require("express");
const seedRouter = express.Router();
import Tiles from "../Models/TilesSchema"
import { Request,Response,NextFunction } from "express";
import userAuth from "../Middlewares/userAuth";

seedRouter.post("/seed/tiles", userAuth ,async (req:Request, res:Response) => {
  const exists = await Tiles.countDocuments({ isBuiltIn: true });
  if (exists > 0) return res.json(
    { 
        "message": "Already seeded" 
    });

  const defaultTiles = await Tiles.insertMany([
    { name: "Food", emoji: "🍔", color: "#F97316", isBuiltIn: true },
    { name: "Travel", emoji: "🚕", color: "#3B82F6", isBuiltIn: true },
    { name: "Bills", emoji: "💡", color: "#F59E0B", isBuiltIn: true },
    { name: "Shopping", emoji: "🛍️", color: "#EC4899", isBuiltIn: true },
    { name: "Health", emoji: "💊", color: "#22C55E", isBuiltIn: true }
  ]);

  res.json({ 
    "message": "Default tiles created",
    data : defaultTiles,
  }
  );
});

export default seedRouter;