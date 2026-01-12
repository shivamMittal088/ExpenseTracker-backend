"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const profileRouter = express_1.default.Router();
profileRouter.get("/profile/view", userAuth_1.default, async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const loggedInUser = req.user;
        const loggedInUserId = loggedInUser._id;
        const profile = await UserSchema_1.default.findById(loggedInUserId).select("-password");
        if (!profile) {
            return res.status(404).json({ message: "User not found" });
        }
        res.send(profile);
    }
    catch (err) {
        res.status(400).send({ error: err.message });
    }
});
exports.default = profileRouter;
