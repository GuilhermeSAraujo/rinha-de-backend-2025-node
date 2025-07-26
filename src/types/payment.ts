export interface PaymentRequest {
  correlationId: string;
  amount: number;
}

export interface PaymentLog {
  amount: number;
  processor: string;
  correlationId: string;
  requestedAt: string;
}

export interface PaymentSummary {
  default: {
    totalRequests: number;
    totalAmount: number;
  };
  fallback: {
    totalRequests: number;
    totalAmount: number;
  };
}

export interface ServiceHealthResponse {
  failing: boolean;
  minResponseTime: number;
}

export type PaymentProcessor = "default" | "fallback";

export interface HealthResponse {
  status: "healthy" | "unhealthy";
  instance: string;
  queueLength: number;
  timestamp: string;
  error?: string;
}
