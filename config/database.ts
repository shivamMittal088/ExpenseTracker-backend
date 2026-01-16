const mongoose = require("mongoose");

const URI = (process.env.MONGODB_URI || "").trim();

export const connectDB = async () => {
    try {
        if (!URI) {
            throw new Error("MONGODB_URI is not set");
        }
        if (!URI.startsWith("mongodb://") && !URI.startsWith("mongodb+srv://")) {
            throw new Error("MONGODB_URI must start with mongodb:// or mongodb+srv://");
        }
        await mongoose.connect(URI);
    } catch (err) {
        console.log(err);
        throw err;
    }
};