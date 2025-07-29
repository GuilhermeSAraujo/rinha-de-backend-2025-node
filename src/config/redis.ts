import { createClient, RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;

const REDIS_CONNECTION_POOL_SIZE = 10;
const redisPool: RedisClientType[] = [];
let poolIndex = 0;
let poolInitialized = false;

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    await initializeRedisClient();
  }
  return redisClient!;
}

export async function initializeRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      socket: {
        connectTimeout: 5000,
        timeout: 5000,
        keepAlive: true,
      },
    });

    redisClient.on("error", (err) => {
      console.error("Redis Client Error:", err);
    });

    redisClient.on("connect", () => {
      console.log("Redis Client Connected");
    });

    await redisClient.connect();

    // Initialize connection pool
    for (let i = 0; i < REDIS_CONNECTION_POOL_SIZE; i++) {
      const poolClient = createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
        socket: {
          connectTimeout: 5000,
          timeout: 5000,
          keepAlive: true,
        },
      });

      poolClient.on("error", (err) => {
        console.error(`Redis Pool Client ${i} Error:`, err);
      });

      await poolClient.connect();
      redisPool.push(poolClient as RedisClientType);
    }

    poolInitialized = true;
    console.log(`Redis connection pool initialized with ${REDIS_CONNECTION_POOL_SIZE} connections`);
  }
  return redisClient;
}

export async function getPooledRedisClient(): Promise<RedisClientType> {
  // console.log("[getPooledRedisClient] Pool initialized", poolInitialized, redisPool.length);
  if (!poolInitialized || redisPool.length === 0) {
    console.warn("Redis pool not ready, using main client");
    if (!redisClient) {
      await initializeRedisClient();
    }
    return redisClient!;
  }

  const client = redisPool[poolIndex];
  poolIndex = (poolIndex + 1) % REDIS_CONNECTION_POOL_SIZE;
  return client;
}

// Lightweight Redis client for worker processes - avoids creating full connection pools
let workerRedisClient: RedisClientType | null = null;

export async function getWorkerRedisClient(): Promise<RedisClientType> {
  if (!workerRedisClient) {
    workerRedisClient = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      socket: {
        connectTimeout: 5000,
        timeout: 5000,
        keepAlive: true,
      },
    });

    workerRedisClient.on("error", (err) => {
      console.error("Worker Redis Client Error:", err);
    });

    workerRedisClient.on("connect", () => {
      console.log("Worker Redis Client Connected");
    });

    await workerRedisClient.connect();
  }
  return workerRedisClient;
}
