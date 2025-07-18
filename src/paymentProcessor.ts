import type { PaymentRequest } from "./index";
import { db, INSTANCE_ID } from "./index";
import {
  addProcessToQueue,
  getNextPaymentsFromQueue,
  getShouldCallFallback,
  getShouldTimeoutAllCalls,
  setShouldCallFallback,
  setShouldTimeoutAllCalls,
} from "./paymentQueue";

export const PAYMENT_PROCESSOR_DEFAULT_URL = "http://payment-processor-default:8080";
const PAYMENT_PROCESSOR_FALLBACK_URL = "http://payment-processor-fallback:8080";

export type Service = typeof PAYMENT_PROCESSOR_DEFAULT_URL | typeof PAYMENT_PROCESSOR_FALLBACK_URL;

let isProcessing = false;
let processingCount = 0;
let errorCount = 0;

let MAX_CONCURRENT_PAYMENTS = 10;

const paymentsToBeSaved: {
  correlation_id: string;
  amount: number;
  service: string;
  requested_at: Date;
  success: boolean;
}[] = [];

export async function processPayment(payment: PaymentRequest) {
  const shouldCallFallback = await getShouldCallFallback();
  const service = shouldCallFallback
    ? PAYMENT_PROCESSOR_FALLBACK_URL
    : PAYMENT_PROCESSOR_DEFAULT_URL;
  try {
    const requestedAt = new Date();

    const response = await fetch(`${service}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Rinha-Token": "123",
      },
      body: JSON.stringify({ ...payment, requestedAt }),
    });

    const requestService = service === PAYMENT_PROCESSOR_FALLBACK_URL ? "fallback" : "default";

    if (response.ok) {
      errorCount = 0;
      setShouldTimeoutAllCalls(false);
      if (service === PAYMENT_PROCESSOR_FALLBACK_URL) {
        setShouldCallFallback(true);
      } else {
        setShouldCallFallback(false);
      }

      paymentsToBeSaved.push({
        correlation_id: payment.correlationId,
        amount: payment.amount,
        service: requestService,
        requested_at: requestedAt,
        success: true,
      });
    } else {
      console.log(`❌ !response.ok ${requestService}`);
      await addProcessToQueue(payment);

      errorCount++;
      if (errorCount > 5) {
        if (service === PAYMENT_PROCESSOR_FALLBACK_URL) {
          setShouldCallFallback(false);
        } else {
          setShouldCallFallback(true);
        }
      }
    }
  } catch (error) {
    console.log(`❌ error ${service === PAYMENT_PROCESSOR_FALLBACK_URL ? "fallback" : "default"}`);
    await addProcessToQueue(payment);
  }
}

export function consumePaymentsFromQueueWithInterval() {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  const interval = setInterval(async () => {
    try {
      const shouldTimeoutAllCalls = await getShouldTimeoutAllCalls();

      if (processingCount >= MAX_CONCURRENT_PAYMENTS) {
        return;
      }

      if (shouldTimeoutAllCalls) {
        return;
      }

      const payment = await getNextPaymentsFromQueue({
        numberOfPayments: MAX_CONCURRENT_PAYMENTS - processingCount,
      });

      if (payment) {
        processingCount += payment.length;

        const paymentsPromises = payment.map((p) => processPayment(p));

        await Promise.all(paymentsPromises);

        processingCount -= payment.length;
      }
    } catch (error) {
      console.error("❌ Error in payment consumer:", error);
    }
  }, 100);

  setInterval(async () => {
    try {
      if (paymentsToBeSaved.length === 0) {
        return;
      }
      if (paymentsToBeSaved.length > 0) {
        console.log("💾 Saving payments to database:", paymentsToBeSaved.length);
        await db.collection("payments").insertMany(paymentsToBeSaved);
        paymentsToBeSaved.length = 0;
        console.log("✅ Payments saved to database successfully", {
          "paymentsToBeSaved.length": paymentsToBeSaved.length,
        });
      }
    } catch (error) {
      console.error("❌ Error saving payments to database:", error);
    }
  }, 1000);

  (global as any).paymentConsumerInterval = interval;
}

export function verifyServiceAvailabilityWithInterval() {
  if (INSTANCE_ID === "01") {
    return;
  }

  const interval = setInterval(async () => {
    try {
      if (processingCount >= MAX_CONCURRENT_PAYMENTS) {
        console.log("🚨 processingCount >= MAX_CONCURRENT_PAYMENTS", processingCount, "🚨");
      }

      const [defaultService, fallbackService] = await Promise.all([
        fetch(`${PAYMENT_PROCESSOR_DEFAULT_URL}/payments/service-health`),
        fetch(`${PAYMENT_PROCESSOR_FALLBACK_URL}/payments/service-health`),
      ]);

      type response = {
        failing: boolean;
        minResponseTime: number;
      };

      if (!defaultService.ok) {
        return;
      }

      if (!fallbackService.ok) {
        return;
      }

      const [defaultServiceStatus, fallbackServiceStatus] = await Promise.all([
        defaultService.json() as Promise<response>,
        fallbackService.json() as Promise<response>,
      ]);

      console.log({
        defaultServiceStatus: {
          failing: defaultServiceStatus.failing,
          minResponseTime: defaultServiceStatus.minResponseTime,
        },
        fallbackServiceStatus: {
          failing: fallbackServiceStatus.failing,
          minResponseTime: fallbackServiceStatus.minResponseTime,
        },
      });

      const isDefaultServiceAvailable = !defaultServiceStatus.failing;
      const isFallbackServiceAvailable = !fallbackServiceStatus.failing;

      if (!isDefaultServiceAvailable && !isFallbackServiceAvailable) {
        await setShouldTimeoutAllCalls(true);
        MAX_CONCURRENT_PAYMENTS = 1;
        return;
      }

      if (isDefaultServiceAvailable) {
        await setShouldCallFallback(false);
        await setShouldTimeoutAllCalls(false);
        MAX_CONCURRENT_PAYMENTS = 100;
        return;
      }

      if (!isDefaultServiceAvailable && isFallbackServiceAvailable) {
        await setShouldCallFallback(true);
        await setShouldTimeoutAllCalls(false);
        MAX_CONCURRENT_PAYMENTS = 5;
      }
    } catch (error) {
      console.error("❌ Error in verifyServiceAvailabilityWithInterval:", error);
    }
  }, 2500);

  (global as any).paymentConsumerInterval = interval;
}

// Cleanup function
export function stopPaymentConsumer() {
  isProcessing = false;
  if ((global as any).paymentConsumerInterval) {
    clearInterval((global as any).paymentConsumerInterval);
  }
  console.log("🛑 Payment consumer stopped");
}
