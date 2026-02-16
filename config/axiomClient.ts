import { Axiom } from "@axiomhq/js";
import dotenv from "dotenv";

// Load env variables locally; avoid overriding Vercel environment at runtime.
if (!process.env.VERCEL) {
  dotenv.config();
}

const axiomToken = process.env.AXIOM_TOKEN;
const axiomOrgId = process.env.AXIOM_ORG_ID;
const axiomDataset = process.env.AXIOM_DATASET;

// Single Axiom client instance shared across the app. Falls back to console in dev if not configured.
const axiomClient = axiomToken
  ? new Axiom(axiomOrgId ? { token: axiomToken, orgId: axiomOrgId } : { token: axiomToken })
  : null;

export type LogEvent = Record<string, unknown> & { message?: string };

export const axiomReady = Boolean(axiomClient && axiomDataset);

export const sendLog = async (event: LogEvent): Promise<void> => {
  console.log("[axiom event]", event);
  if (!axiomReady) {
    return;
  }

  try {
    await axiomClient!.ingest(axiomDataset!, [event]);
  } catch (error) {
    console.error("Failed to send log to Axiom", error);
  }
};
