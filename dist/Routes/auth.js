"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const authRouter = express_1.default.Router();
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
        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            expires: new Date(Date.now() + 8 * 3600000),
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
        const token = jsonwebtoken_1.default.sign({ _id: user._id }, "MYSecretKey", { expiresIn: "1h" });
        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            expires: new Date(Date.now() + 8 * 3600000),
        });
        const { password: _password, ...safeUser } = user.toObject();
        // This is object destructuring with renaming and rest operator.
        // Take password out of the object, store it in a variable called _password,
        // and put everything else into safeUser.
        // user is a Mongoose document, not a plain JS object.
        // It contains extra MongoDB stuff (_id, methods, metadata, etc.).
        console.log("Logged in successfully ");
        res.json(safeUser);
    }
    catch (err) {
        res.status(400).json({ err: err.message });
    }
});
exports.default = authRouter;
