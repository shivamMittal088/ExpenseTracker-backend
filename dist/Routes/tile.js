"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tileRouter = express_1.default.Router();
const TilesSchema_1 = __importDefault(require("../Models/TilesSchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
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
        res.json(tiles);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load tiles" });
    }
});
module.exports = tileRouter;
exports.default = tileRouter;
