import { createClient, RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;
let connectPromise: Promise<unknown> | null = null;

const getRedisUrl = (): string => (process.env.REDIS_URL || "redis://localhost:6379").trim();
const MAX_REDIS_RETRIES = Number(process.env.REDIS_MAX_RETRIES || 5);

export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    redisClient = createClient({
      url: getRedisUrl(),
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries >= MAX_REDIS_RETRIES) {
            return new Error(`Redis reconnect limit reached after ${MAX_REDIS_RETRIES} retries`);
          }

          return Math.min(retries * 200, 2000);
        },
      },
    });

    redisClient.on("error", (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err || "Unknown Redis error");
      console.error("Redis client error:", message);
    });
  }

  return redisClient;
};

export const connectRedisClient = async (): Promise<void> => {
  const client = getRedisClient();
  if (client.isOpen) {
    return;
  }

  if (!connectPromise) {
    connectPromise = client.connect().finally(() => {
      connectPromise = null;
    });
  }

  await connectPromise;
};

export const isRedisReady = (): boolean => {
  const client = getRedisClient();
  return client.isOpen && client.isReady;
};
