const express = require("express");
const http = require("http");
const cors = require("cors");
require("dotenv").config();

const { connectDB } = require("../config/database");

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API is running...");
});

const server = http.createServer(app);

connectDB()
  .then(() => {
    console.log("Database connected successfully");

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed ❌", err);
    process.exit(1);
  });
