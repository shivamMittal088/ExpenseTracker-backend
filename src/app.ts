import express from "express";
import { connectDB } from "../config/database";
import http from "http";
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
const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

// Middlewares
app.use(cors({
  origin: FRONTEND_ORIGIN,
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


const server = http.createServer(app);

connectDB()
  .then(() => {
    console.log("Database connected successfully");
    void sendLog({
      type: "app_start",
      message: "Backend server started",
      port: PORT,
      dataset: process.env.AXIOM_DATASET,
    });
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err:any) => {
    console.error("Database connection failed ❌", err);
    process.exit(1);
  });
