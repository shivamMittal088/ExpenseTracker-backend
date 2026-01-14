"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const SessionTokenSchema_1 = __importDefault(require("../Models/SessionTokenSchema"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const userAuth_1 = __importDefault(require("../Middlewares/userAuth"));
const authRouter = express_1.default.Router();
const TOKEN_EXPIRY_MS = 1 * 60 * 60 * 1000; // 1 hour
/* ---------- Signup ---------- */
authRouter.post("/signup", async (req, res) => {
    try {
        const { emailId, password, name } = req.body;
        const existingUser = await UserSchema_1.default.findOne({ emailId });
        if (existingUser) {
            return res.status(400).json({ message: "Email already registered" });
        }
        const hashPassword = await bcrypt_1.default.hash(password, 10);
        const newUser = new UserSchema_1.default({
            name,
            emailId,
            password: hashPassword,
        });
        const savedUser = await newUser.save();
        const token = jsonwebtoken_1.default.sign({ _id: savedUser._id }, "MYSecretKey", { expiresIn: "1h" });
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);
        // Delete any existing session & create new
        await SessionTokenSchema_1.default.findOneAndDelete({ userId: savedUser._id });
        await SessionTokenSchema_1.default.create({
            userId: savedUser._id,
            token: token,
            expiresAt: expiresAt
        });
        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            expires: expiresAt,
        });
        res.json({ message: "Signup successful" });
    }
    catch (err) {
        res.status(400).json({ err: err.message });
    }
});
/* ---------- Login ---------- */
authRouter.post("/login", async (req, res) => {
    try {
        const { emailId, password } = req.body;
        const user = await UserSchema_1.default.findOne({ emailId });
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        const isMatch = await bcrypt_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        // Delete old session (kicks out old device)
        await SessionTokenSchema_1.default.findOneAndDelete({ userId: user._id });
        // Generate new token
        const token = jsonwebtoken_1.default.sign({ _id: user._id }, "MYSecretKey", { expiresIn: "1h" });
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);
        // Create new session
        await SessionTokenSchema_1.default.create({
            userId: user._id,
            token: token,
            expiresAt: expiresAt
        });
        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            expires: expiresAt,
        });
        const { password: _password, ...safeUser } = user.toObject();
        console.log("Logged in successfully");
        res.json(safeUser);
    }
    catch (err) {
        res.status(400).json({ err: err.message });
    }
});
/* ---------- Get Current User ---------- */
authRouter.get("/me", userAuth_1.default, (req, res) => {
    res.json({
        _id: req.user._id,
        name: req.user.name,
        emailId: req.user.emailId
    });
});
/* ---------- Logout ---------- */
authRouter.post("/logout", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user._id;
        await SessionTokenSchema_1.default.deleteOne({ userId: userId });
        res.clearCookie("token");
        res.json({ message: "Logged out successfully" });
    }
    catch (err) {
        res.status(400).json({ err: err.message });
    }
});
/* ---------- Update Password ---------- */
authRouter.patch("/update/password", userAuth_1.default, async (req, res) => {
    try {
        const userId = req.user._id;
        const { oldPassword, newPassword } = req.body;
        const user = await UserSchema_1.default.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const isMatch = await bcrypt_1.default.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }
        const hashPassword = await bcrypt_1.default.hash(newPassword, 10);
        user.password = hashPassword;
        await user.save();
        await SessionTokenSchema_1.default.deleteOne({ userId: userId });
        res.clearCookie("token");
        res.json({ message: "Password updated.  Please login again." });
    }
    catch (err) {
        res.status(400).json({ err: err.message });
    }
});
exports.default = authRouter;
