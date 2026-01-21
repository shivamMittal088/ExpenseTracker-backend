import express, { Request, Response } from "express";
import User from "../Models/UserSchema";
import SessionToken from "../Models/SessionTokenSchema";
import LoginHistory from "../Models/LoginHistorySchema";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import userAuth from "../Middlewares/userAuth";
import { logApiError, logEvent } from "../utils/logger";
import { UAParser } from "ua-parser-js";

const authRouter = express.Router();

const TOKEN_EXPIRY_MS = 1 * 60 * 60 * 1000; // 1 hour

// Helper to parse user agent and get client IP
const getClientInfo = (req: Request) => {
  const parser = new UAParser(req.headers["user-agent"] || "");
  const result = parser.getResult();

  // Get IP address (handle proxies)
  const forwarded = req.headers["x-forwarded-for"];
  const ip = forwarded
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0])
    : req.ip || req.socket.remoteAddress || "Unknown";

  // Determine device type
  let device = "Desktop";
  if (result.device.type === "mobile") device = "Mobile";
  else if (result.device.type === "tablet") device = "Tablet";
  else if (!result.device.type && result.os.name) device = "Desktop";
  else device = "Unknown";

  return {
    ipAddress: ip,
    userAgent: req.headers["user-agent"] || "Unknown",
    browser: result.browser.name
      ? `${result.browser.name} ${result.browser.version || ""}`.trim()
      : "Unknown",
    os: result.os.name
      ? `${result.os.name} ${result.os.version || ""}`.trim()
      : "Unknown",
    device,
  };
};

// Helper to record login history
const recordLogin = async (
  userId: string,
  req: Request,
  isSuccessful: boolean
) => {
  try {
    const clientInfo = getClientInfo(req);
    await LoginHistory.create({
      userId,
      ...clientInfo,
      isSuccessful,
      loginAt: new Date(),
    });

    // Keep only last 20 records per user
    const count = await LoginHistory.countDocuments({ userId });
    if (count > 20) {
      const oldRecords = await LoginHistory.find({ userId })
        .sort({ loginAt: 1 })
        .limit(count - 20);
      const idsToDelete = oldRecords.map((r) => r._id);
      await LoginHistory.deleteMany({ _id: { $in: idsToDelete } });
    }
  } catch (err) {
    logApiError(req, err as Error, { context: "recordLogin" });
  }
};

/* ---------- Signup ---------- */
authRouter.post("/signup", async (req:  Request, res: Response) => {
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
      { expiresIn: "1h" }
    );

    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    // ======== COMMENTED: Single device login restriction ========
    // Delete any existing session & create new
    // await SessionToken. findOneAndDelete({ userId: savedUser._id });
    
    await SessionToken. create({
      userId: savedUser._id,
      token:  token,
      expiresAt: expiresAt
    });
    // ======== END: Single device login restriction ========

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax", // Safe now - requests come through same domain via Vercel rewrites
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
    });

    logEvent("info", "User signed up", {
      route: "POST /signup",
      userId: savedUser._id,
      emailId,
    });

    res.json({ message: "Signup successful", token });
  } catch (err: any) {
    logApiError(req, err, { route: "POST /signup" });
    res.status(400).json({ err: err.message });
  }
});




/* ---------- Login ---------- */
authRouter.post("/login", async (req:  Request, res: Response) => {
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

    // ======== COMMENTED: Single device login restriction ========
    // Delete old session (kicks out old device)
    // await SessionToken.findOneAndDelete({ userId: user._id });
    // ======== END: Single device login restriction ========

    // Generate new token
    const token = jwt.sign(
      { _id: user._id },
      "MYSecretKey",
      { expiresIn: "1h" }
    );

    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    // Create new session
    await SessionToken.create({
      userId: user._id,
      token: token,
      expiresAt: expiresAt
    });

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax", // Safe now - requests come through same domain via Vercel rewrites
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
    });

    // Record successful login
    await recordLogin(user._id.toString(), req, true);

    const { password: _password, ...safeUser } = user. toObject();

    logEvent("info", "User logged in", {
      route: "POST /login",
      userId: user._id,
      emailId,
    });

    res.json({ ...safeUser, token });
  } catch (err: any) {
    logApiError(req, err, { route: "POST /login" });
    res.status(400).json({ err: err.message });
  }
});



/* ---------- Get Current User ---------- */
authRouter.get("/me", userAuth, (req: Request, res: Response) => {
  logEvent("info", "Fetched current user", {
    route: "GET /me",
    userId: (req as any).user._id,
  });

  res.json({
    _id:  (req as any).user._id,
    name: (req as any).user.name,
    emailId: (req as any).user.emailId
  });
});



/* ---------- Logout ---------- */
authRouter.post("/logout", userAuth, async (req: Request, res:  Response) => {
  try {
    const userId = (req as any).user._id;

    await SessionToken.deleteOne({ userId:  userId });

    res.clearCookie("token");

    logEvent("info", "User logged out", {
      route: "POST /logout",
      userId,
    });

    res.json({ message: "Logged out successfully" });
  } catch (err: any) {
    logApiError(req, err, { route: "POST /logout" });
    res.status(400).json({ err: err.message });
  }
});



/* ---------- Update Password ---------- */
authRouter.patch("/update/password", userAuth, async (req: Request, res: Response) => {
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

    await SessionToken.deleteOne({ userId: userId });

    res.clearCookie("token");

    logEvent("info", "User password updated", {
      route: "PATCH /update/password",
      userId,
    });

    res.json({ message: "Password updated.  Please login again." });
  } catch (err: any) {
    logApiError(req, err, { route: "PATCH /update/password" });
    res.status(400).json({ err: err.message });
  }
});

export default authRouter;