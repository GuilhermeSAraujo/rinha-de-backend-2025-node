import workerpool from "workerpool";
import { getWorkerRedisClient } from "../config/redis";
import type { PaymentRequest } from "../types/payment";

async function addPaymentToQueue(paymentRequest: PaymentRequest): Promise<void> {
  const client = await getWorkerRedisClient();
  await client.lPush("payment_queue", JSON.stringify(paymentRequest));
}

workerpool.worker({
  addPaymentToQueue: addPaymentToQueue,
});
