import { getPooledRedisClient } from "../config/redis";
import { PaymentRequest } from "../types/payment";

const FALLBACK_FLAG_KEY = "should_call_fallback";
const TIMEOUT_FLAG_KEY = "should_timeout_all_calls";

export async function addPaymentToQueue(paymentRequest: PaymentRequest): Promise<void> {
  const client = await getPooledRedisClient();
  await client.lPush("payment_queue", JSON.stringify(paymentRequest));
}

export async function getNextPaymentFromQueue(): Promise<PaymentRequest | null> {
  try {
    const client = await getPooledRedisClient();
    const paymentData = await client.lPop("payment_queue");

    if (paymentData) {
      return JSON.parse(paymentData) as PaymentRequest;
    }

    return null;
  } catch (error) {
    console.error("Error getting payment from Redis queue:", error);
    throw error;
  }
}

export async function getQueueLength(): Promise<number> {
  try {
    const client = await getPooledRedisClient();
    return await client.lLen("payment_queue");
  } catch (error) {
    console.error("Error getting queue length:", error);
    return 0;
  }
}

export async function getShouldCallFallback(): Promise<boolean> {
  try {
    const client = await getPooledRedisClient();
    const value = await client.get(FALLBACK_FLAG_KEY);
    return value === "true";
  } catch (error) {
    console.error("Error getting fallback flag from Redis:", error);
    return false;
  }
}

export async function setShouldCallFallback(value: boolean): Promise<void> {
  try {
    const client = await getPooledRedisClient();
    await client.set(FALLBACK_FLAG_KEY, value.toString());
  } catch (error) {
    console.error("Error setting fallback flag in Redis:", error);
  }
}

export async function getShouldTimeoutAllCalls(): Promise<boolean> {
  try {
    const client = await getPooledRedisClient();
    const value = await client.get(TIMEOUT_FLAG_KEY);
    return value === "true";
  } catch (error) {
    console.error("Error getting timeout flag from Redis:", error);
    return false;
  }
}

export async function setShouldTimeoutAllCalls(value: boolean): Promise<void> {
  try {
    const client = await getPooledRedisClient();
    await client.set(TIMEOUT_FLAG_KEY, value.toString());
  } catch (error) {
    console.error("Error setting timeout flag in Redis:", error);
  }
}
