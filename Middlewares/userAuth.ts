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

/* ---- JWT Payload Type ---- */
interface MyJwtPayload extends JwtPayload {
  _id: string;
}

/* ---- Extend Express Request ---- */
interface AuthRequest extends Request {
  user?: any;
}

const JWT_SECRET = "MYSecretKey";

const userAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Check cookie first, then Authorization header as fallback (for iOS)
    let token = req.cookies?.token;
    
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    // 1️⃣ No token found anywhere
    if (!token) {
      return res.status(401).json({ code: "NO_TOKEN" });
    }

    // 2️⃣ Verify JWT
    let decoded: MyJwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as MyJwtPayload;
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ code: "SESSION_EXPIRED" });
      }
      return res.status(401).json({ code: "INVALID_TOKEN" });
    }

    // ======== COMMENTED: Single device login restriction ========
    // 3️⃣ Check if this token still exists in DB (single-device login)
    // const session = await SessionToken.findOne({ token });

    // if (!session) {
    //   return res.status(401).json({ code: "LOGGED_IN_ELSEWHERE" });
    // }

    // 4️⃣ Extra DB expiry check (safety)
    // if (session.expiresAt < new Date()) {
    //   await SessionToken.deleteOne({ token });
    //   return res.status(401).json({ code: "SESSION_EXPIRED" });
    // }
    // ======== END: Single device login restriction ========

    // 5️⃣ Load user
    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(401).json({ code: "INVALID_USER" });
    }

    // 6️⃣ Attach user to request
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ code: "AUTH_FAILED" });
  }
};

export default userAuth;



// we hve created a middleware function named userAuth
// this function will verify the jwt token sent by the client in cookies
// if token is valid , it will allow the request to proceed to next middleware or route handler
// otherwise it will send an error response indicating token verification failure

// now it will act as a middleware in routes where authentication is required and to get userId of logged in user
