import express, { Request, Response } from "express";
import User from "../Models/UserSchema";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const authRouter = express.Router();

/* ---------- Signup ---------- */
authRouter.post("/signup", async (req: Request, res: Response) => {
  try {
    const { emailId, password, name } = req.body;

    const existingUser = await User.findOne({ emailId });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      emailId,
      password: hashPassword,
    });

    const savedUser = await newUser.save();

    const token = jwt.sign(
      { _id: savedUser._id },
      "MYSecretKey",
      { expiresIn: "1h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      expires: new Date(Date.now() + 8 * 3600000),
    });

    res.json({ message: "Signup successful" });
  } catch (err: any) {
    res.status(400).json({ err: err.message });
  }
});

/* ---------- Login ---------- */
authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { emailId, password } = req.body;

    const user = await User.findOne({ emailId });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { _id: user._id },
      "MYSecretKey",
      { expiresIn: "1h" }
    );

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
  } catch (err: any) {
    res.status(400).json({ err: err.message });
  }
});

export default authRouter;
