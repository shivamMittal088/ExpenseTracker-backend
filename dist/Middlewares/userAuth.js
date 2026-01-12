"use strict";
// const express = require('express');
// const authRouter = express.Router();
// const User = require("../models/user");
// const jwt = require('jsonwebtoken');
// const bcrypt = require("bcrypt");
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const UserSchema_1 = __importDefault(require("../Models/UserSchema"));
const userAuth = async (req, res, next) => {
    try {
        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).json({ message: "No token found" });
        }
        const decoded = jsonwebtoken_1.default.verify(token, "MYSecretKey");
        const userId = decoded._id;
        const loggedInUser = await UserSchema_1.default.findById(userId);
        if (!loggedInUser) {
            return res.status(401).json({ message: "User not found" });
        }
        req.user = loggedInUser; // attach user to request
        next();
    }
    catch (err) {
        return res.status(401).json({
            message: "Token not verified",
            error: err.message,
        });
    }
};
exports.default = userAuth;
// we hve created a middleware function named userAuth
// this function will verify the jwt token sent by the client in cookies
// if token is valid , it will allow the request to proceed to next middleware or route handler
// otherwise it will send an error response indicating token verification failure
// now it will act as a middleware in routes where authentication is required and to get userId of logged in user
module.exports = userAuth;
