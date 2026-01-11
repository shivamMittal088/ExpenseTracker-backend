import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import authRouter from "../Routes/auth";
import { connectDB } from "../config/database";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/auth", authRouter);

const server = http.createServer(app);

connectDB()
  .then(() => {
    console.log("Database connected successfully");
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err:any) => {
    console.error("Database connection failed ❌", err);
    process.exit(1);
  });
