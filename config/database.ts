const mongoose = require("mongoose");

const URI = process.env.MONGODB_URI;

export const connectDB = async () => {
    try {
        if (!URI) {
            throw new Error("MONGODB_URI is not set");
        }
        await mongoose.connect(URI);
    } catch (err) {
        console.log(err);
        throw err;
    }
};