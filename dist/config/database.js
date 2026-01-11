"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose = require("mongoose");
const URI = "mongodb+srv://Shivam:Hr8BL1xCpqYIzDUO@namastenode.1ozmfux.mongodb.net/expense-backend";
const connectDB = async () => {
    try {
        await mongoose.connect(URI);
    }
    catch (err) {
        console.log(err);
    }
};
exports.connectDB = connectDB;
