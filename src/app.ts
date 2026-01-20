import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { axiomRequestLogger } from "../Middlewares/axiomLogger";
import { sendLog } from "../config/axiomClient";



import authRouter from "../Routes/auth";
import profileRouter from "../Routes/profile";
import expenseRouter from "../Routes/expense";
import seedRouter from "../Routes/seed";
import tileRouter from "../Routes/tile";

dotenv.config();

const app = express();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const ALLOWED_ORIGINS = FRONTEND_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);

// Middlewares
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow exact matches from ALLOWED_ORIGINS
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow all Vercel preview deployments for this project
    if (origin.endsWith('.vercel.app') && origin.includes('expense-tracker')) {
      return callback(null, true);
    }
    
    // Allow custom domain
    if (origin.endsWith('track-expense.com')) {
      return callback(null, true);
    }
    
    // Allow localhost for development
    if (origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    
    callback(null, false);
  },
  credentials: true,
}));


app.use(express.json());
app.use(cookieParser());
app.use(axiomRequestLogger);

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Routes
app.use("/api/auth/", authRouter);
app.use("/api/",profileRouter);
app.use("/api/",expenseRouter);
app.use("/api/",seedRouter);
app.use("/api/",tileRouter);

app.get("/test", (req, res) => {
  res.send("Server alive");
});

export default app;
