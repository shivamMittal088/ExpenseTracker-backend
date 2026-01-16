import http from "http";
import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "../config/database";
import { sendLog } from "../config/axiomClient";

dotenv.config();

const PORT = process.env.PORT || 5000;

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
  .catch((err: any) => {
    console.error("Database connection failed ❌", err);
    process.exit(1);
  });
