import { createClient, RedisClientType } from "redis";
import type { PaymentRequest } from ".";

let redisClient: RedisClientType | null = null;
const FALLBACK_FLAG_KEY = "should_call_fallback";
const TIMEOUT_FLAG_KEY = "should_timeout_all_calls";

export async function initializeRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });

    redisClient.on("error", (err) => {
      console.error("❌ Redis Client Error:", err);
    });

    redisClient.on("connect", () => {
      console.log("✅ Redis Client Connected");
    });

    await redisClient.connect();
  }
  return redisClient;
}

export async function addProcessToQueue(paymentRequest: PaymentRequest) {
  try {
    const client = await initializeRedisClient();

    await client.lPush("payment_queue", JSON.stringify(paymentRequest));
  } catch (error) {
    console.error("❌ Error adding payment to Redis queue:", error);
    throw error;
  }
}

export async function getNextPaymentFromQueue(): Promise<any | null> {
  try {
    const client = await initializeRedisClient();

    const paymentData = await client.rPop("payment_queue");

    if (paymentData) {
      return JSON.parse(paymentData);
    }

    return null;
  } catch (error) {
    console.error("❌ Error getting payment from Redis queue:", error);
    throw error;
  }
}

export async function getQueueLength(): Promise<number> {
  try {
    const client = await initializeRedisClient();
    return await client.lLen("payment_queue");
  } catch (error) {
    console.error("❌ Error getting queue length:", error);
    return 0;
  }
}

export async function getShouldCallFallback(): Promise<boolean> {
  try {
    const client = await initializeRedisClient();
    const value = await client.get(FALLBACK_FLAG_KEY);
    return value === "true";
  } catch (error) {
    console.error("❌ Error getting fallback flag from Redis:", error);
    return false; // Default to false on error
  }
}

export async function setShouldCallFallback(value: boolean): Promise<void> {
  try {
    const client = await initializeRedisClient();
    await client.set(FALLBACK_FLAG_KEY, value.toString());
  } catch (error) {
    console.error("❌ Error setting fallback flag in Redis:", error);
  }
}

export async function getShouldTimeoutAllCalls(): Promise<boolean> {
  try {
    const client = await initializeRedisClient();
    const value = await client.get(TIMEOUT_FLAG_KEY);
    return value === "true";
  } catch (error) {
    console.error("❌ Error getting timeout flag from Redis:", error);
    return false;
  }
}

export async function setShouldTimeoutAllCalls(value: boolean): Promise<void> {
  try {
    const client = await initializeRedisClient();
    await client.set(TIMEOUT_FLAG_KEY, value.toString());
  } catch (error) {
    console.error("❌ Error setting timeout flag in Redis:", error);
  }
}

export async function closeRedisClient() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log("🔌 Redis Client disconnected");
  }
}
