import { processPayment, checkServiceHealth } from "../services/paymentService";
import {
  getNextPaymentFromQueue,
  getQueueLength,
  getShouldTimeoutAllCalls,
  setShouldCallFallback,
  setShouldTimeoutAllCalls,
} from "../services/queueService";

let activeProcessing = 0;
let MAX_CONCURRENT_PAYMENTS = 10;

export function startWorkers(concurrency: number = MAX_CONCURRENT_PAYMENTS): void {
  console.log(`🚀 Starting workers with concurrency ${concurrency}...`);

  async function processQueue(): Promise<void> {
    const shouldTimeoutAllCalls = await getShouldTimeoutAllCalls();

    if (shouldTimeoutAllCalls) {
      setTimeout(() => processQueue(), 500);
      return;
    }

    while (activeProcessing < concurrency) {
      const payment = await getNextPaymentFromQueue();
      if (!payment) {
        setImmediate(() => processQueue());
        return;
      }

      activeProcessing++;

      processPayment(payment)
        .catch((err) => {
          console.error("❌ Error processing payment:", err);
        })
        .finally(() => {
          activeProcessing--;
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
      const { defaultService, fallbackService } = await checkServiceHealth();
      const queueSize = await getQueueLength();

      console.log({
        queueSize,
        activeProcessing,
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
      return;
    }
  }, 2100);

  (global as any).serviceHealthInterval = interval;
}

export function stopWorkers(): void {
  activeProcessing = 0;

  if ((global as any).serviceHealthInterval) {
    clearInterval((global as any).serviceHealthInterval);
  }

  console.log("Payment workers stopped");
}
