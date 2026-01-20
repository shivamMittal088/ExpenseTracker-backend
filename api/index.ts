import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from "../src/app";
import { connectDB } from "../config/database";

let isConnected = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Debug: Check if we even get here
  console.log("Handler called:", req.method, req.url);
  console.log("MONGODB_URI exists:", !!process.env.MONGODB_URI);
  
  try {
    if (!isConnected) {
      console.log("Connecting to database...");
      await connectDB();
      isConnected = true;
      console.log("Database connected");
    }
    return app(req, res);
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: error instanceof Error ? error.message : "Unknown error",
      mongoUriExists: !!process.env.MONGODB_URI
    });
  }
}
