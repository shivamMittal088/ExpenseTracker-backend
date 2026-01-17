"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tileRouter = express_1.default.Router();
const TilesSchema_1 = __importDefault(require("../Models/TilesSchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const logger_1 = require("../utils/logger");
// Get all tiles for the current user
tileRouter.get("/tiles", userAuth_1.default, async (req, res) => {
    try {
        const authReq = req; // 👈 cast here
        const userId = authReq.user._id;
        const tiles = await TilesSchema_1.default.find({
            $or: [
                { isBuiltIn: true }, // system tiles
                { userId: userId } // user's own tiles
            ]
        }).sort({ isBuiltIn: -1, name: 1 }); // built-ins first, then user tiles
        (0, logger_1.logEvent)("info", "Tiles fetched", {
            route: "GET /tiles",
            userId,
            count: tiles.length,
        });
        res.json(tiles);
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "GET /tiles" });
        res.status(500).json({ message: "Failed to load tiles" });
    }
});
tileRouter.post("/tiles/add", userAuth_1.default, async (req, res) => {
    try {
        const { name, color, userId, emoji } = req.body;
        const authReq = req;
        const loggedInUserId = authReq.user._id;
        const addTile = await TilesSchema_1.default.create({
            name,
            color,
            emoji,
            "userId": loggedInUserId
        });
        (0, logger_1.logEvent)("info", "Tile added", {
            route: "POST /tiles/add",
            userId: loggedInUserId,
            tileId: addTile._id,
            name: addTile.name,
        });
        res.status(201).send({
            message: "Added successfully",
            data: addTile
        });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "POST /tiles/add" });
        res.status(500).json({ message: "Failed to add tile" });
    }
});
tileRouter.patch("tiles/update", userAuth_1.default, async (req, res) => {
});
tileRouter.delete("/tiles/remove/:id", userAuth_1.default, async (req, res) => {
    try {
        const authReq = req;
        const loggedInUserId = authReq.user._id;
        const tileId = req.params.id;
        // Check if tile exists and belongs to user
        const tile = await TilesSchema_1.default.findOne({ _id: tileId, userId: loggedInUserId });
        if (!tile) {
            return res.status(404).json({ message: "Tile not found" });
        }
        if (tile.isBuiltIn) {
            return res.status(403).json({ message: "Cannot delete built-in tiles" });
        }
        await TilesSchema_1.default.deleteOne({ _id: tileId, userId: loggedInUserId });
        (0, logger_1.logEvent)("info", "Tile removed", {
            route: "DELETE /tiles/remove/:id",
            userId: loggedInUserId,
            tileId,
            tileName: tile.name,
        });
        res.status(200).json({ message: "Tile deleted successfully", tileId });
    }
    catch (err) {
        (0, logger_1.logApiError)(req, err, { route: "DELETE /tiles/remove/:id" });
        res.status(500).json({ message: "Failed to remove tile" });
    }
});
exports.default = tileRouter;
