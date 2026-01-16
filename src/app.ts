import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
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
  origin: true,
  credentials: true,
}));


app.use(express.json());
app.use(cookieParser());
app.use(axiomRequestLogger);

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
