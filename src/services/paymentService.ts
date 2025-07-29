import { Agent, fetch } from "undici";
import { savePayment } from "../repositories/paymentRepository";
import { PaymentRequest, ServiceHealthResponse } from "../types/payment";
import {
  addPaymentToQueue,
  getShouldCallFallback,
  setShouldCallFallback,
  setShouldTimeoutAllCalls,
} from "./queueService";

const PAYMENT_PROCESSOR_DEFAULT_URL = "http://payment-processor-default:8080";
const PAYMENT_PROCESSOR_FALLBACK_URL = "http://payment-processor-fallback:8080";

const defaultAgent = new Agent({
  keepAliveTimeout: 10_000, // 10s
  keepAliveMaxTimeout: 60_000, // 60s
  connections: 100, // Similar ao maxSockets
  pipelining: 15, // HTTP pipelining
});

const fallbackAgent = new Agent({
  keepAliveTimeout: 10_000, // 10s
  keepAliveMaxTimeout: 60_000, // 60s
  connections: 100, // Similar ao maxSockets
  pipelining: 15, // HTTP pipelining
});

export async function processPayment(payment: PaymentRequest): Promise<void> {
  const useFallback = await getShouldCallFallback();
  const agent = useFallback ? fallbackAgent : defaultAgent;
  const serviceUrl = useFallback ? PAYMENT_PROCESSOR_FALLBACK_URL : PAYMENT_PROCESSOR_DEFAULT_URL;

  try {
    const requestedAt = new Date().toISOString();

    const response = await fetch(`${serviceUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Rinha-Token": "123",
      },
      body: JSON.stringify({ ...payment, requestedAt }),
      dispatcher: agent,
    });

    if (response.ok) {
      setShouldTimeoutAllCalls(false);
      setShouldCallFallback(useFallback);
      savePayment({
        correlationId: payment.correlationId,
        amount: payment.amount,
        processor: useFallback ? "fallback" : "default",
        requestedAt,
      });
    } else {
      await addPaymentToQueue(payment);
    }
  } catch (error) {
    console.error(
      `❌ Payment exception: ${payment.correlationId} via ${
        useFallback ? "fallback" : "default"
      } -`,
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
    fetch(`${PAYMENT_PROCESSOR_DEFAULT_URL}/payments/service-health`, {
      dispatcher: defaultAgent,
    }),
    fetch(`${PAYMENT_PROCESSOR_FALLBACK_URL}/payments/service-health`, {
      dispatcher: fallbackAgent,
    }),
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
