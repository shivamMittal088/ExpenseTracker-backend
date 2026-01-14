import mongoose from "mongoose";
const { Schema, model } = mongoose;

const SessionTokenSchema = new Schema({
    
    // Reference to User (better than email)
    userId: {
        type:  Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true  // Only ONE session per user
    },

    // Session token
    token: {
        type: String,
        required: true
    },

    // When token was created
    createdAt: {
        type: Date,
        default: Date. now
    },

    // When token will expire (for TTL auto-delete)
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 }
        // TTL Index - auto deletes at this time
        // "Delete this document 0 seconds AFTER the expiresAt time"
        // Meaning: Delete EXACTLY when expiresAt time is reached 
    }

});

// Create model and export
const SessionToken = model("SessionToken", SessionTokenSchema);
export default SessionToken;