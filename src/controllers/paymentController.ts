import { Request, Response } from "express";
import { PaymentRepository } from "../repositories/paymentRepository";
import { addPaymentToQueue, getQueueLength } from "../services/queueService";
import { PaymentRequest, HealthResponse } from "../types/payment";

export const PaymentController = {
  createPayment: (req: Request, res: Response) => {
    try {
      // Validate input quickly
      const { correlationId, amount } = req.body as PaymentRequest;

      // Add to queue asynchronously without awaiting
      addPaymentToQueue({ correlationId, amount });

      // Respond immediately
      return res.status(202).end();
    } catch (error) {
      console.error("❌ Error in /payments:", error);
      return res.status(500).end();
    }
  },

  getPaymentsSummary: async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const fromParam = req.query["from"] as string | undefined;
      const toParam = req.query["to"] as string | undefined;

      console.log(`🔍 Querying payments with date range: from=${fromParam} to=${toParam}`);

      const result = await PaymentRepository.getSummary(fromParam, toParam);

      // Round amounts to 2 decimal places
      result.default.totalAmount = Math.round(result.default.totalAmount * 100) / 100;
      result.fallback.totalAmount = Math.round(result.fallback.totalAmount * 100) / 100;

      console.log(`✅ Payments summary completed in ${Date.now() - startTime}ms`);
      console.log(`⏳ Queue size: ${await getQueueLength()}`);

      res.status(200).json(result).end();
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ Error getting payment summary after ${totalTime}ms:`, error);
      res.status(500).json({ error: "Internal server error" }).end();
    }
  },

  purgePayments: async (_req: Request, res: Response) => {
    try {
      await PaymentRepository.resetDatabaseData();
      res.status(200).json({ message: "All payments purged." });
    } catch (error) {
      console.error("Error purging payments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  healthCheck: async (req: Request, res: Response) => {
    try {
      const instanceId = req.app.get("instanceId");
      const queueLength = await getQueueLength();

      const healthResponse: HealthResponse = {
        status: "healthy",
        instance: instanceId,
        queueLength,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(healthResponse);
    } catch (error) {
      console.error("Health check error:", error);

      const errorResponse: HealthResponse = {
        status: "unhealthy",
        instance: req.app.get("instanceId") || "unknown",
        queueLength: 0,
        timestamp: new Date().toISOString(),
        error: "Redis connection failed",
      };

      res.status(500).json(errorResponse);
    }
  },
};
