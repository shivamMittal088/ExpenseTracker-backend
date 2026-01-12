// const express = require('express');
// const authRouter = express.Router();
// const User = require("../models/user");
// const jwt = require('jsonwebtoken');
// const bcrypt = require("bcrypt");

// const userAuth = async(req , res , next){
//     try{
//         const {token} = req.cookies;
//         if(!token){
//             return res.status(401).send({
//                 message : "No token found",
//             })
//         }

//         const decodedObj = await jwt.verify(token,"MYSecretKey");
//         // does three critical checks:

//         // ✅ 1. Checks if token is real

//         // It verifies the token was created using MYSecretKey
//         // If someone fakes or modifies it → ❌ rejected

//         // ✅ 2. Checks if token is expired
//         // JWT has an expiry (exp).
//         // If expired → ❌ rejected

//         // ✅ 3. Extracts the data
//         // If valid → returns the original payload

//         // If token is fake , expired , copied then it shows error .
//         console.log("Decoded Object from token:",decodedObj);

//         const {_id} = decodedObj;
//         // attaching userId to request object
//         // so that next middlewares or route handlers can access it
//         // now we can easily identify the user making the request

//         const loggedInUser = await User.findById({_id})

//          if (!loggedInUser) {
//         throw new Error("User not found");
//         }

//         req.user = loggedInUser;
//         next();

//     }
//     catch(err:any){
//          res.status(401).send(
//             {
//                 message : "token not verified ",
//                 error : err.message,
//             }
//         );
//     }
// }




import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import User from "../Models/UserSchema";

interface AuthRequest extends Request {
  user?: any; // later you can replace with IUser
}

const userAuth = async (req: AuthRequest, res: Response, next: NextFunction
) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: "No token found" });
    }

    const decoded = jwt.verify(token, "MYSecretKey") as JwtPayload;

    const userId = decoded._id;

    const loggedInUser = await User.findById(userId);

    if (!loggedInUser) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = loggedInUser; // attach user to request
    next();
  } catch (err: any) {
    return res.status(401).json({
      message: "Token not verified",
      error: err.message,
    });
  }
};

export default userAuth;


// we hve created a middleware function named userAuth
// this function will verify the jwt token sent by the client in cookies
// if token is valid , it will allow the request to proceed to next middleware or route handler
// otherwise it will send an error response indicating token verification failure

// now it will act as a middleware in routes where authentication is required and to get userId of logged in user

module.exports = userAuth;