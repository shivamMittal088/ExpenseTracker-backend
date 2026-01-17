"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendLog = exports.axiomReady = void 0;
const js_1 = require("@axiomhq/js");
const dotenv_1 = __importDefault(require("dotenv"));
// Load env variables locally; avoid overriding Vercel environment at runtime.
if (!process.env.VERCEL) {
    dotenv_1.default.config();
}
const axiomToken = process.env.AXIOM_TOKEN;
const axiomOrgId = process.env.AXIOM_ORG_ID;
const axiomDataset = process.env.AXIOM_DATASET;
// Single Axiom client instance shared across the app. Falls back to console in dev if not configured.
const axiomClient = axiomToken
    ? new js_1.Axiom(axiomOrgId ? { token: axiomToken, orgId: axiomOrgId } : { token: axiomToken })
    : null;
exports.axiomReady = Boolean(axiomClient && axiomDataset);
const sendLog = async (event) => {
    if (!exports.axiomReady) {
        if (process.env.NODE_ENV !== "production") {
            console.log("[axiom disabled]", event);
        }
        return;
    }
    try {
        await axiomClient.ingest(axiomDataset, [event]);
    }
    catch (error) {
        console.error("Failed to send log to Axiom", error);
    }
};
exports.sendLog = sendLog;
