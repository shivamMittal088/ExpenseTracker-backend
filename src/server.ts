import http from "http";
import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "../config/database";
import { sendLog } from "../config/axiomClient";
import { connectRedisClient } from "../config/redisClient";
import { startCronJobs } from "../jobs";

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

server.on("error", (err: any) => {
  if (err?.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the existing process/container or set a different PORT.`);
    process.exit(1);
  }

  if (err?.code === "EACCES") {
    console.error(`Permission denied while trying to bind to port ${PORT}.`);
    process.exit(1);
  }

  console.error("Server failed to start:", err);
  process.exit(1);
});

connectDB()
  .then(() => {
    console.log("Database connected successfully");

    void connectRedisClient()
      .then(() => {
        console.log("Redis connected successfully");
      })
      .catch((err: any) => {
        console.warn("Redis connection failed. Continuing without Redis-backed features.", err?.message || err);
      });
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startCronJobs();
      void sendLog({
        type: "app_start",
        message: "Backend server started",
        port: PORT,
        dataset: process.env.AXIOM_DATASET,
      });
    });
  })
  .catch((err: any) => {
    console.error("Database connection failed ❌", err);
    process.exit(1);
  });
