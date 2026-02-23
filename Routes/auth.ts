import express, { Request, Response } from "express";
import User from "../Models/UserSchema";
import Follow from "../Models/FollowSchema";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import userAuth from "../Middlewares/userAuth";
import { logApiError, logEvent } from "../utils/logger";

const authRouter = express.Router();

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day

/* ---------- Signup ---------- */
authRouter.post("/auth/signup", async (req:  Request, res: Response) => {
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
      password:  hashPassword,
    });

    const savedUser = await newUser.save();

    const token = jwt.sign(
      { _id: savedUser._id },
      "MYSecretKey",
      { expiresIn: "1d" }
    );

    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax", // Safe now - requests come through same domain via Vercel rewrites
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
    });

    const { password: _password, ...safeUser } = savedUser.toObject();

    logEvent("info", "User signed up", {
      route: "POST /auth/signup",
      userId: savedUser._id,
      emailId,
    });

    res.json({
      message: "Signup successful",
      ...safeUser,
      followersCount: 0,
      followingCount: 0,
      token,
    });
  } catch (err: any) {
    logApiError(req, err, { route: "POST /auth/signup" });
    res.status(400).json({ err: err.message });
  }
});




/* ---------- Login ---------- */
authRouter.post("/auth/login", async (req:  Request, res: Response) => {
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

    // Generate new token
    const token = jwt.sign(
      { _id: user._id },
      "MYSecretKey",
      { expiresIn: "1d" }
    );

    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax", // Safe now - requests come through same domain via Vercel rewrites
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
    });

    const { password: _password, ...safeUser } = user.toObject();

    const [followersCount, followingCount] = await Promise.all([
      Follow.countDocuments({ followingId: user._id, status: "accepted" }),
      Follow.countDocuments({ followerId: user._id, status: "accepted" }),
    ]);

    logEvent("info", "User logged in", {
      route: "POST /auth/login",
      userId: user._id,
      emailId,
    });

    res.json({ ...safeUser, followersCount, followingCount, token });
  } catch (err: any) {
    logApiError(req, err, { route: "POST /auth/login" });
    res.status(400).json({ err: err.message });
  }
});



/* ---------- Get Current User ---------- */
authRouter.get("/auth/me", userAuth, (req: Request, res: Response) => {
  logEvent("info", "Fetched current user", {
    route: "GET /auth/me",
    userId: (req as any).user._id,
  });

  res.json({
    _id:  (req as any).user._id,
    name: (req as any).user.name,
    emailId: (req as any).user.emailId
  });
});



/* ---------- Logout ---------- */
authRouter.post("/auth/logout", userAuth, async (req: Request, res:  Response) => {
  try {
    res.clearCookie("token");

    logEvent("info", "User logged out", {
      route: "POST /auth/logout",
      userId: (req as any).user._id,
    });

    res.json({ message: "Logged out successfully" });
  } catch (err: any) {
    logApiError(req, err, { route: "POST /auth/logout" });
    res.status(400).json({ err: err.message });
  }
});



/* ---------- Update Password ---------- */
authRouter.patch("/auth/update/password", userAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res. status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const hashPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashPassword;
    await user.save();

    res.clearCookie("token");

    logEvent("info", "User password updated", {
      route: "PATCH /auth/update/password",
      userId,
    });

    res.json({ message: "Password updated.  Please login again." });
  } catch (err: any) {
    logApiError(req, err, { route: "PATCH /auth/update/password" });
    res.status(400).json({ err: err.message });
  }
});

export default authRouter;