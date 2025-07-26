import { processPayment, checkServiceHealth } from "../services/paymentService";
import {
  getNextPaymentFromQueue,
  getQueueLength,
  getShouldTimeoutAllCalls,
  setShouldCallFallback,
  setShouldTimeoutAllCalls,
} from "../services/queueService";

let processingCount = 0;
let activeWorkers = 0;
let MAX_CONCURRENT_PAYMENTS = 20;

export function startWorkers(concurrency: number = MAX_CONCURRENT_PAYMENTS): void {
  console.log(`🚀 Starting workers with concurrency ${concurrency}...`);

  async function processQueue(): Promise<void> {
    const shouldTimeoutAllCalls = await getShouldTimeoutAllCalls();

    if (shouldTimeoutAllCalls) {
      setTimeout(() => processQueue(), 250);
      return;
    }

    while (activeWorkers < concurrency) {
      const payment = await getNextPaymentFromQueue();
      if (!payment) {
        setImmediate(() => processQueue());
        return;
      }

      activeWorkers++;
      processingCount++;

      processPayment(payment)
        .catch((err) => {
          console.error("❌ Error processing payment:", err);
        })
        .finally(() => {
          activeWorkers--;
          processingCount--;
          setImmediate(() => processQueue());
        });
    }
  }

  processQueue();
}

export function startServiceHealthMonitor(instanceId: string): void {
  if (instanceId === "01") {
    return;
  }

  const interval = setInterval(async () => {
    try {
      if (processingCount >= MAX_CONCURRENT_PAYMENTS) {
        console.log("🚨 processingCount >= MAX_CONCURRENT_PAYMENTS", processingCount, "🚨");
      }

      const { defaultService, fallbackService } = await checkServiceHealth();
      const queueSize = await getQueueLength();

      console.log({
        queueSize,
        activeWorkers,
        defaultServiceStatus: {
          failing: defaultService.failing,
          minResponseTime: defaultService.minResponseTime,
        },
        fallbackServiceStatus: {
          failing: fallbackService.failing,
          minResponseTime: fallbackService.minResponseTime,
        },
      });

      const isDefaultServiceAvailable = !defaultService.failing;
      const isFallbackServiceAvailable = !fallbackService.failing;

      if (!isDefaultServiceAvailable && !isFallbackServiceAvailable) {
        await setShouldTimeoutAllCalls(true);
        return;
      }

      if (isDefaultServiceAvailable) {
        await setShouldCallFallback(false);
        await setShouldTimeoutAllCalls(false);
        return;
      }

      if (!isDefaultServiceAvailable && isFallbackServiceAvailable) {
        await setShouldCallFallback(true);
        await setShouldTimeoutAllCalls(false);
      }
    } catch (error) {
      console.error("❌ Error in service health monitor:", error);
    }
  }, 4100);

  (global as any).serviceHealthInterval = interval;
}

export function stopWorkers(): void {
  activeWorkers = 0;

  if ((global as any).paymentSaveInterval) {
    clearInterval((global as any).paymentSaveInterval);
  }

  if ((global as any).serviceHealthInterval) {
    clearInterval((global as any).serviceHealthInterval);
  }

  console.log("🛑 Payment workers stopped");
}
