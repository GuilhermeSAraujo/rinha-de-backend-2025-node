import { savePayment } from "../repositories/paymentRepository";
import { PaymentProcessor, PaymentRequest, ServiceHealthResponse } from "../types/payment";
import {
  addPaymentToQueue,
  getShouldCallFallback,
  setShouldCallFallback,
  setShouldTimeoutAllCalls,
} from "./queueService";

const PAYMENT_PROCESSOR_DEFAULT_URL = "http://payment-processor-default:8080";
const PAYMENT_PROCESSOR_FALLBACK_URL = "http://payment-processor-fallback:8080";

export async function processPayment(payment: PaymentRequest): Promise<void> {
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

    const requestService: PaymentProcessor =
      service === PAYMENT_PROCESSOR_FALLBACK_URL ? "fallback" : "default";

    if (response.ok) {
      setShouldTimeoutAllCalls(false);
      if (service === PAYMENT_PROCESSOR_FALLBACK_URL) {
        setShouldCallFallback(true);
      } else {
        setShouldCallFallback(false);
      }

      await savePayment({
        correlationId: payment.correlationId,
        amount: payment.amount,
        processor: requestService,
        requestedAt: requestedAt.toISOString(),
      });
    } else {
      await addPaymentToQueue(payment);
    }
  } catch (error) {
    console.log(
      `❌ Payment exception: ${payment.correlationId} via ${
        service === PAYMENT_PROCESSOR_FALLBACK_URL ? "fallback" : "default"
      } - Error:`,
      error
    );
    await addPaymentToQueue(payment);
  }
}

export async function checkServiceHealth(): Promise<{
  defaultService: ServiceHealthResponse;
  fallbackService: ServiceHealthResponse;
}> {
  const [defaultServiceResponse, fallbackServiceResponse] = await Promise.all([
    fetch(`${PAYMENT_PROCESSOR_DEFAULT_URL}/payments/service-health`),
    fetch(`${PAYMENT_PROCESSOR_FALLBACK_URL}/payments/service-health`),
  ]);

  if (!defaultServiceResponse.ok || !fallbackServiceResponse.ok) {
    throw new Error("Failed to fetch service health");
  }

  const [defaultService, fallbackService] = await Promise.all([
    defaultServiceResponse.json() as Promise<ServiceHealthResponse>,
    fallbackServiceResponse.json() as Promise<ServiceHealthResponse>,
  ]);

  return { defaultService, fallbackService };
}

export { PAYMENT_PROCESSOR_DEFAULT_URL, PAYMENT_PROCESSOR_FALLBACK_URL };
