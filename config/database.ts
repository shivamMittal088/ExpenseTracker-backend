const mongoose = require("mongoose");

const URI = "mongodb+srv://Shivam:Hr8BL1xCpqYIzDUO@namastenode.1ozmfux.mongodb.net/expense-backend";

export const connectDB = async()=>{
    try{
        await mongoose.connect(URI);
    }
    catch(err){
        console.log(err);
    }
}