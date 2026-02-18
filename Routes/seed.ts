const express = require("express");
const seedRouter = express.Router();
import Tiles from "../Models/TilesSchema"
import { Request, Response } from "express";
import userAuth from "../Middlewares/userAuth";
import { logApiError, logEvent } from "../utils/logger";

seedRouter.post("/seed/tiles", userAuth ,async (req:Request, res:Response) => {
  try {
    const exists = await Tiles.countDocuments({ isBuiltIn: true });
    if (exists > 0) {
      logEvent("info", "Default tiles already seeded", {
        route: "POST /seed/tiles",
        userId: (req as any).user?._id,
      });
      return res.json(
        { 
            "message": "Already seeded" 
        });
    }

    const defaultTiles = await Tiles.insertMany([
      { name: "Food", emoji: "🍔", color: "#F97316", isBuiltIn: true },
      { name: "Travel", emoji: "🚕", color: "#3B82F6", isBuiltIn: true },
      { name: "Bills", emoji: "💡", color: "#F59E0B", isBuiltIn: true },
      { name: "Shopping", emoji: "🛍️", color: "#EC4899", isBuiltIn: true },
      { name: "Health", emoji: "💊", color: "#22C55E", isBuiltIn: true }
    ]);

    logEvent("info", "Default tiles created", {
      route: "POST /seed/tiles",
      userId: (req as any).user?._id,
      count: defaultTiles.length,
    });

    res.json({ 
      "message": "Default tiles created",
      data : defaultTiles,
    }
    );
  } catch (err) {
    logApiError(req, err, { route: "POST /seed/tiles" });
    res.status(500).json({ message: "Failed to seed tiles" });
  }
});


export default seedRouter;