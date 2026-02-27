"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRedisReady = exports.connectRedisClient = exports.getRedisClient = void 0;
const redis_1 = require("redis");
let redisClient = null;
let connectPromise = null;
const getRedisUrl = () => (process.env.REDIS_URL || "redis://localhost:6379").trim();
const MAX_REDIS_RETRIES = Number(process.env.REDIS_MAX_RETRIES || 5);
const getRedisClient = () => {
    if (!redisClient) {
        redisClient = (0, redis_1.createClient)({
            url: getRedisUrl(),
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries >= MAX_REDIS_RETRIES) {
                        return new Error(`Redis reconnect limit reached after ${MAX_REDIS_RETRIES} retries`);
                    }
                    return Math.min(retries * 200, 2000);
                },
            },
        });
        redisClient.on("error", (err) => {
            const message = err instanceof Error ? err.message : String(err || "Unknown Redis error");
            console.error("Redis client error:", message);
        });
    }
    return redisClient;
};
exports.getRedisClient = getRedisClient;
const connectRedisClient = async () => {
    const client = (0, exports.getRedisClient)();
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
exports.connectRedisClient = connectRedisClient;
const isRedisReady = () => {
    const client = (0, exports.getRedisClient)();
    return client.isOpen && client.isReady;
};
exports.isRedisReady = isRedisReady;
