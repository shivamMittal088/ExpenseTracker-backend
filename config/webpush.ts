import webpush from "web-push";

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  email: string;
}

/**
 * Reads VAPID credentials from env at call-time (lazy) so that dotenv
 * load order never causes false "not configured" results at module startup.
 */
export function getVapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL;
  if (!publicKey || !privateKey || !email) return null;
  return { publicKey, privateKey, email };
}

/**
 * Initialises the web-push library with the current VAPID config.
 * Returns the config on success, or null if env vars are missing.
 */
export function initWebPush(): VapidConfig | null {
  const config = getVapidConfig();
  if (!config) return null;
  webpush.setVapidDetails(config.email, config.publicKey, config.privateKey);
  return config;
}
